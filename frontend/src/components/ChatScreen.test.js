import { render, screen, fireEvent } from '@testing-library/react';
import ChatScreen from './ChatScreen';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Mock the hooks
jest.mock('@/hooks/useWebSocket');
jest.mock('@/hooks/useWebRTC');

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('ChatScreen', () => {
  const mockUser = { id: '1', username: 'me' };
  const mockOnLeave = jest.fn();

  beforeEach(() => {
    useWebSocket.mockReturnValue({
      users: [],
      messages: [],
      sendMessage: jest.fn(),
      typing: {},
      incomingCall: null,
      acceptCall: jest.fn(),
      rejectCall: jest.fn(),
      isConnected: true,
      registerMessageHandler: jest.fn(),
      deleteMessage: jest.fn(),
    });

    useWebRTC.mockReturnValue({
      localStream: null,
      remoteStream: null,
      callState: 'idle',
      startCall: jest.fn(),
      acceptCall: jest.fn(),
      endCall: jest.fn(),
      toggleAudio: jest.fn(),
      toggleVideo: jest.fn(),
      isAudioEnabled: true,
      isVideoEnabled: true,
    });
  });

  test('renders welcome message when no user is selected', () => {
    render(
      <ThemeProvider>
        <ChatScreen user={mockUser} onLeave={mockOnLeave} />
      </ThemeProvider>
    );
    expect(screen.getByText(/Select a friend to start chatting/i)).toBeInTheDocument();
  });
});
