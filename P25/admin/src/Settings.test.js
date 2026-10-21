import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import Settings from './pages/dashboard/Tabs/Settings';

// ---- Mocks ----
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (s) => s }),
}));

jest.mock('simplebar-react', () => (props) => <div {...props} />);
jest.mock('./components/CustomCollapse', () => (props) => (
  <div data-testid="custom-collapse">{props.children}</div>
));
jest.mock('./components/AlertModal', () => (props) => {
  if (!props.isOpen) return null;
  return (
    <div data-testid="alert-modal">
      <div data-testid="alert-title">{props.title}</div>
      <div data-testid="alert-msg">{props.message}</div>
      <button onClick={props.onConfirm}>OK</button>
    </div>
  );
});
jest.mock('./assets/images/users/avatar-1.jpg', () => 'avatar.jpg');

// ---- helpers ----
function mockFetch(handlers) {
  global.fetch = jest.fn((input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || 'GET').toUpperCase();
    const key = Object.keys(handlers).find((k) => {
      const [m, part] = k.split(' ');
      return m === method && url.includes(part);
    });
    if (!key) {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ message: 'not mocked' }),
        text: async () => 'not mocked',
      });
    }
    return handlers[key]({ url, method, init });
  });
}

beforeEach(() => {
  localStorage.setItem('access_token', 'tok-123');
  localStorage.setItem('authUser', JSON.stringify({ username: 'leshan', email: 'u@test.com' }));
});

afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('Settings', () => {
  test('Authorize with Jira -> POST authorize and set window.location.href', async () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };

    mockFetch({
      'GET /oauth/jira/status': async () => ({
        ok: true,
        status: 200,
        json: async () => ({ connected: false }),
      }),
      'POST /oauth/jira/authorize': async ({ init }) => {
        expect(init.headers.Authorization).toBe('Bearer tok-123');
        return {
          ok: true,
          status: 200,
          json: async () => ({ authorization_url: 'https://jira.example.com/oauth' }),
        };
      },
    });

    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /Authorize with Jira/i }));

    await waitFor(() => {
      expect(window.location.href).toBe('https://jira.example.com/oauth');
    });

    // 还原 window.location
    window.location = originalLocation;
  });

  test('Disconnect flow when connected -> shows success modal and disables button', async () => {
    mockFetch({
      'GET /oauth/jira/status': async () => ({
        ok: true,
        status: 200,
        json: async () => ({ connected: true }),
      }),
      'GET /jira-oauth/my-projects': async ({ init }) => {
        expect(init.headers.Authorization).toBe('Bearer tok-123');
        return {
          ok: true,
          status: 200,
          json: async () => ({ projects: [{ key: 'ABC' }] }),
        };
      },
      'DELETE /jira-oauth/project-preferences/ABC': async ({ init }) => {
        expect(init.headers.Authorization).toBe('Bearer tok-123');
        return { ok: true, status: 204, json: async () => ({}) };
      },
      'POST /oauth/jira/disconnect': async ({ init }) => {
        expect(init.headers.Authorization).toBe('Bearer tok-123');
        return { ok: true, status: 200, json: async () => ({}) };
      },
    });

    render(<Settings />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Disconnect/i })).not.toBeDisabled()
    );
    const disconnectBtn = screen.getByRole('button', { name: /Disconnect/i });
    fireEvent.click(disconnectBtn);

    const modal = await screen.findByTestId('alert-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId('alert-title')).toHaveTextContent(/Disconnected/i);
    expect(screen.getByTestId('alert-msg')).toHaveTextContent(/successfully disconnected/i);

    fireEvent.click(screen.getByText('OK'));
    await waitFor(() => {
      expect(screen.queryByTestId('alert-modal')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeDisabled();
  });
});
