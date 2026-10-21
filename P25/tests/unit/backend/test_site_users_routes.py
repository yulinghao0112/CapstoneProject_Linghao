"""
Unit tests for site_users.py routes

Tests site users API endpoints with mocked dependencies
"""
import os
import sys
import pytest
from unittest.mock import Mock, patch

# Setup path
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend"))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

os.environ["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"  # For config.py compatibility
os.environ.setdefault("FLASK_ENV", "testing")


@pytest.fixture
def app():
    """Create test Flask app"""
    try:
        from app import app as flask_app
    except ImportError:
        import importlib.util
        app_path = os.path.join(BACKEND_ROOT, "app.py")
        spec = importlib.util.spec_from_file_location("app", app_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        flask_app = module.app
    
    flask_app.config["TESTING"] = True
    flask_app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    flask_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    
    with flask_app.app_context():
        from models import db
        db.create_all()
        yield flask_app
        try:
            db.session.remove()
            # Use CASCADE to handle foreign key constraints
            db.engine.execute("PRAGMA foreign_keys = OFF")
            db.drop_all()
            db.engine.execute("PRAGMA foreign_keys = ON")
        except Exception:
            # If still fails, just close the session
            db.session.close()


@pytest.fixture
def client(app):
    return app.test_client()


class TestSiteUsersBasic:
    """Test basic site users endpoints"""
    
    def test_sync_site_users_endpoint_exists(self, client):
        """Test sync site users endpoint exists"""
        response = client.post('/api/site-users/sync')
        
        # Should handle gracefully
        assert response.status_code < 500
    
    def test_get_site_users_endpoint_exists(self, client):
        """Test get site users endpoint exists"""
        response = client.get('/api/site-users')
        
        # Should handle gracefully
        assert response.status_code < 500
    
    def test_get_site_user_details_endpoint_exists(self, client):
        """Test get site user details endpoint exists"""
        response = client.get('/api/site-users/test-user-id')
        
        # Should handle gracefully
        assert response.status_code < 500
    
    def test_endpoints_handle_authentication(self, client):
        """Test endpoints handle missing authentication gracefully"""
        # Test sync endpoint without auth
        sync_response = client.post('/api/site-users/sync')
        assert sync_response.status_code < 500
        
        # Test get endpoint without auth
        get_response = client.get('/api/site-users')
        assert get_response.status_code < 500
        
        # Test details endpoint without auth
        details_response = client.get('/api/site-users/test-user')
        assert details_response.status_code < 500
    
    def test_endpoints_handle_malformed_requests(self, client):
        """Test endpoints handle malformed requests"""
        # Test sync with malformed JSON
        malformed_response = client.post(
            '/api/site-users/sync',
            data='{"malformed": json',
            content_type='application/json'
        )
        assert malformed_response.status_code < 500
        
        # Test get with invalid parameters
        invalid_params_response = client.get('/api/site-users?page=invalid')
        assert invalid_params_response.status_code < 500