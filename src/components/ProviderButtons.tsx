import type { AuthProvider, ProviderKey } from '../types';

interface ProviderButtonsProps {
  providers: AuthProvider[];
  onLogin: (provider: ProviderKey) => void;
}

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
