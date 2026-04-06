"""SMARTQUALIHOME Flask entry point.

Run with:
    python run.py
or:
    flask run
"""
import os
from dotenv import load_dotenv

# Load project environment variables before importing the app package.
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
