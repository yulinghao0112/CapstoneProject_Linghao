import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import Logout from './pages/Auth/Logout';

// --- Prefixed mocks (allowed in jest.mock factories) ---
const mockDispatch = jest.fn();
const mockUseSelector = jest.fn();
const mockLogoutUser = jest.fn(() => ({ type: 'LOGOUT' }));
const mockNavigate = jest.fn();

// react-redux: provide mock dispatch/selector/connect
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (sel) => mockUseSelector(sel),
  connect: () => (Comp) => Comp,
}));

// withRouter: inject a stable navigate function
jest.mock('./components/withRouter', () => {
  return (Comp) =>
    function Wrapped(props) {
      return <Comp {...props} router={{ navigate: mockNavigate }} />;
    };
});

// redux actions: expose a mocked logoutUser creator
jest.mock('./redux/actions', () => ({
  logoutUser: (...args) => mockLogoutUser(...args),
}));

// reselect: keep it simple—selector returns isUserLogout directly
jest.mock('reselect', () => ({
  createSelector:
    () =>
    (state) =>
      state.Auth.isUserLogout,
}));

// Helper: render with routes
function renderWithRoutes(ui) {
  return render(
    <MemoryRouter initialEntries={['/logout']}>
      <Routes>
        <Route path="/logout" element={ui} />
        <Route path="/login" element={<div>LoginPage</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default state: not logged out yet
    mockUseSelector.mockImplementation((sel) =>
      sel({ Auth: { isUserLogout: false } })
    );
  });

  test('dispatches logoutUser with navigate on mount', async () => {
    renderWithRoutes(<Logout />);

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockLogoutUser).toHaveBeenCalledTimes(1);
      expect(mockLogoutUser).toHaveBeenCalledWith(mockNavigate);
    });

    // No redirect when isUserLogout = false
    expect(screen.queryByText(/LoginPage/i)).not.toBeInTheDocument();
    expect(document.title).toBe('Logout');
  });

  test('navigates to /login when isUserLogout is true', async () => {
    mockUseSelector.mockImplementation((sel) =>
      sel({ Auth: { isUserLogout: true } })
    );

    renderWithRoutes(<Logout />);

    expect(await screen.findByText(/LoginPage/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockLogoutUser).toHaveBeenCalledWith(mockNavigate);
    });
  });
});
