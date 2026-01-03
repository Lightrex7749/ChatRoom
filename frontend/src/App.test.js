import { render, screen } from '@testing-library/react';
import App from './App';
import axios from 'axios';

// Mock ResizeObserver for framer-motion/layout-animations
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

test('renders join screen by default', () => {
  render(<App />);
  expect(screen.getByText('ConnectHub')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
});
