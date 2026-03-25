/**
 * 프론트엔드 애플리케이션의 런타임 환경 설정(ClientConfig)을 정의하는 인터페이스입니다.
 */
export interface ClientConfig {
  // 환경변수 기반으로 주입되는 API 서버의 Base URL입니다.
  apiBaseUrl: string;
  // 네이버 지도 초기화 및 표시에 사용되는 클라이언트 ID입니다.
  naverMapClientId: string;
}

declare global {
  interface Window {
    __JAMISSUE_CONFIG__?: Partial<ClientConfig>;
  }
}

/**
 * 전역 window 객체(__JAMISSUE_CONFIG__)를 확인하거나 기본값을 조합하여 ClientConfig를 반환합니다.
 * API 클라이언트 및 네이버 지도 컴포넌트 등에서 호출하여 사용합니다.
 */
export function getClientConfig(): ClientConfig {
  const browserConfig = typeof window === 'undefined' ? undefined : window.__JAMISSUE_CONFIG__;
  const apiBaseUrl = (browserConfig?.apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')).replace(/\/$/, '');
  const naverMapClientId = browserConfig?.naverMapClientId?.trim() || '';

  return {
    apiBaseUrl,
    naverMapClientId,
  };
}