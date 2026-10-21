/**
 * src/pages/Auth/Register.test.js
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import Register from '../../../admin/src/pages/Auth/Register';

// ---------- Mocks ----------
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
}));

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  connect: () => (Comp) => Comp,
  useSelector: () => ({}),
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

// ---------- Helpers ----------
const BASE = 'http://localhost:5002/api';

function renderWithRouter(ui, initialPath = '/register') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/register" element={ui} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function mockFetch(handlers) {
  global.fetch = jest.fn((input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || 'GET').toUpperCase();
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
describe('Register', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders fields & button', () => {
    renderWithRouter(<Register />);
    expect(screen.getByPlaceholderText(/Enter Username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter Email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter Password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Confirm Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register/i })).toBeInTheDocument();
  });

  test('validation: required, email format, password match', async () => {
    renderWithRouter(<Register />);
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    // Required
    expect(await screen.findAllByText(/Required/i)).toHaveLength(4);

    // Email format + password mismatch
    fireEvent.change(screen.getByPlaceholderText(/Enter Username/i), { target: { value: 'u' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Email/i), { target: { value: 'bad' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Password/i), { target: { value: 'p1' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    expect(await screen.findByText(/Enter proper email/i)).toBeInTheDocument();
    expect(await screen.findByText(/Passwords must match/i)).toBeInTheDocument();
  });

  test('register success + auto login success -> success modal then navigate /login', async () => {
    mockFetch({
      'POST /register': async ({ init }) => {
        const body = JSON.parse(init.body);
        expect(body).toMatchObject({
          username: 'iris',
          email: 'i@test.com',
          password: 'pw',
          confirmPassword: 'pw',
        });
        return { ok: true, status: 200, json: async () => ({}) };
      },
      'POST /login': async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 't', user_id: 1, username: 'iris' }),
      }),
    });

    renderWithRouter(<Register />);

    fireEvent.change(screen.getByPlaceholderText(/Enter Username/i), { target: { value: 'iris' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Email/i), { target: { value: 'i@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Password/i), { target: { value: 'pw' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'pw' } });

    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    expect(await screen.findByTestId('alert-title')).toHaveTextContent(/Success/i);
    expect(screen.getByTestId('alert-msg')).toHaveTextContent(/Register successfully/i);

    fireEvent.click(screen.getByText('OK'));
    await waitFor(() => expect(screen.getByText(/Login Page/i)).toBeInTheDocument());

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `${BASE}/register`,
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `${BASE}/login`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('register success but auto login !ok -> show Error modal', async () => {
    mockFetch({
      'POST /register': async () => ({ ok: true, status: 200, json: async () => ({}) }),
      'POST /login': async () => ({
        ok: false,
        status: 400,
        text: async () => 'login failed',
        json: async () => ({ message: 'login failed' }),
      }),
    });

    renderWithRouter(<Register />);

    fireEvent.change(screen.getByPlaceholderText(/Enter Username/i), { target: { value: 'u' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Email/i), { target: { value: 'u@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Password/i), { target: { value: 'pw' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    expect(await screen.findByTestId('alert-title')).toHaveTextContent(/Error/i);
    expect(screen.getByTestId('alert-msg')).toHaveTextContent(/Registration failure/i);
  });

  test('register !ok -> show "Registration Failed" with server text', async () => {
    mockFetch({
      'POST /register': async () => ({
        ok: false,
        status: 400,
        text: async () => 'Email already used',
        json: async () => ({ message: 'Email already used' }),
      }),
    });

    renderWithRouter(<Register />);

    fireEvent.change(screen.getByPlaceholderText(/Enter Username/i), { target: { value: 'u' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Email/i), { target: { value: 'u@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Password/i), { target: { value: 'pw' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    expect(await screen.findByTestId('alert-title')).toHaveTextContent(/Registration Failed/i);
    expect(screen.getByTestId('alert-msg')).toHaveTextContent(/Email already used/i);
  });

  test('network error -> show Error modal', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

    renderWithRouter(<Register />);

    fireEvent.change(screen.getByPlaceholderText(/Enter Username/i), { target: { value: 'u' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Email/i), { target: { value: 'u@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Password/i), { target: { value: 'pw' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm Password/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    expect(await screen.findByTestId('alert-title')).toHaveTextContent(/Error/i);
    expect(screen.getByTestId('alert-msg')).toHaveTextContent(/Registration failure/i);
  });
});
