import React from 'react';
import { render } from '@testing-library/react-native';
import { buildPaymentRequestQrPayload, PaymentRequestQrCode } from './PaymentRequestQrCode';

describe('PaymentRequestQrCode', () => {
  it('should encode a payment deep link instead of only the visible short code', () => {
    expect(buildPaymentRequestQrPayload(' TP-123456 ')).toBe('trustpay://payment-request?code=TP-123456');
  });

  it('should render an accessible real payment QR for a payment request code', () => {
    const screen = render(<PaymentRequestQrCode code="TP-123456" />);

    expect(screen.getByLabelText('TP-123456 실제 결제 QR, 스캔하면 결제 요청을 불러옵니다')).toBeTruthy();
    expect(screen.getByTestId('payment-request-qr-code').props.accessibilityRole).toBe('image');
    expect(screen.getByText('SCAN')).toBeTruthy();
  });
});
