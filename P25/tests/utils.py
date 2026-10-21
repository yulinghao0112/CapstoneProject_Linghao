"""
Test Utilities

Common utility functions for all test suites
Integrated from team member's utilities
"""

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


def create_test_user(client, email="test@example.com", username="testuser", password="testpass"):
    """Create a test user for testing purposes"""
    return register(client, email=email, username=username, password=password)


def authenticate_user(client, email="test@example.com", password="testpass"):
    """Authenticate a user and return login response"""
    return login(client, email=email, password=password)


def create_and_login_user(client, email="test@example.com", username="testuser", password="testpass"):
    """Convenience function to create and login a user"""
    register_response = create_test_user(client, email=email, username=username, password=password)
    login_response = authenticate_user(client, email=email, password=password)
    return register_response, login_response


def extract_jwt_token(login_response):
    """Extract JWT token from login response"""
    if login_response.status_code in [200, 201]:
        data = login_response.get_json()
        return data.get('access_token') or data.get('token')
    return None


def make_authenticated_request(client, method, url, token, **kwargs):
    """Make an authenticated request with JWT token"""
    headers = kwargs.get('headers', {})
    headers['Authorization'] = f'Bearer {token}'
    kwargs['headers'] = headers
    
    return getattr(client, method.lower())(url, **kwargs)