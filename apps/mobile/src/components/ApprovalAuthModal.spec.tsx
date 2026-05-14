import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ApprovalAuthModal } from './ApprovalAuthModal';

describe('ApprovalAuthModal', () => {
  it('should authenticate approval with the demo simple password', async () => {
    const onAuthenticated = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <ApprovalAuthModal
        visible
        title="결제 승인 인증"
        description="승인하려면 본인 인증이 필요합니다."
        onCancel={jest.fn()}
        onAuthenticated={onAuthenticated}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('간편비밀번호 6자리'), '123456');
    fireEvent.press(getByText('간편비밀번호로 승인'));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
  });

  it('should reject an incorrect simple password', async () => {
    const onAuthenticated = jest.fn();
    const { getByPlaceholderText, getByText, findByText } = render(
      <ApprovalAuthModal
        visible
        title="결제 승인 인증"
        description="승인하려면 본인 인증이 필요합니다."
        onCancel={jest.fn()}
        onAuthenticated={onAuthenticated}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('간편비밀번호 6자리'), '000000');
    fireEvent.press(getByText('간편비밀번호로 승인'));

    expect(await findByText('간편비밀번호가 올바르지 않습니다.')).toBeTruthy();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});
