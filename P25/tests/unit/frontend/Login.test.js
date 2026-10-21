/**
 * src/pages/Auth/Login.test.js
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import Login from '../../../admin/src/pages/Auth/Login';

// ---------- Mocks ----------
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
}));

jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
  connect: () => (Comp) => Comp,
}));

jest.mock('../../components/AlertModal', () => (props) => {
  const { isOpen, title, message, onConfirm } = props;
  if (!isOpen) return null;
  return (
    <div role="dialog" aria-modal="true">
      <h3 data-testid="alert-title">{title}</h3>
      <p data-testid="alert-msg">{message}</p>
      <button onClick={onConfirm}>OK</button>
    </div>
  );
});

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

Object.defineProperty(window, 'location', {
  writable: true,
  value: { href: '' },
});

// ---------- Helpers ----------
const BASE = 'http://localhost:5002/api';

function renderWithRouter(ui, initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={ui} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function mockFetch(handlers) {
  global.fetch = jest.fn((input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    const hitKey = Object.keys(handlers).find((k) => {
      const [wantMethod, part] = k.split(' ');
      return method === wantMethod && url.includes(part);
    });
    if (!hitKey) {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ message: 'not mocked' }),
        text: async () => 'not mocked',
      });
    }
    return handlers[hitKey]({ url, method, init });
  });
}

// ---------- Tests ----------
describe('Login', () => {
  afterEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.location.href = '';
  });

  test('renders form fields & button', () => {
    renderWithRouter(<Login />);
    expect(screen.getByPlaceholderText(/enter\s*email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter\s*password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign\s*in/i })).toBeInTheDocument();
  });

  test('successful login + already connected -> navigates to /dashboard and stores token', async () => {
    mockFetch({
      'POST /login': () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'tok_123',
            user_id: 42,
            username: 'iris',
          }),
        }),
      'GET /oauth/jira/status': () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connected: true, token_valid: true }),
        }),
    });

    renderWithRouter(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/enter\s*email/i), {
      target: { value: 'u@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/enter\s*password/i), {
      target: { value: 'pw' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign\s*in/i }));

    await waitFor(() => expect(screen.getByText(/dashboard/i)).toBeInTheDocument());

    expect(window.localStorage.getItem('access_token')).toBe('tok_123');
    const authUser = JSON.parse(window.localStorage.getItem('authUser'));
    expect(authUser.email).toBe('u@test.com');
    expect(authUser.user_id).toBe(42);
    expect(authUser.username).toBe('iris');
  });

  test('successful login but NOT connected -> starts Jira authorize and sets window.location.href', async () => {
    mockFetch({
      'POST /login': () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'tok_abc',
            user_id: 7,
            username: 'morris',
          }),
        }),
      'GET /oauth/jira/status': () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connected: false, token_valid: false }),
        }),
      'POST /oauth/jira/authorize': () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ authorization_url: 'https://jira.example.com/oauth' }),
        }),
    });

    renderWithRouter(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/enter\s*email/i), {
      target: { value: 'a@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/enter\s*password/i), {
      target: { value: 'b' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign\s*in/i }));

    await waitFor(() =>
      expect(window.location.href).toBe('https://jira.example.com/oauth')
    );

    expect(window.localStorage.getItem('access_token')).toBe('tok_abc');
  });

  test('backend error -> shows AlertModal with message', async () => {
    mockFetch({
      'POST /login': () =>
        Promise.resolve({
          ok: false,
          status: 400,
          text: async () => 'Invalid credentials',
          json: async () => ({ message: 'Invalid credentials' }),
        }),
    });

    renderWithRouter(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/enter\s*email/i), {
      target: { value: 'bad@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/enter\s*password/i), {
      target: { value: 'wrong' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign\s*in/i }));

    const title = await screen.findByTestId('alert-title');
    const msg = await screen.findByTestId('alert-msg');

    expect(title).toHaveTextContent(/login failed/i);
    expect(msg).toHaveTextContent(/invalid/i);
  });
});
