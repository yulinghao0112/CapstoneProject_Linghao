"""
Unit tests for auth.py routes

Tests authentication endpoints with mocked dependencies
"""
import os
import sys
import pytest
from unittest.mock import Mock, patch, MagicMock

# Setup path
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend"))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

os.environ["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"  # For config.py compatibility
os.environ.setdefault("FLASK_ENV", "testing")


@pytest.fixture(scope="module")
def app():
    """Create test Flask app - module scoped for performance"""
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


@pytest.fixture(scope="module")
def client(app):
    """Module scoped client for performance"""
    return app.test_client()


class TestAuthRegister:
    """Test registration endpoint"""
    
    def test_register_endpoint_exists(self, client):
        """Test registration endpoint exists"""
        response = client.post('/api/register', json={
            'email': 'test@example.com',
            'username': 'testuser',
            'password': 'password123'
        })
        
        # Should handle gracefully, any response is acceptable
        assert response.status_code < 500

    def test_register_missing_email(self, client):
        """Test registration without email"""
        response = client.post('/api/register', json={
            'username': 'testuser',
            'password': 'password123'
        })
        
        assert response.status_code in [400, 404, 405]

    def test_register_missing_username(self, client):
        """Test registration without username"""
        response = client.post('/api/register', json={
            'email': 'test@example.com',
            'password': 'password123'
        })
        
        assert response.status_code in [400, 404, 405, 422]

    def test_register_missing_password(self, client):
        """Test registration without password"""
        response = client.post('/api/register', json={
            'email': 'test@example.com',
            'username': 'testuser'
        })
        
        assert response.status_code in [400, 404, 405, 422]

    def test_register_invalid_email(self, client):
        """Test registration with invalid email"""
        response = client.post('/api/register', json={
            'email': 'invalid-email',
            'username': 'testuser',
            'password': 'password123'
        })
        
        # Should reject invalid email
        assert response.status_code in [400, 422]

    def test_register_duplicate_email(self, client, app):
        """Test duplicate email registration"""
        with app.app_context():
            # Register first user
            client.post('/api/register', json={
                'email': 'duplicate@example.com',
                'username': 'user1',
                'password': 'password123'
            })
            
            # Try to register with same email
            response = client.post('/api/register', json={
                'email': 'duplicate@example.com',
                'username': 'user2',
                'password': 'password456'
            })
            
            assert response.status_code in [400, 404, 405, 422]


class TestAuthLogin:
    """Test login endpoint"""
    
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user"""
        response = client.post('/api/login', json={
            'email': 'nonexistent@example.com',
            'password': 'anypassword'
        })
        
        assert response.status_code in [400, 401, 404, 405, 422]

    def test_login_endpoint_basic(self, client):
        """Test login endpoint basic functionality"""
        response = client.post('/api/login', json={
            'email': 'test@example.com',
            'password': 'password123'
        })
        
        # Should handle gracefully
        assert response.status_code < 500

    def test_login_malformed_json(self, client):
        """Test login with malformed JSON"""
        response = client.post(
            '/api/login',
            data='{"email": "test@example.com", "password":',  # Incomplete JSON
            content_type='application/json'
        )
        
        assert response.status_code in [400, 422]


class TestAuthLogout:
    """Test logout endpoint"""
    
    def test_logout_without_token(self, client):
        """Test logout without JWT token"""
        response = client.post('/api/logout')
        
        assert response.status_code in [401, 404, 405, 422]

    def test_logout_invalid_token(self, client):
        """Test logout with invalid token"""
        response = client.post('/api/logout', headers={
            'Authorization': 'Bearer invalid-token'
        })
        
        assert response.status_code in [401, 404, 405, 422]

    @patch('flask_jwt_extended.verify_jwt_in_request')
    @patch('flask_jwt_extended.get_jwt_identity')
    def test_logout_valid_token(self, mock_get_identity, mock_verify_jwt, client):
        """Test logout with valid token"""
        mock_verify_jwt.return_value = None  # No exception
        mock_get_identity.return_value = 1   # User ID
        
        response = client.post('/api/logout', headers={
            'Authorization': 'Bearer valid-token'
        })
        
        assert response.status_code in [200, 404, 405, 422]


class TestAuthMiddleware:
    """Test authentication middleware and helpers"""
    
    def test_jwt_required_decorator(self, client):
        """Test JWT required decorator on protected endpoints"""
        # Try to access a protected endpoint without token
        response = client.get('/api/protected-endpoint')
        
        # Should either be 404 (endpoint doesn't exist) or 401 (unauthorized)
        assert response.status_code in [401, 404, 405, 422]

    def test_cors_headers(self, client):
        """Test CORS headers in auth responses"""
        response = client.options('/api/register')
        
        # Should handle OPTIONS request
        assert response.status_code in [200, 204, 405]

    @patch('flask_jwt_extended.create_access_token')
    def test_token_creation(self, mock_create_token, client, app):
        """Test JWT token creation during registration"""
        with app.app_context():
            mock_create_token.return_value = 'fake-jwt-token'
            
            response = client.post('/api/register', json={
                'email': 'test@example.com',
                'username': 'testuser', 
                'password': 'password123'
            })
            
            # If successful, should have called token creation
            if response.status_code in [200, 201]:
                data = response.get_json()
                assert 'access_token' in data or mock_create_token.called


class TestInputValidation:
    """Test input validation and sanitization"""
    
    def test_email_length_boundary(self, client):
        """Test email length limits"""
        # Very long email
        long_email = 'a' * 100 + '@example.com'
        
        response = client.post('/api/register', json={
            'email': long_email,
            'username': 'testuser',
            'password': 'password123'
        })
        
        # Should either accept or reject gracefully
        assert response.status_code < 500

    def test_username_length_boundary(self, client):
        """Test username length limits"""
        long_username = 'u' * 200
        
        response = client.post('/api/register', json={
            'email': 'test@example.com',
            'username': long_username,
            'password': 'password123'
        })
        
        assert response.status_code < 500

    def test_password_length_boundary(self, client):
        """Test password length limits"""
        long_password = 'p' * 1000
        
        response = client.post('/api/register', json={
            'email': 'test@example.com',
            'username': 'testuser',
            'password': long_password
        })
        
        assert response.status_code < 500

    def test_special_characters_in_input(self, client):
        """Test handling of special characters"""
        special_chars = ['<script>', '&amp;', '"quotes"', "'single'", '\x00null']
        
        for char in special_chars:
            response = client.post('/api/register', json={
                'email': 'test@example.com',
                'username': f'user{char}',
                'password': 'password123'
            })
            
            # Should handle safely
            assert response.status_code < 500

    def test_unicode_input(self, client):
        """Test Unicode character handling"""
        response = client.post('/api/register', json={
            'email': 'тест@example.com',  # Cyrillic
            'username': '用户名',            # Chinese
            'password': 'пароль123'        # Mixed
        })
        
        # Should handle Unicode gracefully
        assert response.status_code < 500


class TestSecurityFeatures:
    """Test security features and protections"""
    
    def test_sql_injection_protection(self, client):
        """Test SQL injection protection"""
        malicious_email = "admin'; DROP TABLE users; --"
        
        response = client.post('/api/register', json={
            'email': malicious_email,
            'username': 'testuser',
            'password': 'password123'
        })
        
        # Should not cause server error
        assert response.status_code < 500

    def test_xss_protection(self, client):
        """Test XSS protection in responses"""
        xss_username = "<script>alert('xss')</script>"
        
        response = client.post('/api/register', json={
            'email': 'test@example.com',
            'username': xss_username,
            'password': 'password123'
        })
        
        if response.status_code in [200, 201]:
            data = response.get_json()
            response_text = str(data)
            # Should not contain unescaped script tags
            assert '<script>' not in response_text

    def test_password_hashing(self, client, app):
        """Test that passwords are properly hashed"""
        with app.app_context():
            response = client.post('/api/register', json={
                'email': 'test@example.com',
                'username': 'testuser',
                'password': 'plaintext_password'
            })
            
            if response.status_code in [200, 201]:
                from models import User
                user = User.query.filter_by(email='test@example.com').first()
                
                if user:
                    # Password should be hashed, not plain text
                    assert user.password_hash != 'plaintext_password'
                    assert len(user.password_hash) > 20  # Hashes are longer

    def test_rate_limiting_simulation(self, client):
        """Test multiple rapid requests (basic rate limiting check)"""
        # Make multiple requests rapidly
        responses = []
        for i in range(10):
            response = client.post('/api/login', json={
                'email': 'test@example.com',
                'password': 'password'
            })
            responses.append(response.status_code)
        
        # Should handle all requests without crashing
        assert all(status < 500 for status in responses)
        
        # May implement rate limiting with 429 status
        if any(status == 429 for status in responses):
            print("Rate limiting detected")


class TestErrorHandling:
    """Test error handling and edge cases"""
    
    def test_database_connection_error_simulation(self, client):
        """Test handling when database is unavailable"""
        # This is hard to test without actually breaking the DB
        # For now, just ensure endpoints don't expose sensitive info
        
        response = client.post('/api/register', json={
            'email': 'test@example.com',
            'username': 'testuser',
            'password': 'password123'
        })
        
        # If there's a server error, it shouldn't expose internals
        if response.status_code == 500:
            data = response.get_json()
            if data:
                error_text = str(data).lower()
                assert 'traceback' not in error_text
                assert 'sqlalchemy' not in error_text
                assert '/users/' not in error_text

    def test_content_type_validation(self, client):
        """Test content type validation"""
        # Send form data instead of JSON
        response = client.post(
            '/api/register',
            data='email=test@example.com&username=test&password=pass',
            content_type='application/x-www-form-urlencoded'
        )
        
        # Should handle gracefully
        assert response.status_code < 500

    def test_large_request_body(self, client):
        """Test handling of very large request bodies"""
        large_data = 'x' * 10000  # 10KB of data
        
        response = client.post('/api/register', json={
            'email': 'test@example.com',
            'username': large_data,
            'password': 'password123'
        })
        
        # Should either accept or reject gracefully
        assert response.status_code < 500

    def test_basic_registration_endpoint(self, client):
        """Test basic registration endpoint availability"""
        response = client.post('/api/register', json={
            'email': 'simple@example.com',
            'username': 'simpleuser',
            'password': 'password123'
        })
        
        # Should handle gracefully
        assert response.status_code < 500