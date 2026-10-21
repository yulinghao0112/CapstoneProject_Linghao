"""
E2E Test Configuration

Shared fixtures and configuration for end-to-end tests
"""
import pytest
import os
import sys
import requests
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options


def pytest_configure(config):
    """Configure pytest for E2E tests"""
    # Add custom markers
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running test"
    )


@pytest.fixture(scope="session")
def check_services():
    """Check if required services are running"""
    services = {
        'frontend': 'http://localhost:3000',
        'backend': 'http://localhost:5002/api/debug/config'
    }
    
    service_status = {}
    
    for service_name, url in services.items():
        try:
            response = requests.get(url, timeout=5)
            service_status[service_name] = response.status_code < 400
        except:
            service_status[service_name] = False
    
    return service_status


@pytest.fixture(scope="module")
def browser_options():
    """Chrome browser options for E2E testing"""
    options = Options()
    
    # Run in headless mode for CI/CD
    options.add_argument("--headless")
    
    # Security and performance settings
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-web-security")
    options.add_argument("--ignore-certificate-errors")
    
    # Window settings
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--start-maximized")
    
    # Performance settings
    options.add_argument("--disable-images")
    options.add_argument("--disable-javascript")  # Remove this if JS is needed
    options.add_argument("--disable-plugins")
    
    return options


@pytest.fixture(scope="function")
def clean_browser(browser_options):
    """Provide a clean browser instance for each test"""
    driver = None
    
    try:
        driver = webdriver.Chrome(options=browser_options)
        driver.implicitly_wait(10)
        driver.delete_all_cookies()
        yield driver
    except Exception as e:
        pytest.skip(f"Chrome browser not available: {e}")
    finally:
        if driver:
            driver.quit()


@pytest.fixture(scope="session") 
def test_data():
    """Test data for E2E tests"""
    return {
        'demo_user': {
            'email': '11@qq.com',
            'password': '123'
        },
        'test_user': {
            'email': 'test@example.com',
            'username': 'testuser',
            'password': 'password123'
        },
        'invalid_user': {
            'email': 'invalid@example.com',
            'password': 'wrongpassword'
        },
        'test_meeting': {
            'title': 'E2E Test Meeting',
            'description': 'Meeting created during E2E testing'
        },
        'test_message': {
            'content': 'Hello, this is an E2E test message!'
        }
    }


@pytest.fixture
def wait_for_page_load():
    """Helper function to wait for page load"""
    def _wait(driver, timeout=10):
        """Wait for page to be ready"""
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.common.by import By
        
        try:
            # Wait for body element to be present
            WebDriverWait(driver, timeout).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Wait for document ready state
            WebDriverWait(driver, timeout).until(
                lambda driver: driver.execute_script("return document.readyState") == "complete"
            )
            
            # Additional wait for React to render
            time.sleep(1)
            
        except Exception:
            # If waiting fails, continue anyway
            pass
    
    return _wait


@pytest.fixture
def screenshot_on_failure(request, clean_browser):
    """Take screenshot on test failure"""
    yield clean_browser
    
    if hasattr(request.node, 'rep_call') and request.node.rep_call.failed:
        # Take screenshot on failure
        try:
            screenshot_dir = os.path.join(os.getcwd(), "test_screenshots")
            os.makedirs(screenshot_dir, exist_ok=True)
            
            screenshot_path = os.path.join(
                screenshot_dir, 
                f"failed_{request.node.name}_{int(time.time())}.png"
            )
            
            clean_browser.save_screenshot(screenshot_path)
            print(f"Screenshot saved: {screenshot_path}")
            
        except Exception as e:
            print(f"Could not save screenshot: {e}")


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Hook to capture test results for screenshot fixture"""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)


def pytest_collection_modifyitems(config, items):
    """Modify test collection for E2E tests"""
    # Add e2e marker to all tests in e2e directory
    for item in items:
        if "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)
        
        # Add slow marker to tests that might take longer
        if any(keyword in item.name.lower() for keyword in ['workflow', 'integration', 'full']):
            item.add_marker(pytest.mark.slow)


def pytest_runtest_setup(item):
    """Setup for each test"""
    # Skip E2E tests if not explicitly requested
    if hasattr(item, 'get_closest_marker'):
        e2e_marker = item.get_closest_marker("e2e")
        if e2e_marker and not item.config.getoption("--run-e2e", default=False):
            pytest.skip("E2E tests require --run-e2e flag")


def pytest_addoption(parser):
    """Add command line options for E2E tests"""
    parser.addoption(
        "--run-e2e",
        action="store_true",
        default=False,
        help="Run E2E tests (requires frontend and backend to be running)"
    )
    
    parser.addoption(
        "--headless",
        action="store_true", 
        default=True,
        help="Run browser in headless mode"
    )
    
    parser.addoption(
        "--browser-timeout",
        type=int,
        default=30,
        help="Browser timeout in seconds"
    )