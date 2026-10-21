// src/components/ChatInput.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChatInput from '../../../admin/src/pages/dashboard/UserChat/ChatInput';

// ---- Mocks ----
jest.mock('emoji-picker-react', () => (props) => (
  <button data-testid="emoji-picker-button" onClick={() => props.onEmojiClick({ emoji: '😀' })}>
    Pick 😀
  </button>
));

// mock RecordingModal
jest.mock('../../../admin/src/components/RecordingModal', () => (props) => (
  <div data-testid="recording-modal">
    <button onClick={props.onClose}>Close</button>
  </div>
));

// mock react-redux
jest.mock('react-redux', () => ({
  useSelector: (selector) => selector({ Chat: { activeMeetingId: 'meeting-1' } }),
}));

// ---- helpers ----
const BASE = 'http://localhost:5002/api';

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
  localStorage.setItem('authUser', JSON.stringify({ user_id: 'u-1', username: 'leshan' }));
  localStorage.setItem('access_token', 'tok');
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

// ---- tests ----
describe('ChatInput', () => {
    test('renders input and allows typing; emoji appends to text', async () => {
        const { container } = render(<ChatInput onaddMessage={jest.fn()} />);

    const input = screen.getByPlaceholderText(/Enter Message/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(input).toHaveValue('Hello');


    const toggleBtn = container.querySelector('button#emoji'); 
    fireEvent.click(toggleBtn);
    fireEvent.click(await screen.findByTestId('emoji-picker-button'));

    expect(input).toHaveValue('Hello😀');
  });

  test('send text success -> calls onaddMessage and clears input', async () => {
    const onaddMessage = jest.fn();
    const onFetchMessages = jest.fn();

    mockFetch({
      'POST /api/ask-gemini': async ({ init }) => {
        const payload = JSON.parse(init.body);
        expect(payload).toMatchObject({
          content: 'Hi',
          meeting_id: 'meeting-1',
          user_id: 'u-1',
          speaker: 'leshan',
        });
        return { ok: true, status: 200, json: async () => ({}) };
      },
    });

    render(<ChatInput onaddMessage={onaddMessage} onFetchMessages={onFetchMessages} />);

    const input = screen.getByPlaceholderText(/Enter Message/i);
    fireEvent.change(input, { target: { value: 'Hi' } });

    const sendBtn = screen.getAllByRole('button').find((b) =>
      b.className.includes('ri-send-plane-2-fill')
    ) || screen.getAllByRole('button')[1];
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(onaddMessage).toHaveBeenCalledWith('Hi', 'textMessage');
    });
    expect(onFetchMessages).toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  test('empty submit does nothing', async () => {
    const onaddMessage = jest.fn();
    render(<ChatInput onaddMessage={onaddMessage} />);
    const sendBtn = screen.getAllByRole('button').find((b) =>
      b.className.includes('ri-send-plane-2-fill')
    ) || screen.getAllByRole('button')[1];
    fireEvent.click(sendBtn);
    await new Promise((r) => setTimeout(r, 0));
    expect(onaddMessage).not.toHaveBeenCalled();
  });

  test('upload file success -> adds file message and triggers callbacks', async () => {
    const onaddMessage = jest.fn();
    const onFetchMessages = jest.fn();
    const onMaterialUploaded = jest.fn();

    mockFetch({
      'POST /meetings/meeting-1/upload-material': async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      }),
    });

    const { container } = render(
      <ChatInput
        onaddMessage={onaddMessage}
        onFetchMessages={onFetchMessages}
        onMaterialUploaded={onMaterialUploaded}
      />
    );

    const fileInput = container.querySelector('input[type="file"][name="fileInput"]');
    const file = new File(['abc'], 'doc.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(onaddMessage).toHaveBeenCalledWith(file, 'fileMessage');

    await waitFor(() => {
      expect(onFetchMessages).toHaveBeenCalled();
      expect(onMaterialUploaded).toHaveBeenCalled();
    });
  });

  test('upload 404 -> alerts "Meeting not found..."', async () => {
    mockFetch({
      'POST /meetings/meeting-1/upload-material': async () => ({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      }),
    });

    const { container } = render(<ChatInput onaddMessage={jest.fn()} />);

    const fileInput = container.querySelector('input[type="file"][name="fileInput"]');
    const file = new File(['a'], 'a.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'Meeting not found. Please make sure you have selected a valid meeting.'
      );
    });
  });

  test('upload network error -> alerts network error', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const { container } = render(<ChatInput onaddMessage={jest.fn()} />);

    const fileInput = container.querySelector('input[type="file"][name="fileInput"]');
    const file = new File(['a'], 'a.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'Network error: Unable to upload file. Please check your connection and try again.'
      );
    });
  });

  test('mic button opens and closes RecordingModal', async () => {
    const { container } = render(<ChatInput onaddMessage={jest.fn()} />);
    const micIcon = container.querySelector('i.ri-mic-fill');
    const micBtn = micIcon.closest('button');
    fireEvent.click(micBtn);

    expect(await screen.findByTestId('recording-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    await waitFor(() => {
      expect(screen.queryByTestId('recording-modal')).not.toBeInTheDocument();
    });
  });
});
