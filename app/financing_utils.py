"""
Financing Utilities Module

Handles:
- Monthly payment calculations for loans
- Property-specific qualification matching
- Financing scenario generation for properties
"""

import json
import math
from decimal import Decimal
from typing import List, Tuple, Dict


def calculate_monthly_payment(
    loan_amount: float,
    annual_interest_rate: float,
    years: int
) -> float:
    """
    Calculate monthly payment for a loan using standard amortization formula.
    
    Formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    where:
      M = Monthly payment
      P = Principal (loan amount)
      r = Monthly interest rate (annual / 12)
      n = Total number of payments (years * 12)
    
    Args:
        loan_amount: Principal amount in PHP
        annual_interest_rate: Annual interest rate as percentage (e.g., 7.5)
        years: Loan term in years
    
    Returns:
        Monthly payment in PHP (float)
    """
    if loan_amount <= 0 or years <= 0:
        return 0.0
    
    monthly_rate = (annual_interest_rate / 100) / 12
    num_payments = years * 12
    
    if monthly_rate == 0:
        # If no interest, just divide by months
        return loan_amount / num_payments
    
    # M = P * [r(1+r)^n] / [(1+r)^n - 1]
    numerator = loan_amount * monthly_rate * ((1 + monthly_rate) ** num_payments)
    denominator = ((1 + monthly_rate) ** num_payments) - 1
    
    monthly_payment = numerator / denominator
    return round(monthly_payment, 2)


def calculate_total_interest(
    loan_amount: float,
    monthly_payment: float,
    years: int
) -> float:
    """Calculate total interest paid over the life of the loan."""
    total_paid = monthly_payment * years * 12
    total_interest = total_paid - loan_amount
    return round(max(0, total_interest), 2)


def generate_property_financing_options(
    property_price: float,
    downpayment_rate: float,
    loanable_percentage: float,
    interest_rate: float,
    financing_years: List[int]
) -> List[Dict]:
    """
    Generate financing options for a property across multiple term lengths.
    
    Args:
        property_price: Total property price in PHP
        downpayment_rate: Down payment percentage (e.g., 20)
        loanable_percentage: What % can be financed (e.g., 80)
        interest_rate: Annual interest rate (e.g., 7.5)
        financing_years: List of available terms [5, 10, 15]
    
    Returns:
        List of dicts with:
        {
            'financing_years': 5,
            'down_payment': 630000,
            'loan_amount': 2520000,
            'monthly_payment': 47890.50,
            'total_interest': 485340.00,
        }
    """
    options = []
    
    # Down payment (from down payment rate)
    down_payment = float(property_price) * (downpayment_rate / 100)
    
    # Loanable amount (from loanable percentage)
    max_loanable = float(property_price) * (loanable_percentage / 100)
    
    # Actual loan amount is the remainder after down payment, but capped at loanable %
    loan_amount = min(float(property_price) - down_payment, max_loanable)
    
    for years in financing_years:
        monthly_pmt = calculate_monthly_payment(loan_amount, interest_rate, years)
        total_int = calculate_total_interest(loan_amount, monthly_pmt, years)
        
        options.append({
            'financing_years': years,
            'down_payment': round(down_payment, 2),
            'loan_amount': round(loan_amount, 2),
            'monthly_payment': round(monthly_pmt, 2),
            'total_interest': round(total_int, 2),
        })
    
    return options


def calculate_dti_ratio(gross_income: float, monthly_debt: float) -> float:
    """
    Calculate Debt-to-Income (DTI) ratio.
    
    Args:
        gross_income: Monthly gross income in PHP
        monthly_debt: Total monthly debt obligations in PHP
    
    Returns:
        DTI ratio as percentage (0-200+)
    """
    if gross_income <= 0:
        return 100.0  # Can't qualify with no income
    
    dti = (monthly_debt / gross_income) * 100
    return round(dti, 2)


def get_qualification_status(client_dti: float, required_dti: float) -> str:
    """
    Determine qualification status based on DTI comparison.
    
    Rules:
    - Qualified: client_dti <= required_dti
    - Conditional: client_dti <= required_dti + 10%
    - Not Qualified: client_dti > required_dti + 10%
    
    Args:
        client_dti: Client's actual DTI ratio
        required_dti: Required DTI for this property/term
    
    Returns:
        Qualification status string
    """
    if client_dti <= required_dti:
        return "Qualified"
    elif client_dti <= required_dti + 10:
        return "Conditionally Qualified"
    else:
        return "Not Qualified"


def create_financing_options_for_property(property_obj) -> bool:
    """
    Create and save PropertyFinancingOption records for a property.
    
    Args:
        property_obj: Property model instance
    
    Returns:
        True if successful, False otherwise
    """
    try:
        from .models import db, PropertyFinancingOption
        
        # Parse financing years from JSON
        financing_years = [5, 10, 15]  # default
        try:
            financing_years = json.loads(property_obj.financing_years_json)
        except (json.JSONDecodeError, TypeError):
            pass
        
        # Get property parameters
        price = float(property_obj.price or 0)
        downpay_rate = float(property_obj.downpayment_rate or 20)
        loanable_pct = float(property_obj.loanable_percentage or 80)
        interest_rate = float(property_obj.interest_rate or 7.5)
        
        # Generate financing options
        options = generate_property_financing_options(
            price, downpay_rate, loanable_pct, interest_rate, financing_years
        )
        
        # Delete old options
        PropertyFinancingOption.query.filter_by(property_id=property_obj.id).delete()
        
        # Create new options
        for opt in options:
            pfo = PropertyFinancingOption(
                property_id=property_obj.id,
                financing_years=opt['financing_years'],
                loan_amount=opt['loan_amount'],
                monthly_payment=opt['monthly_payment'],
                total_interest=opt['total_interest'],
            )
            db.session.add(pfo)
        
        db.session.commit()
        return True
    except Exception as e:
        print(f"Error creating financing options for property {property_obj.id}: {e}")
        return False


def regenerate_qualification_matches_for_client(user_obj) -> int:
    """
    Regenerate all PropertyQualificationMatch records for a single client.
    Called when a client updates their qualification info.
    
    Args:
        user_obj: User model instance (client)
    
    Returns:
        Number of matches created
    """
    try:
        from .models import db, Property, PropertyFinancingOption, PropertyQualificationMatch
        
        profile = user_obj.profile
        if not profile:
            return 0
        
        gross_income = float(profile.gross_income or 0)
        monthly_debt = float(profile.monthly_loans or 0)
        client_dti = calculate_dti_ratio(gross_income, monthly_debt)
        
        # Delete old matches
        PropertyQualificationMatch.query.filter_by(user_id=user_obj.id).delete()
        
        # Get all available properties
        properties = Property.query.filter_by(status="available").all()
        
        matches_count = 0
        for prop in properties:
            # Get financing options for this property
            fin_options = PropertyFinancingOption.query.filter_by(
                property_id=prop.id
            ).all()
            
            for fin_opt in fin_options:
                # Calculate required DTI for this term
                required_dti = calculate_dti_ratio(gross_income, fin_opt.monthly_payment)
                
                # Determine qualification status
                status = get_qualification_status(client_dti, required_dti)
                
                # Create match record
                match = PropertyQualificationMatch(
                    user_id=user_obj.id,
                    property_id=prop.id,
                    financing_years=fin_opt.financing_years,
                    client_gross_income=gross_income,
                    client_monthly_debt=monthly_debt,
                    client_dti_ratio=client_dti,
                    required_dti_ratio=required_dti,
                    monthly_payment=fin_opt.monthly_payment,
                    qualification_status=status,
                )
                db.session.add(match)
                matches_count += 1
        
        db.session.commit()
        return matches_count
    except Exception as e:
        print(f"Error regenerating matches for user {user_obj.id}: {e}")
        return 0


def regenerate_qualification_matches_for_all_clients() -> int:
    """
    Regenerate qualification matches for ALL clients.
    Called when C5.0 model is retrained or property financing changes.
    
    Returns:
        Total number of matches created
    """
    try:
        from .models import db, User
        
        # Get all clients
        clients = User.query.filter_by(role="client", is_active=True).all()
        
        total_matches = 0
        for client in clients:
            matches = regenerate_qualification_matches_for_client(client)
            total_matches += matches
        
        return total_matches
    except Exception as e:
        print(f"Error regenerating all matches: {e}")
        return 0


def get_qualified_properties_for_client(user_obj, min_status: str = "Qualified") -> Dict:
    """
    Get qualified properties for a client, grouped by financing term.
    
    Args:
        user_obj: User model instance (client)
        min_status: Minimum status to include ('Qualified', 'Conditionally Qualified', 'Not Qualified')
    
    Returns:
        {
            'qualified': [
                {'property_name': '...', 'financing_years': 10, 'monthly_payment': ...},
                ...
            ],
            'conditional': [...],
        }
    """
    try:
        from .models import PropertyQualificationMatch
        
        status_order = {
            "Qualified": 3,
            "Conditionally Qualified": 2,
            "Not Qualified": 1,
        }
        min_status_value = status_order.get(min_status, 1)
        
        matches = PropertyQualificationMatch.query.filter_by(user_id=user_obj.id).all()
        
        qualified_props = {
            "Qualified": [],
            "Conditionally Qualified": [],
            "Not Qualified": [],
        }
        
        seen = set()  # Avoid duplicates
        for match in matches:
            status_value = status_order.get(match.qualification_status, 1)
            if status_value >= min_status_value:
                key = (match.property_id, match.financing_years)
                if key not in seen:
                    qualified_props[match.qualification_status].append({
                        'property_id': match.property_id,
                        'property_name': match.property.name,
                        'financing_years': match.financing_years,
                        'monthly_payment': float(match.monthly_payment),
                        'client_dti_ratio': round(match.client_dti_ratio, 2),
                        'required_dti_ratio': round(match.required_dti_ratio, 2),
                    })
                    seen.add(key)
        
        return qualified_props
    except Exception as e:
        print(f"Error getting qualified properties: {e}")
        return {"Qualified": [], "Conditionally Qualified": [], "Not Qualified": []}
