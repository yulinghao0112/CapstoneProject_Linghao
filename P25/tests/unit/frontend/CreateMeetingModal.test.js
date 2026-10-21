// src/components/CreateMeetingModal.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateMeetingModal from '../../../admin/src/components/CreateMeetingModal';

// Mock the AlertModal so we can see title/message and click OK
jest.mock('../../../admin/src/components/AlertModal', () => (props) => {
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

// Small fetch router helper
function mockFetchRouter(handlers) {
  global.fetch = jest.fn((input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const match = Object.entries(handlers).find(([needle]) => url.includes(needle));
    if (!match) {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ message: 'not mocked' }),
        text: async () => 'not mocked',
      });
    }
    const handler = match[1];
    return handler({ url, init });
  });
}

describe('CreateMeetingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set required localStorage items
    localStorage.clear();
    localStorage.setItem('access_token', 'tok_123');
    localStorage.setItem('authUser', JSON.stringify({ user_id: 7, email: 'u@test.com' }));
  });

  test('validation: empty title shows Missing Title alert', async () => {
    mockFetchRouter({}); // no network calls expected

    render(<CreateMeetingModal isOpen={true} toggle={() => {}} onCreate={() => {}} />);

    // Click Create with empty title
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    // Expect validation modal
    expect(await screen.findByTestId('alert-title')).toHaveTextContent(/missing title/i);
    expect(screen.getByTestId('alert-msg')).toHaveTextContent(/please enter/i);

    // Close the alert
    fireEvent.click(screen.getByText(/^ok$/i));
  });

  test('happy path: creates meeting and calls onCreate with new id', async () => {
    const toggle = jest.fn();
    const onCreate = jest.fn();

    // Mock the full API chain
    mockFetchRouter({
      '/meetings/next-id': () =>
        Promise.resolve({ ok: true, status: 200, json: async () => ({ next_meeting_id: 123 }) }),
      '/meetings/create': () =>
        Promise.resolve({ ok: true, status: 201, text: async () => '' }),
      '/jira-oauth/my-projects': () =>
        Promise.resolve({ ok: true, status: 200, json: async () => ({ projects: [{ key: 'ABC' }] }) }),
      '/jira-oauth/sync-from-jira': () =>
        Promise.resolve({ ok: true, status: 200, text: async () => 'ok' }),
      '/jira-oauth/ai-summary': () =>
        Promise.resolve({ ok: true, status: 200, text: async () => 'ok' }),
    });

    render(<CreateMeetingModal isOpen={true} toggle={toggle} onCreate={onCreate} />);

    // Type a meeting title
    fireEvent.change(screen.getByLabelText(/meeting title/i), {
      target: { value: 'Sprint Planning' },
    });

    // Click Create
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    // Button should show loading state ("Creating...") and be disabled
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()
    );

    // Success alert appears
    const title = await screen.findByTestId('alert-title');
    expect(title).toHaveTextContent(/success/i);
    expect(screen.getByTestId('alert-msg')).toHaveTextContent(/synchronize jira successfully/i);

    // Confirm (OK) triggers onCreate(next_meeting_id) and toggle()
    fireEvent.click(screen.getByText(/^ok$/i));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(123);
      expect(toggle).toHaveBeenCalled();
    });

    // Ensure all network calls were made
    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(global.fetch.mock.calls[0][0]).toContain('/meetings/next-id');
    expect(global.fetch.mock.calls[1][0]).toContain('/meetings/create');
    expect(global.fetch.mock.calls[2][0]).toContain('/jira-oauth/my-projects');
    expect(global.fetch.mock.calls[3][0]).toContain('/jira-oauth/sync-from-jira');
    expect(global.fetch.mock.calls[4][0]).toContain('/jira-oauth/ai-summary');
  });
});
