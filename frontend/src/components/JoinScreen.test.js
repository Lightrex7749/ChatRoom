import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JoinScreen from './JoinScreen';
import axios from 'axios';

// Mock ResizeObserver for framer-motion
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('JoinScreen', () => {
  const mockOnJoin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls onJoin after successful login', async () => {
    const userData = { id: '123', username: 'testuser' };
    axios.post.mockResolvedValueOnce({ data: userData });

    render(<JoinScreen onJoin={mockOnJoin} />);

    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
    
    // In JoinScreen, the button text for login is "Sign In"
    const submitButton = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/login'), {
        username: 'testuser',
        password: 'password123'
      });
      expect(mockOnJoin).toHaveBeenCalledWith(userData);
    });
  });

  test('switches to register mode and calls onJoin after successful registration', async () => {
    const userData = { id: '456', username: 'newuser' };
    axios.post.mockResolvedValueOnce({ data: userData });

    render(<JoinScreen onJoin={mockOnJoin} />);

    // Toggle to Sign Up
    const toggleButton = screen.getByText(/Don't have an account\? Sign up/i);
    fireEvent.click(toggleButton);

    expect(screen.getByText(/Create an account to get started/i)).toBeInTheDocument();
    
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password456' } });

    const submitButton = screen.getByRole('button', { name: /Sign Up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/register'), {
        username: 'newuser',
        password: 'password456'
      });
      expect(mockOnJoin).toHaveBeenCalledWith(userData);
    });
  });

  test('displays error message on failed login', async () => {
    const errorMessage = 'Invalid credentials';
    axios.post.mockRejectedValueOnce({
      response: { data: { detail: errorMessage } }
    });

    render(<JoinScreen onJoin={mockOnJoin} />);

    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'user' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(mockOnJoin).not.toHaveBeenCalled();
    });
  });
});
