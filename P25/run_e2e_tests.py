#!/usr/bin/env python3
"""
End-to-End Test Automation Script
Automated E2E testing with environment diagnostics and dependency management
"""
import subprocess
import sys
import os
import time
import platform
import shutil
import requests
from datetime import datetime

def print_header(title):
    """Print formatted test section header"""
    print(f"\n{'='*80}")
    print(f"🧪 {title}")
    print(f"{'='*80}")

def print_subheader(subtitle):
    """Print formatted subsection header"""
    print(f"\n{'─'*60}")
    print(f"📋 {subtitle}")
    print(f"{'─'*60}")

def print_progress(message):
    """Print progress message"""
    print(f"⏳ {message}")

def print_success(message):
    """Print success message"""
    print(f"✅ {message}")

def print_warning(message):
    """Print warning message"""
    print(f"⚠️ {message}")

def print_error(message):
    """Print error message"""
    print(f"❌ {message}")

def check_python_version():
    """Check if Python version is compatible"""
    print_subheader("Python Environment Check")
    version = sys.version_info
    print(f"Python Version: {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 7):
        print_error("Python 3.7+ is required for E2E tests")
        return False
    
    print_success("Python version is compatible")
    return True

def check_system_info():
    """Display system information"""
    print_subheader("System Environment")
    print(f"Operating System: {platform.system()} {platform.release()}")
    print(f"Architecture: {platform.machine()}")
    print(f"Platform: {platform.platform()}")

def check_chrome_installation():
    """Check if Google Chrome is installed"""
    print_subheader("Google Chrome Detection")
    
    chrome_paths = {
        'Darwin': [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
        ],
        'Linux': [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser'
        ],
        'Windows': [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ]
    }
    
    system = platform.system()
    paths = chrome_paths.get(system, [])
    
    for path in paths:
        if os.path.exists(path):
            print_success(f"Chrome found at: {path}")
            try:
                # Try to get Chrome version
                result = subprocess.run([path, '--version'], 
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    print(f"Chrome Version: {result.stdout.strip()}")
                return True, path
            except:
                continue
    
    print_error("Google Chrome not found on system")
    print("Please install Google Chrome from: https://www.google.com/chrome/")
    return False, None

def check_chromedriver():
    """Check ChromeDriver installation and compatibility"""
    print_subheader("ChromeDriver Detection")
    
    # Check if chromedriver is in PATH
    chromedriver_path = shutil.which('chromedriver')
    
    if chromedriver_path:
        print_success(f"ChromeDriver found in PATH: {chromedriver_path}")
        try:
            result = subprocess.run(['chromedriver', '--version'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                print(f"ChromeDriver Version: {result.stdout.strip()}")
                return True, chromedriver_path
        except Exception as e:
            print_warning(f"ChromeDriver found but not executable: {e}")
    
    # Check common installation locations
    common_paths = [
        '/usr/local/bin/chromedriver',
        '/opt/homebrew/bin/chromedriver',
        './chromedriver',
        os.path.expanduser('~/Downloads/chromedriver'),
        os.path.expanduser('~/Downloads/chromedriver-mac-x64/chromedriver')
    ]
    
    for path in common_paths:
        if os.path.exists(path):
            try:
                result = subprocess.run([path, '--version'], 
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    print_success(f"ChromeDriver found at: {path}")
                    print(f"ChromeDriver Version: {result.stdout.strip()}")
                    return True, path
            except Exception as e:
                print_warning(f"ChromeDriver found at {path} but not executable: {e}")
                continue
    
    print_error("ChromeDriver not found")
    return False, None

def install_chromedriver_instructions():
    """Provide ChromeDriver installation instructions"""
    print_subheader("ChromeDriver Installation Instructions")
    
    system = platform.system()
    
    if system == 'Darwin':  # macOS
        print("For macOS:")
        print("1. Using Homebrew (recommended):")
        print("   brew install chromedriver")
        print()
        print("2. Manual installation:")
        print("   - Download from: https://chromedriver.chromium.org/")
        print("   - Extract and move to /usr/local/bin/")
        print("   - Run: xattr -d com.apple.quarantine /usr/local/bin/chromedriver")
    
    elif system == 'Linux':
        print("For Linux:")
        print("1. Using package manager:")
        print("   sudo apt-get install chromium-chromedriver  # Ubuntu/Debian")
        print("   sudo yum install chromedriver              # CentOS/RHEL")
        print()
        print("2. Manual installation:")
        print("   - Download from: https://chromedriver.chromium.org/")
        print("   - Extract and move to /usr/local/bin/")
    
    elif system == 'Windows':
        print("For Windows:")
        print("1. Manual installation:")
        print("   - Download from: https://chromedriver.chromium.org/")
        print("   - Extract and add to system PATH")
        print("   - Or place in same directory as script")
    
    print("\n⚠️ Important: ChromeDriver version must match your Chrome browser version!")

def check_python_dependencies():
    """Check required Python packages"""
    print_subheader("Python Dependencies Check")
    
    required_packages = [
        'pytest',
        'selenium', 
        'requests'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print_success(f"{package} is installed")
        except ImportError:
            print_error(f"{package} is missing")
            missing_packages.append(package)
    
    if missing_packages:
        print_warning("Installing missing packages...")
        try:
            subprocess.run([
                sys.executable, '-m', 'pip', 'install'
            ] + missing_packages, check=True, timeout=120)
            print_success("Missing packages installed successfully")
            return True
        except subprocess.CalledProcessError as e:
            print_error(f"Failed to install packages: {e}")
            return False
        except subprocess.TimeoutExpired:
            print_error("Package installation timed out")
            return False
    
    return True

def check_test_services():
    """Check if required services are running"""
    print_subheader("Test Services Check")
    
    services = {
        'Frontend (React)': 'http://localhost:3000',
        'Backend (Flask)': 'http://localhost:5002'
    }
    
    service_status = {}
    
    for service_name, url in services.items():
        try:
            response = requests.get(url, timeout=5)
            if response.status_code < 500:
                print_success(f"{service_name} is running at {url}")
                service_status[service_name] = True
            else:
                print_warning(f"{service_name} responded with status {response.status_code}")
                service_status[service_name] = False
        except requests.exceptions.ConnectionError:
            print_error(f"{service_name} is not running at {url}")
            service_status[service_name] = False
        except requests.exceptions.Timeout:
            print_warning(f"{service_name} request timed out at {url}")
            service_status[service_name] = False
        except Exception as e:
            print_error(f"Error checking {service_name}: {e}")
            service_status[service_name] = False
    
    return service_status

def run_environment_diagnostics():
    """Run complete environment diagnostics"""
    print_header("E2E TEST ENVIRONMENT DIAGNOSTICS")
    
    diagnostics_results = {
        'python_compatible': check_python_version(),
        'chrome_available': False,
        'chromedriver_available': False,
        'dependencies_ready': False,
        'services_running': {}
    }
    
    check_system_info()
    
    # Check Chrome installation
    chrome_available, chrome_path = check_chrome_installation()
    diagnostics_results['chrome_available'] = chrome_available
    
    # Check ChromeDriver
    chromedriver_available, chromedriver_path = check_chromedriver()
    diagnostics_results['chromedriver_available'] = chromedriver_available
    
    if not chromedriver_available:
        install_chromedriver_instructions()
    
    # Check Python dependencies
    diagnostics_results['dependencies_ready'] = check_python_dependencies()
    
    # Check test services
    diagnostics_results['services_running'] = check_test_services()
    
    return diagnostics_results

def run_e2e_tests(diagnostics_results):
    """Run E2E tests with proper error handling"""
    print_header("E2E TESTS EXECUTION")
    
    # Check if environment is ready
    if not diagnostics_results['python_compatible']:
        print_error("Python environment is not compatible")
        return False, 0, 1
    
    if not diagnostics_results['dependencies_ready']:
        print_error("Python dependencies are not ready")
        return False, 0, 1
    
    if not diagnostics_results['chrome_available']:
        print_error("Google Chrome is not available")
        print("E2E tests require Google Chrome browser")
        return False, 0, 1
    
    if not diagnostics_results['chromedriver_available']:
        print_error("ChromeDriver is not available")
        print("E2E tests require ChromeDriver to control Chrome browser")
        return False, 0, 1
    
    # Check services
    frontend_running = diagnostics_results['services_running'].get('Frontend (React)', False)
    backend_running = diagnostics_results['services_running'].get('Backend (Flask)', False)
    
    if not frontend_running:
        print_warning("Frontend service is not running - some tests may fail")
        print("Start frontend with: cd admin && npm start")
    
    if not backend_running:
        print_warning("Backend service is not running - some tests may fail")
        print("Start backend with: cd backend && python app.py")
    
    print_progress("Starting E2E test execution...")
    start_time = time.time()
    
    try:
        # Run E2E tests with pytest
        result = subprocess.run([
            'python', '-m', 'pytest', 'tests/e2e/', 
            '-v', '--tb=short', '--run-e2e'
        ], capture_output=True, text=True, timeout=600)  # 10 minute timeout
        
        duration = time.time() - start_time
        output = result.stdout + result.stderr
        
        # Parse results
        passed = output.count(' PASSED')
        failed = output.count(' FAILED')
        skipped = output.count(' SKIPPED')
        
        print_subheader("E2E Test Results")
        total = passed + failed + skipped
        pass_rate = (passed / total * 100) if total > 0 else 0
        
        if failed == 0 and passed > 0:
            print_success(f"All E2E tests passed! ({passed}/{total})")
        elif passed > 0:
            print_warning(f"Some E2E tests failed ({passed} passed, {failed} failed, {skipped} skipped)")
        else:
            print_error("No E2E tests passed")
        
        print(f"📊 Test Summary:")
        print(f"   ✓ Passed: {passed}")
        print(f"   ✗ Failed: {failed}")
        print(f"   ⏭  Skipped: {skipped}")
        print(f"   📈 Pass Rate: {pass_rate:.1f}%")
        print(f"   ⏱️  Duration: {duration:.1f}s")
        
        # Show detailed output if there are failures
        if failed > 0:
            print_subheader("Failed Test Details")
            failed_lines = [line for line in output.split('\n') if 'FAILED' in line]
            for line in failed_lines:
                print(f"   {line}")
        
        # Show any skipped tests with reasons
        if skipped > 0:
            print_subheader("Skipped Test Details")
            skipped_lines = [line for line in output.split('\n') if 'SKIPPED' in line]
            for line in skipped_lines[:5]:  # Show first 5 skipped tests
                print(f"   {line}")
        
        return True, passed, failed
        
    except subprocess.TimeoutExpired:
        print_error("E2E tests timed out (10 minute limit)")
        print("This usually indicates:")
        print("- Browser automation is stuck")
        print("- Test services are not responding")
        print("- Network connectivity issues")
        return False, 0, 1
        
    except Exception as e:
        print_error(f"E2E test execution failed: {e}")
        return False, 0, 1

def generate_failure_report(diagnostics_results):
    """Generate detailed failure report for troubleshooting"""
    print_header("FAILURE ANALYSIS & TROUBLESHOOTING")
    
    print("Common E2E Test Failure Reasons:")
    print()
    
    if not diagnostics_results['chrome_available']:
        print("🔍 Chrome Browser Issues:")
        print("   - Google Chrome is not installed")
        print("   - Solution: Install Chrome from https://www.google.com/chrome/")
        print()
    
    if not diagnostics_results['chromedriver_available']:
        print("🔍 ChromeDriver Issues:")
        print("   - ChromeDriver is not installed or not in PATH")
        print("   - ChromeDriver version doesn't match Chrome version")
        print("   - ChromeDriver binary is not executable (macOS security)")
        print("   - Solution: Follow ChromeDriver installation instructions above")
        print()
    
    services = diagnostics_results['services_running']
    if not services.get('Frontend (React)', True):
        print("🔍 Frontend Service Issues:")
        print("   - React development server is not running")
        print("   - Port 3000 is not accessible")
        print("   - Solution: cd admin && npm start")
        print()
    
    if not services.get('Backend (Flask)', True):
        print("🔍 Backend Service Issues:")
        print("   - Flask API server is not running")
        print("   - Port 5002 is not accessible")
        print("   - Solution: cd backend && python app.py")
        print()
    
    print("🔍 Other Common Issues:")
    print("   - Network connectivity problems")
    print("   - Firewall blocking browser automation")
    print("   - Insufficient system resources")
    print("   - Browser automation detection/blocking")
    print("   - Test data conflicts or database issues")
    print()
    
    print("💡 General Troubleshooting Steps:")
    print("   1. Restart all services (frontend, backend)")
    print("   2. Clear browser cache and data")
    print("   3. Update Chrome and ChromeDriver to latest versions")
    print("   4. Run tests with --verbose flag for detailed output")
    print("   5. Check system logs for additional error details")

def main():
    """Main E2E test execution function"""
    start_time = datetime.now()
    
    print_header(f"E2E TEST AUTOMATION SUITE - {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    print("🎯 End-to-End Test Automation")
    print("This script will:")
    print("  1️⃣  Diagnose test environment and dependencies")
    print("  2️⃣  Install missing dependencies automatically")
    print("  3️⃣  Run comprehensive E2E tests")
    print("  4️⃣  Provide detailed failure analysis if needed")
    
    # Run environment diagnostics
    diagnostics_results = run_environment_diagnostics()
    
    # Determine if we can proceed with tests
    can_run_tests = (
        diagnostics_results['python_compatible'] and
        diagnostics_results['chrome_available'] and
        diagnostics_results['chromedriver_available'] and
        diagnostics_results['dependencies_ready']
    )
    
    if not can_run_tests:
        print_header("❌ ENVIRONMENT NOT READY")
        print("Cannot run E2E tests due to environment issues.")
        print("Please resolve the issues above and try again.")
        generate_failure_report(diagnostics_results)
        sys.exit(1)
    
    # Run E2E tests
    success, passed, failed = run_e2e_tests(diagnostics_results)
    
    end_time = datetime.now()
    total_duration = (end_time - start_time).total_seconds()
    
    # Final summary
    print_header("🏁 E2E TEST AUTOMATION SUMMARY")
    
    if success and failed == 0:
        print_success("E2E test automation completed successfully!")
        print(f"✨ All {passed} tests passed in {total_duration:.1f}s")
        print("🚀 Application is ready for end-user testing!")
        sys.exit(0)
    elif success and passed > 0:
        print_warning(f"E2E tests completed with some failures ({passed} passed, {failed} failed)")
        print(f"⚠️ Total duration: {total_duration:.1f}s")
        generate_failure_report(diagnostics_results)
        sys.exit(1)
    else:
        print_error("E2E test automation failed")
        print(f"💥 Duration: {total_duration:.1f}s")
        generate_failure_report(diagnostics_results)
        sys.exit(1)

if __name__ == "__main__":
    main()