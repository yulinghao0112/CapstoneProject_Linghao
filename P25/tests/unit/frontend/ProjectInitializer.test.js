import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProjectInitializer from '../ProjectInitializer';
import * as actions from '../../redux/actions';

// Mock the Redux actions
jest.mock('../../redux/actions', () => ({
  setCurrentProject: jest.fn()
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Create a mock store factory
const createMockStore = (initialState = {}) => {
  const defaultState = {
    Chat: {
      currentProject: null,
      ...initialState.Chat,
    },
  };

  return configureStore({
    reducer: {
      Chat: (state = defaultState.Chat, action) => {
        switch (action.type) {
          case 'SET_CURRENT_PROJECT':
            return { ...state, currentProject: action.payload };
          default:
            return state;
        }
      },
    },
    preloadedState: defaultState,
  });
};

// Test wrapper component
const TestWrapper = ({ children, store }) => (
  <Provider store={store}>{children}</Provider>
);

describe('ProjectInitializer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
    localStorageMock.getItem.mockClear();
    actions.setCurrentProject.mockClear();
    
    // Mock setCurrentProject to return a proper action
    actions.setCurrentProject.mockImplementation((project) => ({
      type: 'SET_CURRENT_PROJECT',
      payload: project
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      const store = createMockStore();
      const { container } = render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      // Component should render nothing (returns null)
      expect(container.firstChild).toBeNull();
    });

    test('does not render any visible content', () => {
      const store = createMockStore();
      const { container } = render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Project State Initialization', () => {
    test('fetches and sets project when Redux state is empty and token exists', async () => {
      const mockProjectData = {
        projects: [
          {
            key: 'TEST-PROJECT',
            name: 'Test Project',
            id: 'project-123'
          }
        ]
      };

      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProjectData),
      });

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:5002/api/jira-oauth/my-projects',
          {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer mock-access-token',
              'Content-Type': 'application/json',
            },
          }
        );
      });

      await waitFor(() => {
        expect(actions.setCurrentProject).toHaveBeenCalledWith({
          key: 'TEST-PROJECT',
          name: 'Test Project',
          id: 'project-123'
        });
      });
    });

    test('handles project with missing id field by using key as fallback', async () => {
      const mockProjectData = {
        projects: [
          {
            key: 'TEST-PROJECT',
            name: 'Test Project'
            // No id field
          }
        ]
      };

      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProjectData),
      });

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(actions.setCurrentProject).toHaveBeenCalledWith({
          key: 'TEST-PROJECT',
          name: 'Test Project',
          id: 'TEST-PROJECT' // Should use key as fallback
        });
      });
    });

    test('does not fetch when Redux already has project information', async () => {
      localStorageMock.getItem.mockReturnValue('mock-access-token');

      const store = createMockStore({
        Chat: {
          currentProject: {
            key: 'EXISTING-PROJECT',
            name: 'Existing Project'
          }
        }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      // Wait a bit to ensure no async operations are triggered
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(global.fetch).not.toHaveBeenCalled();
      expect(actions.setCurrentProject).not.toHaveBeenCalled();
    });

    test('does not fetch when no access token is available', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      // Wait a bit to ensure no async operations are triggered
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(global.fetch).not.toHaveBeenCalled();
      expect(actions.setCurrentProject).not.toHaveBeenCalled();
    });

    test('handles API response with no projects', async () => {
      const mockProjectData = {
        projects: []
      };

      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProjectData),
      });

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Should not dispatch setCurrentProject when no projects are available
      expect(actions.setCurrentProject).not.toHaveBeenCalled();
    });

    test('handles API response with null projects array', async () => {
      const mockProjectData = {
        projects: null
      };

      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProjectData),
      });

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      expect(actions.setCurrentProject).not.toHaveBeenCalled();
    });

    test('selects first project when multiple projects are available', async () => {
      const mockProjectData = {
        projects: [
          {
            key: 'FIRST-PROJECT',
            name: 'First Project',
            id: 'project-1'
          },
          {
            key: 'SECOND-PROJECT',
            name: 'Second Project',
            id: 'project-2'
          }
        ]
      };

      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProjectData),
      });

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(actions.setCurrentProject).toHaveBeenCalledWith({
          key: 'FIRST-PROJECT',
          name: 'First Project',
          id: 'project-1'
        });
      });

      // Should only be called once with the first project
      expect(actions.setCurrentProject).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    test('handles API error response gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Should not dispatch action on API error
      expect(actions.setCurrentProject).not.toHaveBeenCalled();
      
      // Should not throw error or crash the component
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('handles network error gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to initialize project state:',
          expect.any(Error)
        );
      });

      expect(actions.setCurrentProject).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('handles malformed JSON response gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to initialize project state:',
          expect.any(Error)
        );
      });

      expect(actions.setCurrentProject).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Redux Integration', () => {
    test('connects to Redux store correctly', () => {
      const store = createMockStore({
        Chat: {
          currentProject: {
            key: 'EXISTING-PROJECT',
            name: 'Existing Project'
          }
        }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      // Component should render without Redux connection errors
      expect(() => render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      )).not.toThrow();
    });

    test('dispatches action with correct format', async () => {
      const mockProjectData = {
        projects: [
          {
            key: 'TEST-PROJECT',
            name: 'Test Project',
            id: 'project-123'
          }
        ]
      };

      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProjectData),
      });

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(actions.setCurrentProject).toHaveBeenCalledWith(
          expect.objectContaining({
            key: expect.any(String),
            name: expect.any(String),
            id: expect.any(String)
          })
        );
      });
    });
  });

  describe('Component Lifecycle', () => {
    test('initializes on mount', async () => {
      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: [] }),
      });

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });

    test('does not re-initialize when currentProject.key dependency does not change', async () => {
      localStorageMock.getItem.mockReturnValue('mock-access-token');

      const store = createMockStore({
        Chat: {
          currentProject: {
            key: 'EXISTING-PROJECT',
            name: 'Existing Project'
          }
        }
      });

      const { rerender } = render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      // Rerender with same props
      rerender(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      // Should not make any API calls due to existing project
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('re-initializes when currentProject.key changes to null', async () => {
      localStorageMock.getItem.mockReturnValue('mock-access-token');
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ projects: [] }),
      });

      // Start with existing project
      const initialStore = createMockStore({
        Chat: {
          currentProject: {
            key: 'EXISTING-PROJECT',
            name: 'Existing Project'
          }
        }
      });

      const { rerender } = render(
        <TestWrapper store={initialStore}>
          <ProjectInitializer />
        </TestWrapper>
      );

      expect(global.fetch).not.toHaveBeenCalled();

      // Change to null project
      const updatedStore = createMockStore({
        Chat: { currentProject: null }
      });

      rerender(
        <TestWrapper store={updatedStore}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Authentication Integration', () => {
    test('includes correct authorization header', async () => {
      const testToken = 'test-jwt-token-12345';
      localStorageMock.getItem.mockReturnValue(testToken);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: [] }),
      });

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:5002/api/jira-oauth/my-projects',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': `Bearer ${testToken}`,
            }),
          })
        );
      });
    });

    test('calls localStorage.getItem with correct key', async () => {
      localStorageMock.getItem.mockReturnValue('mock-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: [] }),
      });

      const store = createMockStore({
        Chat: { currentProject: null }
      });

      render(
        <TestWrapper store={store}>
          <ProjectInitializer />
        </TestWrapper>
      );

      expect(localStorageMock.getItem).toHaveBeenCalledWith('access_token');
    });
  });
});