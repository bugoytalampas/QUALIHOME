from flask_wtf import FlaskForm
from wtforms import (
    IntegerField, DecimalField, SelectField, SubmitField,
)
from wtforms.validators import DataRequired, NumberRange, Optional, ValidationError


class Step1FinancialForm(FlaskForm):
    """Step 1 — Financial Capability."""

    gross_monthly_income = DecimalField(
        "Gross Monthly Income (₱)",
        places=2,
        validators=[DataRequired(), NumberRange(min=1)],
        render_kw={"placeholder": "e.g. 35000.00"},
    )
    monthly_debt_loans = DecimalField(
        "Monthly Debt / Loan Payments (₱)",
        places=2,
        default=0,
        validators=[Optional(), NumberRange(min=0)],
        render_kw={"placeholder": "Car loan, personal loan, credit card, etc."},
    )
    submit = SubmitField("Next: Employment Info →")


class Step2EmploymentForm(FlaskForm):
    """Step 2 — Employment."""

    employment_status = SelectField(
        "Employment Status",
        choices=[
            ("", "— Select —"),
            ("employed", "Employed"),
            ("ofw-landbased", "OFW - LandBased"),
            ("ofw-seafarer", "OFW - Seaferer"),
            ("licensed-professional", "Licensed Professional"),
            ("with-financial-support", "With Financial Support"),
            ("with-attorney-in-fact", "With Attorney In-Fact"),
            ("with-co-borrower", "With Co-Borrower"),
        ],
        validators=[DataRequired(message="Please select your employment status.")],
    )
    tenure_months = IntegerField(
        "Tenure (months)",
        validators=[Optional(), NumberRange(min=0, max=600)],
        render_kw={"placeholder": "e.g. 24 (= 2 years)"},
    )
    age = IntegerField(
        "Age",
        validators=[DataRequired(), NumberRange(min=18, max=80, message="Age must be between 18 and 80.")],
        render_kw={"placeholder": "e.g. 28"},
    )
    submit = SubmitField("Next: Housing Preferences →")


class QualifyForm(FlaskForm):
    """Combined single-page qualification wizard (all 4 steps in one POST)."""

    # ── Step 1: Financial ──────────────────────────────────────────
    gross_monthly_income = DecimalField(
        "Gross Monthly Income (₱)",
        places=2,
        validators=[DataRequired(), NumberRange(min=1)],
        render_kw={"placeholder": "e.g. 35000.00"},
    )
    monthly_debt_loans = DecimalField(
        "Monthly Debt / Loan Payments (₱)",
        places=2,
        default=0,
        validators=[Optional(), NumberRange(min=0)],
        render_kw={"placeholder": "Car loan, personal loan, credit card, etc."},
    )
    # ── Step 2: Employment ─────────────────────────────────────────
    employment_status = SelectField(
        "Employment Status",
        choices=[
            ("", "— Select —"),
            ("employed", "Employed"),
            ("ofw-landbased", "OFW - LandBased"),
            ("ofw-seafarer", "OFW - Seaferer"),
            ("licensed-professional", "Licensed Professional"),
            ("with-financial-support", "With Financial Support"),
            ("with-attorney-in-fact", "With Attorney In-Fact"),
            ("with-co-borrower", "With Co-Borrower"),
        ],
        validators=[DataRequired(message="Please select your employment status.")],
    )
    tenure_months = IntegerField(
        "Tenure (months)",
        validators=[Optional(), NumberRange(min=0, max=600)],
        render_kw={"placeholder": "e.g. 24 (= 2 years)"},
    )
    age = IntegerField(
        "Age",
        validators=[
            DataRequired(),
            NumberRange(min=18, max=80, message="Age must be between 18 and 80."),
        ],
        render_kw={"placeholder": "e.g. 28"},
    )

    # ── Step 3: Model Preferences ──────────────────────────────────────────
    preferred_type = SelectField(
        "Model Type",
        choices=[
            ("", "Any model (optional)"),
        ],
        default="",
        validators=[Optional()],
    )
    budget_min = DecimalField(
        "Minimum Budget (₱)",
        places=2,
        default=0,
        validators=[DataRequired(message="Minimum budget is required."), NumberRange(min=1, message="Minimum budget must be greater than 0.")],
        render_kw={"placeholder": "e.g. 1500000.00"},
    )
    budget_max = DecimalField(
        "Maximum Budget (₱)",
        places=2,
        default=0,
        validators=[DataRequired(message="Maximum budget is required."), NumberRange(min=1, message="Maximum budget must be greater than 0.")],
        render_kw={"placeholder": "e.g. 4000000.00"},
    )

    submit = SubmitField("Submit & View Results")

    def validate_budget_max(self, field):
        min_budget = self.budget_min.data or 0
        max_budget = field.data or 0
        if max_budget < min_budget:
            raise ValidationError("Maximum budget must be greater than or equal to minimum budget.")
