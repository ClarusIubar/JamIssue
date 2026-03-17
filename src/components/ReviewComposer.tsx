import { FormEvent, useState } from 'react';
import type { ReviewMood } from '../types';

interface ReviewComposerProps {
  placeName: string;
  loggedIn: boolean;
  canSubmit: boolean;
  submitting: boolean;
  errorMessage: string | null;
  locationMessage: string;
  onSubmit: (payload: { body: string; mood: ReviewMood; file: File | null }) => Promise<void>;
  onRequestLogin: () => void;
  onRequestLocationCheck: () => void;
}

const moodItems: ReviewMood[] = ['딸기잼', '버터', '초코스프레드', '크림치즈', '무화과잼'];

export function ReviewComposer({
  placeName,
  loggedIn,
  canSubmit,
  submitting,
  errorMessage,
  locationMessage,
  onSubmit,
  onRequestLogin,
  onRequestLocationCheck,
}: ReviewComposerProps) {
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<ReviewMood>('딸기잼');
  const [file, setFile] = useState<File | null>(null);
  const [showLaterNotice, setShowLaterNotice] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loggedIn) {
      onRequestLogin();
      return;
    }

    if (!canSubmit) {
      onRequestLocationCheck();
      return;
    }

    await onSubmit({ body, mood, file });
    setBody('');
    setMood('딸기잼');
    setFile(null);
  }

  return (
    <form className="review-composer" onSubmit={handleSubmit}>
      <div className="section-title-row">
        <div>
          <p className="eyebrow">TRAVEL TOAST</p>
          <h3>오늘의 토스트에 바를 잼은?</h3>
        </div>
        {!loggedIn ? (
          <button type="button" className="text-button" onClick={onRequestLogin}>
            로그인 필요
          </button>
        ) : (
          <button type="button" className="text-button" onClick={onRequestLocationCheck}>
            현장 위치 확인
          </button>
        )}
      </div>
      <p className="review-composer__hint">{locationMessage}</p>
      <div className="chip-row compact-gap">
        {moodItems.map((item) => (
          <button key={item} type="button" className={item === mood ? 'chip is-active' : 'chip'} onClick={() => setMood(item)}>
            {item}
          </button>
        ))}
      </div>
      <textarea
        className="review-composer__textarea"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="길게 쓰지 않아도 돼요. 현장에서 느낀 한 줄이면 충분해요."
        rows={4}
        disabled={loggedIn && !canSubmit}
      />
      <label className="file-picker">
        <span>{file ? file.name : '사진 한 장 추가하기'}</span>
        <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={loggedIn && !canSubmit} />
      </label>
      {errorMessage && <p className="inline-error">{errorMessage}</p>}
      <div style={{ display: 'grid', gap: '8px' }}>
        <button type="submit" className="primary-button" disabled={submitting || (loggedIn && !canSubmit)}>
          {!loggedIn ? '로그인 후 작성' : submitting ? '바르는 중...' : canSubmit ? '잼 바르기 (후기 완료)' : '스탬프 찍은 후 활성화'}
        </button>
        {canSubmit && !submitting && (
          <button type="button" className="text-button" onClick={() => setShowLaterNotice(true)}>
            나중에 작성할게요
          </button>
        )}
      </div>
      {showLaterNotice && <p className="review-composer__hint" style={{ textAlign: 'center' }}>나중에 '마이' 탭이나 이 장소 페이지에서 다시 작성할 수 있어요!</p>}
    </form>
  );
}
