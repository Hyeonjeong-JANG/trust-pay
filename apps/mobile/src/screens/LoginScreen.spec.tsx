import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginScreen } from './LoginScreen';

// Mock API
jest.mock('../api/client', () => ({
  api: {
    requestCode: jest.fn(),
    verifyCode: jest.fn(),
    verifyBusinessRegistrationNumber: jest.fn(),
    registerBusiness: jest.fn(),
  },
}));

// Mock zustand store
const mockSetAuth = jest.fn();
jest.mock('../store/auth', () => ({
  useAuthStore: (selector: any) =>
    selector({ setAuth: mockSetAuth, role: null, userId: null, name: null, token: null }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should render title and subtitle', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(getByText('TrustPay')).toBeTruthy();
    expect(getByText('원화 우선 선불 보호 서비스')).toBeTruthy();
  });

  it('should render role selector with 소비자 and 사업자', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(getByText('소비자')).toBeTruthy();
    expect(getByText('사업자')).toBeTruthy();
  });

  it('should render one identifier input for phone or email', () => {
    const { getByPlaceholderText } = renderWithProviders(<LoginScreen />);
    expect(getByPlaceholderText('전화번호 또는 이메일')).toBeTruthy();
  });

  it('should not render login method selector or name input', () => {
    const { getByText, queryByText } = renderWithProviders(<LoginScreen />);
    expect(queryByText('이름 (선택)')).toBeNull();
    expect(queryByText('이메일')).toBeNull();
    expect(getByText('소비자')).toBeTruthy();
    expect(getByText('사업자')).toBeTruthy();
  });

  it('should show consumer hint when consumer role selected', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(
      getByText('첫 로그인 시 원화 우선 표시와 보호 원장 증빙이 자동 준비됩니다'),
    ).toBeTruthy();
  });

  it('should show business hint when business role selected', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);

    fireEvent.press(getByText('사업자'));

    expect(
      getByText('사업자는 국세청 사업자등록번호 인증 후 가입할 수 있습니다'),
    ).toBeTruthy();
  });

  it('should show request code button before OTP is issued', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(getByText('인증코드 받기')).toBeTruthy();
  });

  it('should not show shortcut demo account buttons', () => {
    const { queryByText } = renderWithProviders(<LoginScreen />);
    expect(queryByText('심사용 데모 계정')).toBeNull();
    expect(queryByText('김민수 소비자')).toBeNull();
    expect(queryByText('파워짐 사업자')).toBeNull();
  });

  it('should keep request code button available when valid phone entered', () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('전화번호 또는 이메일'), '010-1234-5678');

    expect(getByText('인증코드 받기')).toBeTruthy();
  });

  it('should keep request code button available when valid email entered', () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('전화번호 또는 이메일'), 'test@test.com');

    expect(getByText('인증코드 받기')).toBeTruthy();
  });

  it('should request an OTP and prefill demo code without exposing helper text', async () => {
    const { api } = require('../api/client');
    api.requestCode.mockResolvedValue({ delivery: 'demo', code: '123456', expiresInSeconds: 300 });

    const { getByText, getByPlaceholderText, queryByText } = renderWithProviders(
      <LoginScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('전화번호 또는 이메일'), '010-1234-5678');
    fireEvent.press(getByText('인증코드 받기'));

    await waitFor(() => {
      expect(api.requestCode).toHaveBeenCalledWith({
        phone: '01012345678',
        role: 'consumer',
      });
    });

    await waitFor(() => {
      expect(getByText('로그인')).toBeTruthy();
      expect(getByPlaceholderText('123456')).toBeTruthy();
    });

    expect(queryByText('데모 인증코드: 123456')).toBeNull();
    expect(getByPlaceholderText('123456').props.value).toBe('123456');
  });

  it('should show request-code errors in an in-app modal', async () => {
    const { api } = require('../api/client');
    api.requestCode.mockRejectedValue({ code: 'NETWORK', userMessage: '네트워크에 연결할 수 없습니다.' });

    const { getByText, getByPlaceholderText, findByText } = renderWithProviders(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('전화번호 또는 이메일'), '010-1234-5678');
    fireEvent.press(getByText('인증코드 받기'));

    expect(await findByText('네트워크 오류')).toBeTruthy();
    expect(await findByText('네트워크에 연결할 수 없습니다.')).toBeTruthy();
  });

  it('should verify OTP and store the signed session token', async () => {
    const { api } = require('../api/client');
    api.requestCode.mockResolvedValue({ delivery: 'demo', code: '123456', expiresInSeconds: 300 });
    api.verifyCode.mockResolvedValue({
      userId: 'c-1',
      role: 'consumer',
      name: '테스트',
      token: 'signed-token',
    });

    const { getByText, getByPlaceholderText } = renderWithProviders(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('전화번호 또는 이메일'), '010-1234-5678');
    fireEvent.press(getByText('인증코드 받기'));

    await waitFor(() => expect(getByText('로그인')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('123456'), '123456');
    fireEvent.press(getByText('로그인'));

    await waitFor(() => {
      expect(api.verifyCode).toHaveBeenCalledWith({
        phone: '01012345678',
        role: 'consumer',
        code: '123456',
      });
      expect(mockSetAuth).toHaveBeenCalledWith('consumer', 'c-1', '테스트', 'signed-token');
    });
  });

  it('should request OTP for business landline submit', async () => {
    const { api } = require('../api/client');
    api.requestCode.mockResolvedValue({ delivery: 'demo', code: '123456', expiresInSeconds: 300 });

    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen />,
    );

    fireEvent.press(getByText('사업자'));
    fireEvent.changeText(getByPlaceholderText('전화번호 또는 이메일'), '02-1234-5678');
    fireEvent.press(getByText('인증코드 받기'));

    await waitFor(() => {
      expect(api.requestCode).toHaveBeenCalledWith({
        phone: '0212345678',
        role: 'business',
      });
    });
  });

  it('should guide a new business through NTS demo verification and registration before login', async () => {
    const { api } = require('../api/client');
    api.requestCode.mockResolvedValue({ delivery: 'demo', code: '123456', expiresInSeconds: 300, isNewUser: true });
    api.verifyBusinessRegistrationNumber.mockResolvedValue({
      registrationNumber: '1234567890',
      status: 'demo_verified',
      source: 'demo',
      message: '국세청 사업자등록번호 인증은 데모 환경에서 모의 인증으로 진행됩니다.',
    });
    api.registerBusiness.mockResolvedValue({ id: 'biz-new', name: '테스트짐' });
    api.verifyCode.mockResolvedValue({ userId: 'biz-new', role: 'business', name: '테스트짐', token: 'signed-token' });

    const { getByText, getByPlaceholderText, findByText } = renderWithProviders(<LoginScreen />);

    fireEvent.press(getByText('사업자'));
    fireEvent.changeText(getByPlaceholderText('전화번호 또는 이메일'), '02-1234-5678');
    fireEvent.press(getByText('인증코드 받기'));

    expect(await findByText('사업자 가입 정보')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('상호명'), '테스트짐');
    fireEvent.changeText(getByPlaceholderText('업종'), '헬스장');
    fireEvent.changeText(getByPlaceholderText('사업장 주소'), '서울시 강남구 테헤란로 1');
    fireEvent.changeText(getByPlaceholderText('사업자등록번호 10자리'), '123-45-67890');
    fireEvent.press(getByText('국세청 사업자등록번호 인증'));

    expect(await findByText('데모 국세청 인증 완료')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('123456'), '123456');
    fireEvent.press(getByText('가입하고 로그인'));

    await waitFor(() => {
      expect(api.verifyBusinessRegistrationNumber).toHaveBeenCalledWith({ registrationNumber: '1234567890' });
      expect(api.registerBusiness).toHaveBeenCalledWith({
        name: '테스트짐',
        category: '헬스장',
        address: '서울시 강남구 테헤란로 1',
        phone: '0212345678',
        registrationNumber: '1234567890',
      });
      expect(api.verifyCode).toHaveBeenCalledWith({ phone: '0212345678', role: 'business', code: '123456' });
      expect(mockSetAuth).toHaveBeenCalledWith('business', 'biz-new', '테스트짐', 'signed-token');
    });
  });

  it('should not mark an unavailable business registration check as verified', async () => {
    const { api } = require('../api/client');
    api.requestCode.mockResolvedValue({ delivery: 'demo', code: '123456', expiresInSeconds: 300, isNewUser: true });
    api.verifyBusinessRegistrationNumber.mockResolvedValue({
      registrationNumber: '1234567890',
      status: 'unavailable',
      source: 'nts',
      message: '국세청 사업자등록번호 인증을 완료할 수 없어 TrustPay 확인 절차로 진행합니다.',
    });

    const { getByText, getByPlaceholderText, findByText, queryByText } = renderWithProviders(<LoginScreen />);

    fireEvent.press(getByText('사업자'));
    fireEvent.changeText(getByPlaceholderText('전화번호 또는 이메일'), '02-1234-5678');
    fireEvent.press(getByText('인증코드 받기'));

    expect(await findByText('사업자 가입 정보')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('사업자등록번호 10자리'), '123-45-67890');
    fireEvent.press(getByText('국세청 사업자등록번호 인증'));

    await waitFor(() => {
      expect(api.verifyBusinessRegistrationNumber).toHaveBeenCalledWith({ registrationNumber: '1234567890' });
    });
    expect(await findByText('사업자등록번호 인증 실패')).toBeTruthy();
    expect(await findByText('국세청 사업자등록번호 인증을 완료할 수 없어 TrustPay 확인 절차로 진행합니다.')).toBeTruthy();
    expect(queryByText('데모 국세청 인증 완료')).toBeNull();
  });

  it('should show a signup confirmation message for a new consumer phone number', async () => {
    const { api } = require('../api/client');
    api.requestCode.mockResolvedValue({ delivery: 'demo', code: '123456', expiresInSeconds: 300, isNewUser: true });

    const { getByText, getByPlaceholderText, findByText } = renderWithProviders(
      <LoginScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('전화번호 또는 이메일'), '010-9999-0000');
    fireEvent.press(getByText('인증코드 받기'));

    expect(await findByText('처음 이용하는 번호예요')).toBeTruthy();
    expect(await findByText('인증하면 새 TrustPay 소비자 계정이 만들어집니다. 번호를 다시 확인해 주세요.')).toBeTruthy();
    expect(await findByText('가입하고 시작')).toBeTruthy();
    expect(api.requestCode).toHaveBeenCalledWith({
      phone: '01099990000',
      role: 'consumer',
    });
  });

  it('should request OTP with email when email method selected', async () => {
    const { api } = require('../api/client');
    api.requestCode.mockResolvedValue({ delivery: 'demo', code: '123456', expiresInSeconds: 300 });

    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('전화번호 또는 이메일'), 'test@test.com');
    fireEvent.press(getByText('인증코드 받기'));

    await waitFor(() => {
      expect(api.requestCode).toHaveBeenCalledWith({
        email: 'test@test.com',
        role: 'consumer',
      });
    });
  });
});
