import type { AuthProvider, ProviderKey } from '../types';

/**
 * ProviderButtons 컴포넌트의 Props 인터페이스입니다.
 * 외부 제공자(OAuth) 목록 데이터와 클릭 시 로그인 액션을 트리거할 핸들러를 전달받습니다.
 */
interface ProviderButtonsProps {
  providers: AuthProvider[];
  onLogin: (provider: ProviderKey) => void;
}

/**
 * 소셜 로그인(네이버, 카카오 등)을 위한 버튼 목록을 렌더링하는 컴포넌트입니다.
 * 제공자가 활성화(isEnabled)된 경우에만 로그인이 가능하도록 버튼 상태를 제어합니다.
 */
export function ProviderButtons({ providers, onLogin }: ProviderButtonsProps) {
  return (
    <div className="provider-button-list">
      {providers.map((provider) => (
        <button
          key={provider.key}
          type="button"
          className={provider.isEnabled ? 'primary-button provider-button' : 'secondary-button provider-button is-disabled'}
          disabled={!provider.isEnabled}
          onClick={() => onLogin(provider.key)}
        >
          {provider.isEnabled ? `${provider.label}로 로그인` : `${provider.label} 준비 중`}
        </button>
      ))}
    </div>
  );
}
