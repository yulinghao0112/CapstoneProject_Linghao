# Silence urllib3's NotOpenSSLWarning during tests - team member's optimization
import warnings
try:
    from urllib3.exceptions import NotOpenSSLWarning
    warnings.filterwarnings("ignore", category=NotOpenSSLWarning)
except Exception:
    warnings.filterwarnings(
        "ignore",
        message=r"urllib3 v2 only supports OpenSSL 1\.1\.1\+",
    )

"""
Integration Test Configuration

Enhanced with team member optimizations
"""
import os
import sys
import pytest

# Setup path for backend imports
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

# Enhanced environment setup from team member's conftest
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SQLALCHEMY_DATABASE_URI", "sqlite:///:memory:")
os.environ.setdefault("FLASK_ENV", "testing")
os.environ.setdefault("GEMINI_API_KEY", "dummy")  # Team member's configuration

@pytest.fixture(scope="session")
def app():
    """Enhanced app fixture with team member's improvements"""
    from app import app as flask_app, db
    flask_app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )
    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def db_session(app):
    """Database session fixture - team member's enhancement"""
    from models import db
    yield db.session
    db.session.rollback()

# Team member's test utility functions
def register(client, email="u@test.com", username="u1", password="pass"):
    """Register helper function from team member"""
    return client.post("/register", json={
        "email": email,
        "username": username,
        "password": password
    })

def login(client, email="u@test.com", password="pass"):
    """Login helper function from team member"""
    return client.post("/login", json={"email": email, "password": password})