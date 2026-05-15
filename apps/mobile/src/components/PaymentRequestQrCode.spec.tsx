import React from 'react';
import { render } from '@testing-library/react-native';
import { PaymentRequestQrCode } from './PaymentRequestQrCode';

describe('PaymentRequestQrCode', () => {
  it('should render an accessible real payment QR for a payment request code', () => {
    const screen = render(<PaymentRequestQrCode code="TP-123456" />);

    expect(screen.getByLabelText('TP-123456 실제 결제 QR')).toBeTruthy();
    expect(screen.getByTestId('payment-request-qr-code').props.accessibilityRole).toBe('image');
  });
});
