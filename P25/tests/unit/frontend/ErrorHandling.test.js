/**
 * Error Handling and Boundary Tests
 * 
 * Tests component behavior with invalid inputs, network errors,
 * and edge cases
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { BrowserRouter } from 'react-router-dom';

// Mock components for testing error boundaries and edge cases
const MockComponent = ({ shouldError = false, errorMessage = "Test Error" }) => {
  if (shouldError) {
    throw new Error(errorMessage);
  }
  return <div>Mock Component Rendered</div>;
};

// Simple error boundary for testing
class TestErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="error-message">Something went wrong: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

// Mock Redux store
const mockStore = createStore(() => ({
  auth: { user: null, loading: false },
  chat: { messages: [], loading: false }
}));

// Test wrapper component
const TestWrapper = ({ children }) => (
  <Provider store={mockStore}>
    <BrowserRouter>
      <TestErrorBoundary>
        {children}
      </TestErrorBoundary>
    </BrowserRouter>
  </Provider>
);

describe('Error Handling and Boundary Tests', () => {
  
  describe('Error Boundaries', () => {
    test('should catch and display component errors', () => {
      render(
        <TestWrapper>
          <MockComponent shouldError={true} errorMessage="Component crashed!" />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong: Component crashed!/)).toBeInTheDocument();
    });
    
    test('should render normally when no errors occur', () => {
      render(
        <TestWrapper>
          <MockComponent shouldError={false} />
        </TestWrapper>
      );
      
      expect(screen.getByText('Mock Component Rendered')).toBeInTheDocument();
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });
  });

  describe('Input Validation and Boundaries', () => {
    
    // Mock form component for testing validation
    const MockForm = () => {
      const [email, setEmail] = React.useState('');
      const [password, setPassword] = React.useState('');
      const [errors, setErrors] = React.useState({});

      const validateForm = () => {
        const newErrors = {};
        
        // Email validation
        if (!email) {
          newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
          newErrors.email = 'Email is invalid';
        } else if (email.length > 100) {
          newErrors.email = 'Email is too long';
        }
        
        // Password validation  
        if (!password) {
          newErrors.password = 'Password is required';
        } else if (password.length < 6) {
          newErrors.password = 'Password must be at least 6 characters';
        } else if (password.length > 128) {
          newErrors.password = 'Password is too long';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
      };

      const handleSubmit = (e) => {
        e.preventDefault();
        validateForm();
      };

      return (
        <form onSubmit={handleSubmit}>
          <input
            data-testid="email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
          />
          {errors.email && <div data-testid="email-error">{errors.email}</div>}
          
          <input
            data-testid="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />
          {errors.password && <div data-testid="password-error">{errors.password}</div>}
          
          <button type="submit" data-testid="submit-button">Submit</button>
        </form>
      );
    };

    test('should show validation errors for empty fields', async () => {
      render(
        <TestWrapper>
          <MockForm />
        </TestWrapper>
      );
      
      fireEvent.click(screen.getByTestId('submit-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toHaveTextContent('Email is required');
        expect(screen.getByTestId('password-error')).toHaveTextContent('Password is required');
      });
    });

    test('should validate email format', async () => {
      render(
        <TestWrapper>
          <MockForm />
        </TestWrapper>
      );
      
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'invalid-email' } });
      fireEvent.click(screen.getByTestId('submit-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toHaveTextContent('Email is invalid');
      });
    });

    test('should validate password length boundaries', async () => {
      render(
        <TestWrapper>
          <MockForm />
        </TestWrapper>
      );
      
      // Test minimum length
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: '123' } });
      fireEvent.click(screen.getByTestId('submit-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toHaveTextContent('Password must be at least 6 characters');
      });
      
      // Test maximum length
      const longPassword = 'a'.repeat(130);
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: longPassword } });
      fireEvent.click(screen.getByTestId('submit-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toHaveTextContent('Password is too long');
      });
    });

    test('should validate email length boundary', async () => {
      render(
        <TestWrapper>
          <MockForm />
        </TestWrapper>
      );
      
      // Test email too long
      const longEmail = 'a'.repeat(90) + '@example.com';
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: longEmail } });
      fireEvent.click(screen.getByTestId('submit-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('email-error')).toHaveTextContent('Email is too long');
      });
    });
  });

  describe('Network Error Handling', () => {
    
    // Mock component that makes API calls
    const MockApiComponent = () => {
      const [data, setData] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const [error, setError] = React.useState(null);

      const fetchData = async () => {
        setLoading(true);
        setError(null);
        
        try {
          const response = await fetch('/api/test');
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const result = await response.json();
          setData(result);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      return (
        <div>
          <button onClick={fetchData} data-testid="fetch-button">Fetch Data</button>
          {loading && <div data-testid="loading">Loading...</div>}
          {error && <div data-testid="error">{error}</div>}
          {data && <div data-testid="data">{JSON.stringify(data)}</div>}
        </div>
      );
    };

    beforeEach(() => {
      // Reset fetch mock before each test
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should handle network errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      
      render(
        <TestWrapper>
          <MockApiComponent />
        </TestWrapper>
      );
      
      fireEvent.click(screen.getByTestId('fetch-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });
    });

    test('should handle HTTP error responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });
      
      render(
        <TestWrapper>
          <MockApiComponent />
        </TestWrapper>
      );
      
      fireEvent.click(screen.getByTestId('fetch-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('HTTP 500: Internal Server Error');
      });
    });

    test('should handle successful API responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Success', data: [1, 2, 3] })
      });
      
      render(
        <TestWrapper>
          <MockApiComponent />
        </TestWrapper>
      );
      
      fireEvent.click(screen.getByTestId('fetch-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('{"message":"Success","data":[1,2,3]}');
      });
    });
  });

  describe('Edge Cases and Null Safety', () => {
    
    // Component that handles null/undefined props
    const MockDataDisplay = ({ data, config }) => {
      // Safe access to nested properties
      const safeGet = (obj, path, defaultValue = null) => {
        return path.split('.').reduce((current, key) => {
          return current && current[key] !== undefined ? current[key] : defaultValue;
        }, obj);
      };

      return (
        <div>
          <div data-testid="user-name">
            {safeGet(data, 'user.name', 'Anonymous')}
          </div>
          <div data-testid="item-count">
            {safeGet(data, 'items.length', 0)}
          </div>
          <div data-testid="config-theme">
            {safeGet(config, 'ui.theme', 'default')}
          </div>
        </div>
      );
    };

    test('should handle null data gracefully', () => {
      render(
        <TestWrapper>
          <MockDataDisplay data={null} config={null} />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('user-name')).toHaveTextContent('Anonymous');
      expect(screen.getByTestId('item-count')).toHaveTextContent('0');
      expect(screen.getByTestId('config-theme')).toHaveTextContent('default');
    });

    test('should handle undefined properties', () => {
      render(
        <TestWrapper>
          <MockDataDisplay 
            data={{ user: {} }} 
            config={{ ui: {} }} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('user-name')).toHaveTextContent('Anonymous');
      expect(screen.getByTestId('config-theme')).toHaveTextContent('default');
    });

    test('should display actual data when available', () => {
      render(
        <TestWrapper>
          <MockDataDisplay 
            data={{ 
              user: { name: 'John Doe' },
              items: [1, 2, 3, 4, 5]
            }} 
            config={{ 
              ui: { theme: 'dark' }
            }} 
          />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
      expect(screen.getByTestId('item-count')).toHaveTextContent('5');
      expect(screen.getByTestId('config-theme')).toHaveTextContent('dark');
    });
  });

  describe('Memory Leaks and Cleanup', () => {
    
    test('should clean up event listeners and subscriptions', () => {
      let cleanupCalled = false;
      
      const MockComponentWithCleanup = () => {
        React.useEffect(() => {
          const handler = () => console.log('resize');
          window.addEventListener('resize', handler);
          
          return () => {
            window.removeEventListener('resize', handler);
            cleanupCalled = true;
          };
        }, []);
        
        return <div>Component with cleanup</div>;
      };

      const { unmount } = render(
        <TestWrapper>
          <MockComponentWithCleanup />
        </TestWrapper>
      );
      
      unmount();
      expect(cleanupCalled).toBe(true);
    });
  });
});