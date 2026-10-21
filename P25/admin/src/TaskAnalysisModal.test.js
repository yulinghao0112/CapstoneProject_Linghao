import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskAnalysisModal from './components/TaskAnalysisModal';

// Mock reactstrap components that have complex rendering
jest.mock('reactstrap', () => ({
  ...jest.requireActual('reactstrap'),
  Modal: ({ children, isOpen }) => isOpen ? <div data-testid="modal">{children}</div> : null,
  ModalHeader: ({ children, toggle }) => (
    <div data-testid="modal-header">
      {children}
      <button onClick={toggle} data-testid="modal-close">×</button>
    </div>
  ),
  ModalBody: ({ children }) => <div data-testid="modal-body">{children}</div>,
  ModalFooter: ({ children }) => <div data-testid="modal-footer">{children}</div>,
  Progress: ({ value, color }) => (
    <div data-testid="progress" data-value={value} data-color={color}>
      Progress: {value}%
    </div>
  ),
  Spinner: ({ color, size }) => (
    <div data-testid="spinner" data-color={color} data-size={size}>
      Loading...
    </div>
  ),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock console.error for error handling tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Mock timers for progress simulation tests
jest.useFakeTimers();

describe('TaskAnalysisModal Component', () => {
  const defaultProps = {
    isOpen: true,
    toggle: jest.fn(),
    meetingId: 'meeting-123',
    userId: 'user-456',
    meetingContent: 'Test meeting content',
    onTasksCreated: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
    
    // Clear any existing intervals
    if (window.analysisProgressInterval) {
      clearInterval(window.analysisProgressInterval);
      window.analysisProgressInterval = null;
    }
    
    // Reset fake timers
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    
    // Clean up intervals
    if (window.analysisProgressInterval) {
      clearInterval(window.analysisProgressInterval);
      window.analysisProgressInterval = null;
    }
    
    // Run pending timers and clear them only if using fake timers
    if (jest.isMockFunction(setTimeout)) {
      jest.runOnlyPendingTimers();
      jest.clearAllTimers();
    }
  });

  describe('Component Rendering', () => {
    test('renders modal when isOpen is true', () => {
      render(<TaskAnalysisModal {...defaultProps} />);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('🤖 AI Task Analysis & Jira Creation')).toBeInTheDocument();
    });

    test('does not render modal when isOpen is false', () => {
      render(<TaskAnalysisModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    test('renders close button and calls toggle when clicked', () => {
      const mockToggle = jest.fn();
      render(<TaskAnalysisModal {...defaultProps} toggle={mockToggle} />);
      
      const closeButton = screen.getByTestId('modal-close');
      fireEvent.click(closeButton);
      
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Initial State and Props Validation', () => {
    test('initializes with parsing step when opened', () => {
      render(<TaskAnalysisModal {...defaultProps} />);
      
      expect(screen.getByText('AI Task Analysis in Progress')).toBeInTheDocument();
      expect(screen.getByText('Processing your meeting content...')).toBeInTheDocument();
    });

    test('handles missing meetingId', async () => {
      render(<TaskAnalysisModal {...defaultProps} meetingId={null} />);
      
      // When meetingId is missing, component doesn't start parsing automatically
      // It should show the initial parsing state without starting the API call
      expect(screen.getByText('AI Task Analysis in Progress')).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('handles missing userId', async () => {
      render(<TaskAnalysisModal {...defaultProps} userId={null} />);
      
      // When userId is missing, component doesn't start parsing automatically  
      // It should show the initial parsing state without starting the API call
      expect(screen.getByText('AI Task Analysis in Progress')).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Task Parsing Flow', () => {
    test('successfully parses tasks from meeting content', async () => {
      const mockTaskData = {
        success: true,
        meeting_summary: '## Meeting Summary\nDiscussed project requirements',
        raw_analysis: 'Raw AI analysis data',
        parsed_tasks: {
          user_stories: [
            {
              title: 'User Story 1',
              description: 'Description 1',
              assignee: 'John Doe',
              category: 'frontend',
              priority: 'high',
              subtasks: [
                {
                  title: 'Subtask 1',
                  description: 'Subtask description',
                  assignee: 'Jane Doe',
                  category: 'backend',
                  priority: 'medium',
                }
              ]
            }
          ]
        }
      };

      // Mock immediate response for testing
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskData),
      });

      render(<TaskAnalysisModal {...defaultProps} />);

      // Initially should show parsing state
      expect(screen.getByText('AI Task Analysis in Progress')).toBeInTheDocument();
      
      // Fast forward timers to complete progress simulation
      act(() => {
        jest.advanceTimersByTime(14000); // 7 steps * 2000ms each
      });
      
      // Wait for API call to complete and state to change to 'editing'
      await waitFor(() => {
        expect(screen.getByDisplayValue('User Story 1')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByDisplayValue('Subtask 1')).toBeInTheDocument();
    });

    test('handles API error during task parsing', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(<TaskAnalysisModal {...defaultProps} />);

      // Fast forward timers first
      act(() => {
        jest.advanceTimersByTime(14000);
      });

      await waitFor(() => {
        expect(screen.getByText(/Server error occurred while analyzing tasks/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('handles network error during task parsing', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      render(<TaskAnalysisModal {...defaultProps} />);

      // Fast forward timers first
      act(() => {
        jest.advanceTimersByTime(14000);
      });

      await waitFor(() => {
        expect(screen.getByText(/Cannot connect to server/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('handles timeout during task parsing', async () => {
      // Mock a request that never resolves
      global.fetch.mockImplementation(() => new Promise(() => {}));

      render(<TaskAnalysisModal {...defaultProps} />);

      // Fast-forward time to trigger timeout
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(screen.getByText(/Request timeout/)).toBeInTheDocument();
      });
    });

    test('shows progress animation during task parsing', () => {
      global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<TaskAnalysisModal {...defaultProps} />);

      expect(screen.getByTestId('progress')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText('AI Task Analysis in Progress')).toBeInTheDocument();
    });
  });

  describe('Task Editing Functionality', () => {
    const setupEditingState = async () => {
      const mockTaskData = {
        success: true,
        meeting_summary: 'Test meeting summary',
        parsed_tasks: {
          user_stories: [
            {
              title: 'Test Story',
              description: 'Test description',
              assignee: 'Test User',
              category: 'frontend',
              priority: 'high',
              subtasks: [
                {
                  title: 'Test Subtask',
                  description: 'Subtask description',
                  assignee: 'Test Assignee',
                  category: 'backend',
                  priority: 'medium',
                }
              ]
            }
          ]
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskData),
      });

      render(<TaskAnalysisModal {...defaultProps} />);

      // Fast forward timers to complete progress simulation  
      act(() => {
        jest.advanceTimersByTime(14000);
      });
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Story')).toBeInTheDocument();
      }, { timeout: 3000 });
    };

    test('allows editing user story fields', async () => {
      await setupEditingState();

      const titleInput = screen.getByDisplayValue('Test Story');
      fireEvent.change(titleInput, { target: { value: 'Updated Story Title' } });

      expect(titleInput.value).toBe('Updated Story Title');
    });

    test('allows editing subtask fields', async () => {
      await setupEditingState();

      const subtaskTitleInput = screen.getByDisplayValue('Test Subtask');
      fireEvent.change(subtaskTitleInput, { target: { value: 'Updated Subtask' } });

      expect(subtaskTitleInput.value).toBe('Updated Subtask');
    });

    test('allows adding new user story', async () => {
      await setupEditingState();

      const addStoryButton = screen.getByText('+ Add User Story');
      fireEvent.click(addStoryButton);

      // Should have multiple story editing sections
      const storyTitleInputs = screen.getAllByPlaceholderText('Enter user story title...');
      expect(storyTitleInputs).toHaveLength(2);
    });

    test('allows removing user story', async () => {
      await setupEditingState();

      const removeButtons = screen.getAllByTitle('Remove this User Story');
      fireEvent.click(removeButtons[0]);

      // Story should be removed
      expect(screen.queryByDisplayValue('Test Story')).not.toBeInTheDocument();
    });

    test('allows adding new subtask to user story', async () => {
      await setupEditingState();

      const addSubtaskButton = screen.getByText('+ Subtask');
      fireEvent.click(addSubtaskButton);

      // Should have multiple subtask sections
      const subtaskTitleInputs = screen.getAllByPlaceholderText('Enter subtask title...');
      expect(subtaskTitleInputs).toHaveLength(2);
    });

    test('allows removing subtask', async () => {
      await setupEditingState();

      const removeSubtaskButtons = screen.getAllByTitle('Remove this Subtask');
      fireEvent.click(removeSubtaskButtons[0]);

      expect(screen.queryByText('Test Subtask')).not.toBeInTheDocument();
    });

    test('shows correct category and priority colors', async () => {
      await setupEditingState();

      // Check for frontend category badge
      expect(screen.getByText('frontend')).toBeInTheDocument();
      // Check for high priority badge
      expect(screen.getByText('high')).toBeInTheDocument();
    });
  });

  describe('Jira Task Creation', () => {
    const setupForTaskCreation = async () => {
      const mockTaskData = {
        success: true,
        meeting_summary: 'Test summary',
        parsed_tasks: {
          user_stories: [
            {
              title: 'Story for Creation',
              description: 'Description',
              assignee: 'User',
              category: 'frontend',
              priority: 'high',
              subtasks: []
            }
          ]
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskData),
      });

      render(<TaskAnalysisModal {...defaultProps} />);
      
      // Fast forward timers to complete progress simulation
      act(() => {
        jest.advanceTimersByTime(14000);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Story for Creation')).toBeInTheDocument();
      }, { timeout: 3000 });
    };

    test('successfully creates Jira tasks', async () => {
      await setupForTaskCreation();

      const mockCreationResults = {
        success: true,
        created_stories: 1,
        total_stories: 1,
        created_subtasks: 0,
        total_subtasks: 0,
        failed_count: 0,
        results: [
          {
            story_success: true,
            story_title: 'Story for Creation',
            story_key: 'TEST-123',
            story_url: 'https://test.atlassian.net/browse/TEST-123',
            subtasks: []
          }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCreationResults),
      });

      const createButton = screen.getByText('Create User Stories & Subtasks in Jira');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('✅ Smart Hierarchy Creation Complete!')).toBeInTheDocument();
      });

      expect(screen.getByText(/1\/1 User Stories created/)).toBeInTheDocument();
      expect(screen.getByText(/TEST-123/)).toBeInTheDocument();
    });

    test('handles task creation failure', async () => {
      await setupForTaskCreation();

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const createButton = screen.getByText('Create User Stories & Subtasks in Jira');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Server error occurred while creating tasks/)).toBeInTheDocument();
      });
    });

    test('disables create button when no tasks are available', async () => {
      const mockTaskData = {
        success: true,
        meeting_summary: 'Test summary',
        parsed_tasks: { user_stories: [] }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskData),
      });

      render(<TaskAnalysisModal {...defaultProps} />);
      
      // Fast forward timers to complete progress simulation
      act(() => {
        jest.advanceTimersByTime(14000);
      });

      await waitFor(() => {
        const createButton = screen.getByText('Create User Stories & Subtasks in Jira');
        expect(createButton).toBeDisabled();
      }, { timeout: 3000 });
    });

    test('shows loading state during task creation', async () => {
      await setupForTaskCreation();

      // Mock the second fetch call (for task creation) to never resolve
      global.fetch.mockImplementationOnce(() => new Promise(() => {})); 

      const createButton = screen.getByText('Create User Stories & Subtasks in Jira');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Creating Jira tasks...')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Check that spinner is shown in the modal body
      expect(screen.getByText('Please wait while we create your tasks in Jira.')).toBeInTheDocument();
    });

    test('calls onTasksCreated callback on successful creation', async () => {
      const mockOnTasksCreated = jest.fn();
      const mockTaskData = {
        success: true,
        meeting_summary: 'Test summary',
        parsed_tasks: {
          user_stories: [
            {
              title: 'Story for Creation',
              description: 'Description',
              assignee: 'User',
              category: 'frontend',
              priority: 'high',
              subtasks: []
            }
          ]
        }
      };
      
      const mockCreationResults = {
        success: true,
        created_stories: 1,
        total_stories: 1,
        results: []
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTaskData),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreationResults),
        });

      render(<TaskAnalysisModal {...defaultProps} onTasksCreated={mockOnTasksCreated} />);
      
      // Fast forward timers to complete progress simulation
      act(() => {
        jest.advanceTimersByTime(14000);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Story for Creation')).toBeInTheDocument();
      }, { timeout: 3000 });

      const createButton = screen.getByText('Create User Stories & Subtasks in Jira');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockOnTasksCreated).toHaveBeenCalledWith(mockCreationResults);
      });
    });
  });

  describe('Results Display', () => {
    test('displays successful creation results with links', async () => {
      const mockTaskData = {
        success: true,
        meeting_summary: 'Test summary',
        parsed_tasks: { user_stories: [{ title: 'Test Story', subtasks: [] }] }
      };

      const mockCreationResults = {
        success: true,
        created_stories: 1,
        total_stories: 1,
        created_subtasks: 2,
        total_subtasks: 2,
        failed_count: 0,
        results: [
          {
            story_success: true,
            story_title: 'Test Story',
            story_key: 'TEST-123',
            story_url: 'https://test.atlassian.net/browse/TEST-123',
            subtasks: [
              {
                subtask_success: true,
                subtask_title: 'Test Subtask 1',
                subtask_key: 'TEST-124',
                subtask_url: 'https://test.atlassian.net/browse/TEST-124'
              },
              {
                subtask_success: false,
                subtask_title: 'Test Subtask 2',
                subtask_error: 'Creation failed'
              }
            ]
          }
        ]
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTaskData),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreationResults),
        });

      render(<TaskAnalysisModal {...defaultProps} />);

      // Fast forward timers to complete progress simulation
      act(() => {
        jest.advanceTimersByTime(14000);
      });
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Story')).toBeInTheDocument();
      }, { timeout: 3000 });

      const createButton = screen.getByText('Create User Stories & Subtasks in Jira');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('✅ Smart Hierarchy Creation Complete!')).toBeInTheDocument();
      });

      expect(screen.getByText(/1\/1 User Stories created.*2\/2 Subtasks created/)).toBeInTheDocument();
      expect(screen.getByText(/TEST-123/)).toBeInTheDocument();
      expect(screen.getByText(/TEST-124/)).toBeInTheDocument();
      expect(screen.getByText(/Creation failed/)).toBeInTheDocument();

      // Check for View buttons
      expect(screen.getByText(/View Story/)).toBeInTheDocument();
      expect(screen.getByText(/View Subtask/)).toBeInTheDocument();
    });

    test('handles mixed success/failure results', async () => {
      const mockCreationResults = {
        success: true,
        created_stories: 1,
        total_stories: 2,
        created_subtasks: 0,
        total_subtasks: 1,
        failed_count: 1,
        results: [
          {
            story_success: true,
            story_title: 'Success Story',
            story_key: 'TEST-123',
            subtasks: []
          },
          {
            story_success: false,
            story_title: 'Failed Story',
            story_error: 'Project not found',
            subtasks: []
          }
        ]
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            parsed_tasks: { user_stories: [{ title: 'Test' }] }
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreationResults),
        });

      render(<TaskAnalysisModal {...defaultProps} />);

      await waitFor(() => {
        const createButton = screen.getByText('Create User Stories & Subtasks in Jira');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByText('1/2 User Stories created, 0/1 Subtasks created, 1 failed')).toBeInTheDocument();
      });

      expect(screen.getByText('Success Story')).toBeInTheDocument();
      expect(screen.getByText('Failed Story')).toBeInTheDocument();
      expect(screen.getByText('Project not found')).toBeInTheDocument();
    });
  });

  describe('Modal State Management', () => {
    test('resets state when modal is opened', async () => {
      const { rerender } = render(<TaskAnalysisModal {...defaultProps} isOpen={false} />);

      // Open modal
      rerender(<TaskAnalysisModal {...defaultProps} isOpen={true} />);

      expect(screen.getByText('AI Task Analysis in Progress')).toBeInTheDocument();
    });

    test('resets state when meetingId changes', async () => {
      const { rerender } = render(<TaskAnalysisModal {...defaultProps} />);

      // Change meeting ID
      rerender(<TaskAnalysisModal {...defaultProps} meetingId="new-meeting-456" />);

      expect(screen.getByText('AI Task Analysis in Progress')).toBeInTheDocument();
    });

    test('cleans up progress interval on unmount', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const { unmount } = render(<TaskAnalysisModal {...defaultProps} />);
      
      // Set an interval to simulate the progress simulation
      window.analysisProgressInterval = setInterval(() => {}, 1000);
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Progress Simulation', () => {
    test('progresses through analysis steps', async () => {
      // Mock a slow API response
      global.fetch.mockImplementation(() => new Promise(() => {}));

      render(<TaskAnalysisModal {...defaultProps} />);

      // Initial state
      expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '0');

      // Advance time to see progress
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '10');
      });

      expect(screen.getByText('Reading meeting transcripts...')).toBeInTheDocument();

      // Advance more (2000ms more = 4000ms total = 2 more steps)
      act(() => {
        jest.advanceTimersByTime(2000); // Now at step 2 (40%)
      });

      await waitFor(() => {
        expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '25');
      });
      
      expect(screen.getByText('Understanding context and participants...')).toBeInTheDocument();
    });
  });

  describe('Accessibility and UX', () => {
    test('provides appropriate loading states', async () => {
      global.fetch.mockImplementation(() => new Promise(() => {}));

      render(<TaskAnalysisModal {...defaultProps} />);

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText('Processing your meeting content...')).toBeInTheDocument();
    });

    test('provides clear error messages', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      render(<TaskAnalysisModal {...defaultProps} />);
      
      // Fast forward timers first
      act(() => {
        jest.advanceTimersByTime(14000);
      });

      await waitFor(() => {
        expect(screen.getByText(/Meeting not found/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('handles form validation appropriately', async () => {
      const mockTaskData = {
        success: true,
        parsed_tasks: { user_stories: [] }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskData),
      });

      render(<TaskAnalysisModal {...defaultProps} />);
      
      // Fast forward timers to complete progress simulation
      act(() => {
        jest.advanceTimersByTime(14000);
      });

      await waitFor(() => {
        const createButton = screen.getByText('Create User Stories & Subtasks in Jira');
        expect(createButton).toBeDisabled();
      }, { timeout: 3000 });
    });
  });

  describe('API Integration', () => {
    test('makes correct API calls with proper headers and body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          parsed_tasks: { user_stories: [] }
        }),
      });

      render(<TaskAnalysisModal {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:5002/api/meetings/meeting-123/parse-tasks',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: 'user-456'
            }),
            signal: expect.any(AbortSignal)
          })
        );
      });
    });

    test('includes abort signal for request cancellation', async () => {
      global.fetch.mockImplementation((_url, options) => {
        expect(options.signal).toBeInstanceOf(AbortSignal);
        return new Promise(() => {}); // Never resolves
      });

      render(<TaskAnalysisModal {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });
});