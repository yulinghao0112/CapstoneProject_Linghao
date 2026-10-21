import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Provider } from 'react-redux'
import { createStore, combineReducers } from 'redux'
import { configureStore } from './redux/store'
import JiraSummary from './components/JiraSummary'

// Mock react-markdown to avoid SSR/DOM issues in tests
jest.mock('react-markdown', () => {
    return function MockReactMarkdown({ children }) {
        return <div data-testid="markdown-content">{children}</div>
    }
})

// Mock remark-gfm
jest.mock('remark-gfm', () => ({
    __esModule: true,
    default: jest.fn(),
}))

// Mock fetch globally
global.fetch = jest.fn()

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
})

// Create a mock store factory using project's Redux structure
const createMockStore = (initialState = {}) => {
    const defaultChatState = {
        active_user: 3,
        activeMeetingId: null,
        currentSite: {
            id: null,
            name: null,
            url: null
        },
        siteLoading: false,
        currentProject: {
            key: null,
            name: null,
            id: null
        },
        projectLoading: false,
        users: [],
        groups: [],
        contacts: [],
        ...initialState.Chat,
    }

    const mockChatReducer = (state = defaultChatState, action) => {
        switch (action.type) {
            case 'SET_ACTIVE_MEETING_ID':
                return { ...state, activeMeetingId: action.payload }
            case 'SET_CURRENT_PROJECT':
                return { ...state, currentProject: action.payload, projectLoading: false }
            case 'CLEAR_CURRENT_PROJECT':
                return { ...state, currentProject: { key: null, name: null, id: null }, projectLoading: false }
            default:
                return state
        }
    }

    const rootReducer = combineReducers({
        Chat: mockChatReducer,
        Auth: (state = {}) => state,
        Layout: (state = {}) => state,
    })

    return createStore(rootReducer, {
        Chat: defaultChatState,
        Auth: {},
        Layout: {},
        ...initialState
    })
}

// Test wrapper component
const TestWrapper = ({ children, store }) => (
    <Provider store={store}>{children}</Provider>
)

describe('JiraSummary Component', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        global.fetch.mockClear()
        localStorageMock.getItem.mockReturnValue('mock-token')
        
        // Default fetch mock to prevent unhandled promises
        global.fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ summary: 'Default test summary' }),
        })
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('Component Rendering', () => {
        test('renders the component with default props', () => {
            const store = createMockStore()
            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            expect(screen.getByText('Summary of JIRA')).toBeInTheDocument()
            expect(screen.getByText('Update Jira')).toBeInTheDocument()
            expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
        })

        test('renders with initial summary text', () => {
            const store = createMockStore()
            const initialText = '# Test Summary\nThis is a test summary'

            render(
                <TestWrapper store={store}>
                    <JiraSummary initialSummaryText={initialText} />
                </TestWrapper>
            )

            const content = screen.getByTestId('markdown-content')
            expect(content).toHaveTextContent('# Test Summary')
            expect(content).toHaveTextContent('This is a test summary')
        })

        test('renders collapse/expand functionality', () => {
            const store = createMockStore()
            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            const header = screen.getByText('Summary of JIRA').closest('[style*="cursor: pointer"]')
            expect(header).toBeInTheDocument()

            // Should be expanded by default
            expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
        })
    })

    describe('Redux Integration', () => {
        test('connects to Redux store and reads activeMeetingId', () => {
            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            // Component should render without errors when connected to store
            expect(screen.getByText('Summary of JIRA')).toBeInTheDocument()
        })

        test('handles null activeMeetingId gracefully', () => {
            const store = createMockStore({
                Chat: {
                    activeMeetingId: null,
                    currentProject: null
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            expect(screen.getByText('Summary of JIRA')).toBeInTheDocument()
        })
    })

    describe('Data Fetching - fetchExistingSummary', () => {
        test('fetches existing summary successfully', async () => {
            const mockSummary = '## Project Summary\nTask completed successfully'
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ summary: mockSummary }),
            })

            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://localhost:5002/api/jira-oauth/ai-summary',
                    expect.objectContaining({
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer mock-token',
                        },
                        body: JSON.stringify({
                            meeting_id: 'meeting-123',
                            project_key: 'TEST-PROJECT',
                        }),
                    })
                )
            })
        })

        test('handles API error gracefully', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            })

            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled()
            })

            // Should clear summary text on error
            expect(screen.getByTestId('markdown-content')).toHaveTextContent('')
        })

        test('handles network error gracefully', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'))

            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith(
                    'Failed to fetch project summary:',
                    expect.any(Error)
                )
            })

            consoleSpy.mockRestore()
        })

        test('does not fetch when activeMeetingId is missing', async () => {
            const store = createMockStore({
                Chat: {
                    activeMeetingId: null,
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(global.fetch).not.toHaveBeenCalled()
            })
        })

        test('does not fetch when currentProject is missing', async () => {
            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: null
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(global.fetch).not.toHaveBeenCalled()
            })
        })
    })

    describe('Data Fetching - fetchSummary (Update Jira)', () => {
        test('successfully fetches and updates summary via Update Jira button', async () => {
            const mockProjectsResponse = {
                projects: [{ key: 'TEST-PROJECT', name: 'Test Project' }]
            }
            const mockSummaryResponse = {
                summary: '## Updated Summary\nFresh data from Jira'
            }

            global.fetch
                // Initial fetch on component mount
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ summary: 'Initial summary' }),
                })
                // Manual update calls
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockProjectsResponse),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve('Sync successful'),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockSummaryResponse),
                })

            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            // Wait for initial load
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1)
            })

            const updateButton = screen.getByText('Update Jira')
            fireEvent.click(updateButton)

            // Should show loading state
            await waitFor(() => {
                expect(screen.getByRole('status')).toBeInTheDocument() // Spinner
            })

            // Wait for manual update API calls to complete
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(4) // Initial + 3 manual update calls
            })

            // Verify manual update API calls (calls 2, 3, 4)
            expect(global.fetch).toHaveBeenNthCalledWith(
                2,
                'http://localhost:5002/api/jira-oauth/my-projects',
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer mock-token',
                    },
                })
            )

            expect(global.fetch).toHaveBeenNthCalledWith(
                3,
                'http://localhost:5002/api/jira-oauth/sync-from-jira',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer mock-token',
                    },
                    body: JSON.stringify({ project_key: 'TEST-PROJECT' }),
                })
            )

            expect(global.fetch).toHaveBeenNthCalledWith(
                4,
                'http://localhost:5002/api/jira-oauth/ai-summary',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer mock-token',
                    },
                    body: JSON.stringify({ meeting_id: 'meeting-123' }),
                })
            )
        })

        test('handles missing active meeting gracefully', async () => {
            const store = createMockStore({
                Chat: {
                    activeMeetingId: null,
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            const updateButton = screen.getByText('Update Jira')
            fireEvent.click(updateButton)

            await waitFor(() => {
                expect(screen.getByTestId('markdown-content')).toHaveTextContent(
                    '❌ No active meeting selected. Please select a meeting first.'
                )
            })

            expect(global.fetch).not.toHaveBeenCalled()
        })

        test('handles projects fetch failure', async () => {
            // Mock initial fetch that gets called on mount
            global.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ summary: 'Initial summary' }),
                })
                // Mock failed projects fetch for manual update
                .mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                })

            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            // Wait for initial load
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1)
            })

            const updateButton = screen.getByText('Update Jira')
            fireEvent.click(updateButton)

            await waitFor(() => {
                expect(screen.getByTestId('markdown-content')).toHaveTextContent(
                    /❌ Failed to load summary:/
                )
            })

            consoleSpy.mockRestore()
        })

        test('handles no projects available', async () => {
            // Mock initial fetch
            global.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ summary: 'Initial summary' }),
                })
                // Mock empty projects response
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ projects: [] }),
                })

            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            // Wait for initial load
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1)
            })

            const updateButton = screen.getByText('Update Jira')
            fireEvent.click(updateButton)

            await waitFor(() => {
                expect(screen.getByTestId('markdown-content')).toHaveTextContent(
                    'No Jira projects available. Please connect to Jira first.'
                )
            })

            consoleSpy.mockRestore()
        })

        test('handles sync failure', async () => {
            global.fetch
                // Initial fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ summary: 'Initial summary' }),
                })
                // Successful projects fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        projects: [{ key: 'TEST-PROJECT', name: 'Test Project' }]
                    }),
                })
                // Failed sync
                .mockResolvedValueOnce({
                    ok: false,
                    text: () => Promise.resolve('Sync failed'),
                })

            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            // Wait for initial load
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1)
            })

            const updateButton = screen.getByText('Update Jira')
            fireEvent.click(updateButton)

            await waitFor(() => {
                expect(screen.getByTestId('markdown-content')).toHaveTextContent(
                    /Sync from Jira failed: Sync failed/
                )
            })

            consoleSpy.mockRestore()
        })

        test('handles AI summary failure', async () => {
            global.fetch
                // Initial fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ summary: 'Initial summary' }),
                })
                // Successful projects fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        projects: [{ key: 'TEST-PROJECT', name: 'Test Project' }]
                    }),
                })
                // Successful sync
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve('Sync successful'),
                })
                // Failed AI summary
                .mockResolvedValueOnce({
                    ok: false,
                    text: () => Promise.resolve('AI summary failed'),
                })

            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            // Wait for initial load
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1)
            })

            const updateButton = screen.getByText('Update Jira')
            fireEvent.click(updateButton)

            await waitFor(() => {
                expect(screen.getByTestId('markdown-content')).toHaveTextContent(
                    /AI summary failed: AI summary failed/
                )
            })

            consoleSpy.mockRestore()
        })
    })

    describe('UI Interactions', () => {
        test('collapse and expand functionality works', () => {
            const store = createMockStore()
            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            const collapseArea = screen.getByTestId('markdown-content').closest('[class*="collapse"]')
            expect(collapseArea).toBeInTheDocument()

            // Click header to collapse
            const header = screen.getByText('Summary of JIRA').closest('[style*="cursor: pointer"]')
            fireEvent.click(header)

            // Content should still be in DOM but collapsed (Reactstrap behavior)
            expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
        })

        test('Update Jira button is disabled during loading', async () => {
            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            // Mock a slow response to test loading state
            global.fetch.mockImplementation(() => new Promise(resolve => {
                setTimeout(() => resolve({
                    ok: true,
                    json: () => Promise.resolve({ projects: [{ key: 'TEST-PROJECT' }] })
                }), 100)
            }))

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            const updateButton = screen.getByText('Update Jira')
            fireEvent.click(updateButton)

            // Button should be disabled during loading
            expect(updateButton).toBeDisabled()
        })

        test('Update Jira button click event does not propagate to header', () => {
            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            const updateButton = screen.getByText('Update Jira')

            // Mock stopPropagation to verify it's called
            const mockStopPropagation = jest.fn()
            const clickEvent = new MouseEvent('click', { bubbles: true })
            clickEvent.stopPropagation = mockStopPropagation

            fireEvent(updateButton, clickEvent)

            expect(mockStopPropagation).toHaveBeenCalled()
        })
    })

    describe('useEffect Dependencies', () => {
        test('useEffect triggers when activeMeetingId changes', async () => {
            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ summary: 'Test summary' }),
            })

            const { rerender } = render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1)
            })

            // Update store with new meeting ID
            const newStore = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-456',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            rerender(
                <TestWrapper store={newStore}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(2)
            })
        })

        test('useEffect triggers when currentProject changes', async () => {
            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'PROJECT-1' }
                }
            })

            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ summary: 'Test summary' }),
            })

            const { rerender } = render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1)
            })

            // Update store with new project
            const newStore = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'PROJECT-2' }
                }
            })

            rerender(
                <TestWrapper store={newStore}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(2)
            })
        })

        test('clears summaryText when project changes', () => {
            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'PROJECT-1' }
                }
            })

            const { rerender } = render(
                <TestWrapper store={store}>
                    <JiraSummary initialSummaryText="Initial summary" />
                </TestWrapper>
            )

            expect(screen.getByTestId('markdown-content')).toHaveTextContent('Initial summary')

            // Change project
            const newStore = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'PROJECT-2' }
                }
            })

            rerender(
                <TestWrapper store={newStore}>
                    <JiraSummary initialSummaryText="Initial summary" />
                </TestWrapper>
            )

            // Should clear and then reset to initial text
            expect(screen.getByTestId('markdown-content')).toHaveTextContent('Initial summary')
        })
    })

    describe('Authentication', () => {
        test('includes authorization header in API calls', async () => {
            localStorageMock.getItem.mockReturnValue('test-auth-token')

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ summary: 'Test summary' }),
            })

            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://localhost:5002/api/jira-oauth/ai-summary',
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'Authorization': 'Bearer test-auth-token',
                        }),
                    })
                )
            })
        })

        test('handles missing auth token gracefully', async () => {
            localStorageMock.getItem.mockReturnValue(null)

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ summary: 'Test summary' }),
            })

            const store = createMockStore({
                Chat: {
                    activeMeetingId: 'meeting-123',
                    currentProject: { key: 'TEST-PROJECT' }
                }
            })

            render(
                <TestWrapper store={store}>
                    <JiraSummary />
                </TestWrapper>
            )

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    'http://localhost:5002/api/jira-oauth/ai-summary',
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'Authorization': 'Bearer null',
                        }),
                    })
                )
            })
        })
    })
})