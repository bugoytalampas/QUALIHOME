from datetime import datetime, timedelta, timezone
from decimal import Decimal
import os
import smtplib
import ssl
from email.message import EmailMessage
from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app, session, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.utils import secure_filename
from ..models import db, User, UserProfile, QualificationResult, ActivityLog, Property, SystemConfig, log_activity
from .forms import LoginForm, RegistrationForm, ForgotPasswordForm, ResetPasswordForm
from ..ml import c50_engine

auth_bp = Blueprint("auth", __name__)

# -- Helpers -------------------------------------------------------------------

def _dashboard_url(role: str) -> str:
    routes = {
        "admin":  "main.admin_dashboard",
        "agent":  "main.agent_dashboard",
        "client": "main.client_dashboard",
    }
    return url_for(routes.get(role, "main.client_dashboard"))


def _reset_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])


def _make_reset_token(user: User) -> str:
    payload = {"uid": user.id, "ph": user.password_hash}
    return _reset_serializer().dumps(payload, salt="password-reset")


def _verify_reset_token(token: str, max_age: int = 3600) -> User | None:
    try:
        data = _reset_serializer().loads(token, salt="password-reset", max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    uid = data.get("uid")
    ph = data.get("ph")
    if not uid or not ph:
        return None
    user = db.session.get(User, int(uid))
    if not user:
        return None
    if user.password_hash != ph:
        return None
    return user


def _get_security_int(key: str, fallback: int) -> int:
    try:
        rec = SystemConfig.query.filter_by(key=key).first()
        if rec and str(rec.value).strip():
            value = int(float(rec.value))
            if key == "min_password_length":
                value = max(value, 8)
            config_map = {
                "max_login_attempts": "MAX_LOGIN_ATTEMPTS",
                "max_forgot_password_attempts": "MAX_FORGOT_PASSWORD_ATTEMPTS",
                "session_timeout_mins": "SESSION_TIMEOUT_MINS",
                "min_password_length": "MIN_PASSWORD_LENGTH",
            }
            mapped = config_map.get(key)
            if mapped:
                current_app.config[mapped] = value
            return value
    except Exception:
        pass
    value = int(current_app.config.get({
        "max_login_attempts": "MAX_LOGIN_ATTEMPTS",
        "max_forgot_password_attempts": "MAX_FORGOT_PASSWORD_ATTEMPTS",
        "session_timeout_mins": "SESSION_TIMEOUT_MINS",
        "min_password_length": "MIN_PASSWORD_LENGTH",
    }.get(key, ""), fallback))
    if key == "min_password_length":
        value = max(value, 8)
        current_app.config["MIN_PASSWORD_LENGTH"] = value
    return value


def _send_reset_email(to_email: str, reset_url: str) -> tuple[bool, str | None]:
    cfg = current_app.config
    server = (cfg.get("MAIL_SERVER") or "").strip()
    username = (cfg.get("MAIL_USERNAME") or "").strip()
    password = cfg.get("MAIL_PASSWORD") or ""
    from_addr = (cfg.get("MAIL_FROM") or username or "no-reply@qualihome.local").strip()
    if not server or not username or not password:
        return False, "Missing SMTP configuration (server/username/password)."

    subject = "QUALIHOME Password Reset"
    text_body = (
        "We received a request to reset your QUALIHOME password.\n\n"
        f"Open this link to reset your password:\n{reset_url}\n\n"
        "This link expires in 1 hour. If you did not request this, you can ignore this email."
    )
    html_body = (
        "<p>We received a request to reset your <strong>QUALIHOME</strong> password.</p>"
        f"<p><a href=\"{reset_url}\">Reset your password</a></p>"
        "<p>This link expires in <strong>1 hour</strong>. If you did not request this, you can ignore this email.</p>"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    port = int(cfg.get("MAIL_PORT", 587))
    use_ssl = bool(cfg.get("MAIL_USE_SSL", False))
    use_tls = bool(cfg.get("MAIL_USE_TLS", True))
    try:
        if use_ssl:
            with smtplib.SMTP_SSL(server, port, context=ssl.create_default_context(), timeout=15) as smtp:
                smtp.login(username, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(server, port, timeout=15) as smtp:
                smtp.ehlo()
                if use_tls:
                    smtp.starttls(context=ssl.create_default_context())
                    smtp.ehlo()
                smtp.login(username, password)
                smtp.send_message(msg)
        return True, None
    except Exception as exc:
        current_app.logger.exception("Failed to send password reset email.")
        return False, str(exc)


def _compute_result(gross_income: float, monthly_debt: float,
                    employment_type: str = "employed",
                    tenure_months: int = 0, age: int = 30,
                    dependents: int = 0):
    """Runs the same C5.0 ML engine used by the dashboard re-assessment."""
    status, dti, max_loanable, similarity_score, factors_json = c50_engine.predict(
        gross_income    = gross_income,
        monthly_loans   = monthly_debt,
        tenure_months   = tenure_months,
        employment_type = employment_type,
        age             = age,
        dependents      = dependents,
    )
    return status, dti, max_loanable, similarity_score, factors_json


def _get_live_meter_criteria() -> dict:
    """Fetch qualification criteria needed by the registration live meter."""
    defaults = {
        "dti_qualified_max": 35.0,
        "dti_conditional_max": 42.0,
        "min_tenure_months": 6,
        "stability_employed": 5,
        "stability_ofw_landbased": 4,
        "stability_ofw_seafarer": 4,
        "stability_licensed_professional": 5,
        "stability_with_financial_support": 3,
        "stability_with_attorney_in_fact": 3,
        "stability_with_co_borrower": 4,
    }

    def _float_val(key: str) -> float:
        rec = SystemConfig.query.filter_by(key=key).first()
        if not rec:
            return float(defaults[key])
        try:
            return float(rec.value)
        except (TypeError, ValueError):
            return float(defaults[key])

    def _int_val(key: str) -> int:
        return int(round(_float_val(key)))

    return {
        "dti_qualified_max": _float_val("dti_qualified_max"),
        "dti_conditional_max": _float_val("dti_conditional_max"),
        "min_tenure_months": _int_val("min_tenure_months"),
        "stability_scores": {
            "employed": _int_val("stability_employed"),
            "ofw-landbased": _int_val("stability_ofw_landbased"),
            "ofw-seafarer": _int_val("stability_ofw_seafarer"),
            "licensed-professional": _int_val("stability_licensed_professional"),
            "with-financial-support": _int_val("stability_with_financial_support"),
            "with-attorney-in-fact": _int_val("stability_with_attorney_in_fact"),
            "with-co-borrower": _int_val("stability_with_co_borrower"),
        },
    }


ALLOWED_DOC_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
MAX_DOC_BYTES = 10 * 1024 * 1024


def _read_registration_doc(file_obj) -> dict | None:
    if not file_obj or not getattr(file_obj, "filename", ""):
        return None

    original = secure_filename(file_obj.filename or "")
    ext = os.path.splitext(original)[1].lower()
    if ext not in ALLOWED_DOC_EXTS:
        raise ValueError("Invalid file type. Allowed: JPG, JPEG, PNG, WEBP, PDF.")
    payload = file_obj.read()
    if not payload:
        return None
    if len(payload) > MAX_DOC_BYTES:
        raise ValueError("Document is too large. Maximum file size is 10 MB.")
    return {
        "filename": original,
        "mimetype": (file_obj.mimetype or "application/octet-stream"),
        "data": payload,
    }


# -- Login --------------------------------------------------------------------

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(_dashboard_url(current_user.role))

    form = LoginForm()
    if request.method == "POST":
        if form.validate_on_submit():
            email_key = f"_login_fails_{form.email.data.lower().strip()}"
            attempts  = session.get(email_key, 0)
            max_attempts = _get_security_int("max_login_attempts", 5)
            if attempts >= max_attempts:
                flash("Too many failed login attempts. Please wait a few minutes before trying again.", "danger")
                return redirect(url_for("auth.login"))

            user = User.query.filter_by(email=form.email.data.lower()).first()
            if user and user.check_password(form.password.data):
                if not user.is_active:
                    flash("Your account has been deactivated. Please contact support.", "danger")
                    return redirect(url_for("auth.login"))
                session.pop(email_key, None)  # Clear failed-attempt counter on success
                login_user(user, remember=form.remember.data)
                try:
                    log_activity("login", f"{user.full_name} signed in.", actor=user)
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                next_page = request.args.get("next")
                flash(f"Welcome back, {user.first_name}!", "success")
                return redirect(next_page or _dashboard_url(user.role))
            session[email_key] = attempts + 1
            flash("Invalid email or password. Please try again.", "danger")
        else:
            flash("Please enter your email and password.", "warning")
        return redirect(url_for("auth.login"))

    fp_form = ForgotPasswordForm()
    return render_template("auth/login.html", form=form, fp_form=fp_form, title="Sign In")


# -- Register (Get Qualified) --------------------------------------------------

@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(_dashboard_url(current_user.role))

    form = RegistrationForm()
    available_models = (db.session.query(Property.name)
                        .filter(Property.status == "available")
                        .filter(db.or_(Property.approval_status == "approved", Property.approval_status.is_(None)))
                        .order_by(Property.name.asc())
                        .all())
    model_names = sorted({(name or "").strip() for (name,) in available_models if (name or "").strip()}, key=lambda x: x.lower())
    form.preferred_type.choices = [("", "Any model (optional)")] + [(name, name) for name in model_names]
    live_meter_cfg = _get_live_meter_criteria()
    if form.validate_on_submit():
        valid_id_file = request.files.get("valid_id_file")
        income_proof_file = request.files.get("income_proof_file")

        try:
            valid_id_doc = _read_registration_doc(valid_id_file)
            income_proof_doc = _read_registration_doc(income_proof_file)
        except ValueError as exc:
            flash(str(exc), "danger")
            return render_template("auth/register.html", form=form, live_meter_cfg=live_meter_cfg, title="Get Qualified")

        # 1. Create User
        user = User(
            first_name     = form.first_name.data.strip(),
            middle_name    = (form.middle_name.data or "").strip() or None,
            last_name      = form.last_name.data.strip(),
            username       = form.username.data.strip(),
            email          = form.email.data.lower().strip(),
            contact_number = form.contact_number.data.strip(),
            role           = "client",
        )
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.flush()   # generates user.id before commit

        # 3. Create normalized profile
        gross  = float(form.gross_monthly_income.data or 0)
        debt   = float(form.monthly_debt_loans.data   or 0)

        profile = UserProfile(
            user_id               = user.id,
            civil_status          = form.civil_status.data,
            citizenship           = form.citizenship.data,
            gender                = form.gender.data,
            dependents            = form.dependents.data,
            birth_date            = form.birth_date.data,
            gross_income          = form.gross_monthly_income.data,
            monthly_loans         = form.monthly_debt_loans.data or Decimal("0"),
            employment_type       = form.employment_status.data,
            tenure_months         = form.tenure_months.data or 0,
            sss_gsis_umid         = (form.sss_gsis_umid.data or "").strip() or None,
            tin_no                = (form.tin_no.data or "").strip() or None,
            age                   = form.age.data,
            preferred_type        = (((form.preferred_type.data or "").strip()[:40]) or None),
            budget_min            = form.budget_min.data or Decimal("0"),
            budget_max            = form.budget_max.data or Decimal("0"),
            has_valid_id          = (form.has_valid_id.data == "yes"),
            has_income_proof      = (form.has_income_proof.data == "yes"),
            valid_id_data         = valid_id_doc["data"] if valid_id_doc else None,
            valid_id_mimetype     = valid_id_doc["mimetype"] if valid_id_doc else None,
            valid_id_filename     = valid_id_doc["filename"] if valid_id_doc else None,
            income_proof_data     = income_proof_doc["data"] if income_proof_doc else None,
            income_proof_mimetype = income_proof_doc["mimetype"] if income_proof_doc else None,
            income_proof_filename = income_proof_doc["filename"] if income_proof_doc else None,
        )
        db.session.add(profile)

        # 5. Compute qualification result using the full ML engine
        status, dti, max_loanable, score, factors_json = _compute_result(
            gross_income    = gross,
            monthly_debt    = debt,
            employment_type = form.employment_status.data or "employed",
            tenure_months   = int(form.tenure_months.data or 0),
            age             = int(form.age.data or 30),
            dependents      = int(form.dependents.data or 0),
        )
        result = QualificationResult(
            user_id          = user.id,
            status           = status,
            dti_ratio        = dti,
            max_loanable     = max_loanable,
            similarity_score = score,
            assessment_mode  = "new",
            factors_json     = factors_json,
        )
        db.session.add(result)
        proof_summary = []
        proof_summary.append("valid ID uploaded" if valid_id_doc else "valid ID declared")
        proof_summary.append("income proof uploaded" if income_proof_doc else "income proof declared")
        log_activity(
            "register_documents",
            f"Registration declarations captured ({', '.join(proof_summary)}).",
            actor=user,
        )
        log_activity("assessment",
                 f"Assessment submitted — {status} (DTI: {dti:.1f}%).",
                 actor=user)
        log_activity("register",
                     f"New client {user.full_name} registered. Assessment: {status} (DTI: {dti:.1f}%).",
                     actor=user)
        db.session.commit()

        # 6. Show result page (user must sign in manually)
        flash(f"Account created! Sign in to access your dashboard, {user.first_name}.", "success")
        return render_template("auth/register.html",
                               result=result,
                               user_name=user.first_name,
                               live_meter_cfg=live_meter_cfg,
                               title="Registration Complete")

    return render_template("auth/register.html", form=form, live_meter_cfg=live_meter_cfg, title="Get Qualified")


@auth_bp.route("/register/check-field")
def register_check_field():
    field = (request.args.get("field") or "").strip().lower()
    value = (request.args.get("value") or "").strip()

    if field not in {"username", "email"}:
        return jsonify(ok=False, error="Invalid field"), 400

    if not value:
        return jsonify(ok=True, available=True, exists=False)

    if field == "username":
        exists = User.query.filter_by(username=value).first() is not None
    else:
        exists = User.query.filter_by(email=value.lower()).first() is not None

    return jsonify(ok=True, available=(not exists), exists=exists)


# -- Logout -------------------------------------------------------------------

@auth_bp.route("/logout")
@login_required
def logout():
    try:
        log_activity("logout", f"{current_user.full_name} signed out.")
        db.session.commit()
    except Exception:
        db.session.rollback()
    logout_user()
    flash("You have been signed out.", "info")
    return redirect(url_for("main.index"))


# -- Forgot Password (placeholder) --------------------------------------------

@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    form = ForgotPasswordForm()
    is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
    if request.method == "POST":
        if form.validate_on_submit():
            email = form.email.data.lower().strip()
            user = User.query.filter_by(email=email).first()
            reset_url = None
            sent = False
            mail_error = None
            if user:
                max_forgot = _get_security_int("max_forgot_password_attempts", 5)
                now = datetime.now(timezone.utc)
                window_start = user.forgot_password_window_started_at
                if window_start and window_start.tzinfo is None:
                    window_start = window_start.replace(tzinfo=timezone.utc)
                if not window_start or now - window_start >= timedelta(hours=1):
                    user.forgot_password_attempts = 0
                    user.forgot_password_window_started_at = now
                if user.forgot_password_attempts >= max_forgot:
                    log_activity(
                        "forgot_password_blocked",
                        f"Forgot-password blocked for {user.email} after reaching the {max_forgot}/hour limit.",
                        actor=user,
                    )
                    db.session.commit()
                    if is_ajax:
                        debug_error = "Forgot-password request limit reached for this account." if current_app.debug else None
                        return jsonify({"ok": True, "mail_sent": False, "reset_url": None, "mail_error": debug_error})
                    flash("If that email is registered, a reset link has been sent.", "info")
                    return redirect(url_for("auth.login"))
                token = _make_reset_token(user)
                reset_url = url_for("auth.reset_password", token=token, _external=True)
                sent, mail_error = _send_reset_email(email, reset_url)
                user.forgot_password_attempts = int(user.forgot_password_attempts or 0) + 1
                if not user.forgot_password_window_started_at:
                    user.forgot_password_window_started_at = now
                log_activity(
                    "forgot_password",
                    f"Forgot-password requested for {user.email}. Delivery: {'sent' if sent else 'fallback'}.",
                    actor=user,
                )
                db.session.commit()
                if sent:
                    current_app.logger.info("Password reset email sent to %s via SMTP.", email)
                else:
                    current_app.logger.warning("Password reset email fallback mode for %s (SMTP not sent). Link: %s", email, reset_url)
            if is_ajax:
                # Only expose link in development fallback when email was not sent.
                dev_link = reset_url if (reset_url and not sent) else None
                debug_error = (mail_error if (not sent and current_app.debug) else None)
                return jsonify({"ok": True, "mail_sent": bool(sent), "reset_url": dev_link, "mail_error": debug_error})
            flash("If that email is registered, a reset link has been sent.", "info")
            if reset_url and not sent and current_app.debug:
                flash(f"Dev reset link: {reset_url}", "warning")
            return redirect(url_for("auth.login"))
        else:
            if is_ajax:
                errors = {f: errs for f, errs in form.errors.items()}
                return jsonify({"ok": False, "errors": errors}), 422
            flash("Please enter a valid email address.", "warning")
            return redirect(url_for("auth.login"))
    return render_template("auth/forgot_password.html", form=form, title="Forgot Password")


@auth_bp.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token):
    if current_user.is_authenticated:
        # Allow reset links to work consistently even if a user is already signed in.
        logout_user()
        session.clear()
        flash("Please set your new password, then sign in again.", "info")

    user = _verify_reset_token(token)
    if not user:
        flash("This password reset link is invalid or has expired.", "danger")
        return redirect(url_for("auth.login"))

    form = ResetPasswordForm()
    if form.validate_on_submit():
        min_length = max(_get_security_int("min_password_length", 8), 8)
        if len(form.password.data or "") < min_length:
            form.password.errors.append(f"Password must be at least {min_length} characters.")
            return render_template("auth/reset_password.html", form=form, token=token, title="Reset Password")
        user.set_password(form.password.data)
        user.forgot_password_attempts = 0
        user.forgot_password_window_started_at = None
        log_activity("password_reset", f"Password reset completed for {user.email}.", actor=user)
        db.session.commit()
        flash("Your password has been reset. You can now sign in.", "success")
        return redirect(url_for("auth.login"))

    return render_template("auth/reset_password.html", form=form, token=token, title="Reset Password")
