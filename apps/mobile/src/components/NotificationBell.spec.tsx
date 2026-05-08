import React from 'react';
import { render } from '@testing-library/react-native';
import { NotificationBell } from './NotificationBell';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// Mock useUnreadCount hook
let mockUnreadCount = 0;
jest.mock('../hooks/useUnreadCount', () => ({
  useUnreadCount: () => mockUnreadCount,
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnreadCount = 0;
  });

  it('should render bell icon', () => {
    const { getByText } = render(<NotificationBell />);
    expect(getByText('🔔')).toBeTruthy();
  });

  it('should not show badge when unread count is 0', () => {
    mockUnreadCount = 0;
    const { queryByText } = render(<NotificationBell />);
    // Badge text should not exist
    expect(queryByText('0')).toBeNull();
  });

  it('should show badge with count when unread > 0', () => {
    mockUnreadCount = 5;
    const { getByText } = render(<NotificationBell />);
    expect(getByText('5')).toBeTruthy();
  });

  it('should show 99+ when unread count exceeds 99', () => {
    mockUnreadCount = 150;
    const { getByText } = render(<NotificationBell />);
    expect(getByText('99+')).toBeTruthy();
  });
});
