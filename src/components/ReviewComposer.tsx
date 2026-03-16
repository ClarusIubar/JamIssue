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

const moodItems: ReviewMood[] = ['설렘', '친구랑', '혼자서', '야경픽'];

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
  const [mood, setMood] = useState<ReviewMood>('설렘');
  const [file, setFile] = useState<File | null>(null);

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
    setMood('설렘');
    setFile(null);
  }

  return (
    <form className="review-composer" onSubmit={handleSubmit}>
      <div className="section-title-row">
        <div>
          <p className="eyebrow">PLACE FEED</p>
          <h3>{placeName} 후기 남기기</h3>
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
      <button type="submit" className="primary-button" disabled={submitting || (loggedIn && !canSubmit)}>
        {!loggedIn ? '로그인 후 작성' : submitting ? '저장 중...' : canSubmit ? '후기 올리기' : '근처 도착 후 활성화'}
      </button>
    </form>
  );
}
