import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { XrplTransactionProof, buildXrplTransactionUrl } from './XrplTransactionProof';

describe('XrplTransactionProof', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a verifiable XRPL Testnet proof with a shortened transaction hash', () => {
    const { getByText } = render(
      <XrplTransactionProof txHash="ABCDEF1234567890ABCDEF1234567890" label="정산 증빙" />,
    );

    expect(getByText('정산 증빙')).toBeTruthy();
    expect(getByText('XRPL Testnet 증빙')).toBeTruthy();
    expect(getByText('ABCDEF12...34567890')).toBeTruthy();
    expect(getByText('XRPL Explorer에서 확인')).toBeTruthy();
  });

  it('opens the XRPL Testnet transaction URL', async () => {
    const txHash = 'ABCDEF1234567890ABCDEF1234567890';
    const { getByLabelText } = render(<XrplTransactionProof txHash={txHash} />);

    fireEvent.press(getByLabelText('XRPL Explorer에서 원장 증빙 확인'));

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(buildXrplTransactionUrl(txHash));
    });
  });
});
