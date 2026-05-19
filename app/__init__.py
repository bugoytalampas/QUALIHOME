from __future__ import annotations

import os
from datetime import datetime

from flask import Flask
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect

from .config import Config
from .models import User, db

login_manager = LoginManager()
csrf = CSRFProtect()


def _ensure_default_users(app: Flask) -> None:
	"""Create documented demo accounts when they do not yet exist."""
	default_users = [
		{
			"first_name": "System",
			"last_name": "Admin",
			"email": "admin@smartqualihome.com",
			"username": "admin",
			"role": "admin",
			"password": "Admin@2026!",
		},
		{
			"first_name": "Demo",
			"last_name": "Agent",
			"email": "agent@smartqualihome.com",
			"username": "agent",
			"role": "agent",
			"password": "Agent@2026!",
		},
		{
			"first_name": "Demo",
			"last_name": "Client",
			"email": "client@smartqualihome.com",
			"username": "client",
			"role": "client",
			"password": "Client@2026!",
		},
	]

	created = 0
	for item in default_users:
		existing = User.query.filter_by(email=item["email"]).first()
		if existing:
			continue

		user = User(
			first_name=item["first_name"],
			last_name=item["last_name"],
			email=item["email"],
			username=item["username"],
			role=item["role"],
			is_active=True,
		)
		user.set_password(item["password"])
		db.session.add(user)
		created += 1

	if not created:
		return

	try:
		db.session.commit()
		app.logger.info("Seeded %s default user account(s).", created)
	except Exception:
		db.session.rollback()
		app.logger.exception("Failed seeding default user accounts.")


def create_app(config_class=Config):
	app = Flask(__name__, instance_relative_config=True)
	app.config.from_object(config_class)

	# Ensure writable instance paths exist.
	os.makedirs(app.instance_path, exist_ok=True)
	os.makedirs(app.config.get("UPLOAD_FOLDER", os.path.join(app.instance_path, "uploads")), exist_ok=True)

	db.init_app(app)
	login_manager.init_app(app)
	csrf.init_app(app)

	login_manager.login_view = "auth.login"
	login_manager.login_message_category = "warning"

	@login_manager.user_loader
	def load_user(user_id: str):
		try:
			return db.session.get(User, int(user_id))
		except Exception:
			return None

	@app.template_filter("ph_datetime")
	def ph_datetime_filter(value, fmt="%b %d, %Y %I:%M %p"):
		if not value:
			return ""
		if isinstance(value, datetime):
			return value.strftime(fmt)
		return str(value)

	@app.template_filter("ph_time")
	def ph_time_filter(value):
		if not value:
			return ""
		try:
			return value.strftime("%I:%M %p")
		except Exception:
			return str(value)

	# Register blueprints that are available in the current workspace state.
	try:
		from .auth.routes import auth_bp
		app.register_blueprint(auth_bp)
	except Exception:
		pass

	try:
		from .client.routes import client_bp
		app.register_blueprint(client_bp)
	except Exception:
		pass

	try:
		from .main.routes import main_bp
		app.register_blueprint(main_bp)
	except Exception:
		pass

	# Warm up the in-memory C5.0 model on startup when enough data exists.
	try:
		with app.app_context():
			_ensure_default_users(app)
	except Exception:
		app.logger.exception("Default account bootstrap failed.")

	# Warm up the in-memory C5.0 model on startup when enough data exists.
	try:
		from .models import HistoricalBuyer
		from .ml import c50_engine
		with app.app_context():
			buyers = HistoricalBuyer.query.all()
			if len(buyers) >= 10:
				c50_engine.train(buyers)
				meta = c50_engine.get_meta()
				app.logger.info(
					"Startup C5.0 train complete: trained=%s samples=%s accuracy=%s",
					meta.get("trained", False),
					meta.get("n_samples", 0),
					meta.get("train_accuracy", "N/A"),
				)
			else:
				app.logger.warning(
					"Startup C5.0 skipped: only %s training records (need at least 10).",
					len(buyers),
				)
	except Exception:
		app.logger.exception("Startup C5.0 initialization failed; continuing with rule fallback.")

	# Fallback endpoint so app always boots even if a blueprint is unavailable.
	if "main.index" not in app.view_functions:
		@app.route("/")
		def _fallback_index():
			return "SMARTQUALIHOME is running."

	return app

