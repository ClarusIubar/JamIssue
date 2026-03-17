import { useState } from 'react';
import type { ReviewMood } from '../types';

interface ReviewComposerProps {
  placeName: string;
  loggedIn: boolean;
  canSubmit: boolean;
  submitting: boolean;
  errorMessage: string | null;
  proofMessage: string;
  onSubmit: (payload: { body: string; mood: ReviewMood; file: File | null }) => Promise<void>;
  onRequestLogin: () => void;
  onRequestProof: () => void;
}

const moodOptions: ReviewMood[] = ['혼자서', '친구랑', '데이트', '야경 맛집'];

export function ReviewComposer({
  placeName,
  loggedIn,
  canSubmit,
  submitting,
  errorMessage,
  proofMessage,
  onSubmit,
  onRequestLogin,
  onRequestProof,
}: ReviewComposerProps) {
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<ReviewMood>('혼자서');
  const [file, setFile] = useState<File | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || body.trim().length < 4) {
      return;
    }

    await onSubmit({
      body: body.trim(),
      mood,
      file,
    });

    setBody('');
    setFile(null);
    setMood('혼자서');
  }

  const actionLabel = !loggedIn ? '로그인하고 작성' : canSubmit ? '피드 올리기' : '현장 스탬프 먼저 찍기';
  const actionHandler = !loggedIn ? onRequestLogin : canSubmit ? undefined : onRequestProof;

  return (
    <section className="sheet-card stack-gap review-composer">
      <div>
        <p className="eyebrow">WRITE FEED</p>
        <h3>{placeName} 후기 남기기</h3>
        <p className="section-copy">{proofMessage}</p>
      </div>

      <form className="route-builder-form" onSubmit={handleSubmit}>
        <div className="chip-row compact-gap">
          {moodOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={option === mood ? 'chip is-active' : 'chip'}
              onClick={() => setMood(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <label className="route-builder-field">
          <span>한 줄 후기</span>
          <textarea
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="오늘 분위기나 동선을 짧고 또렷하게 남겨 보세요"
          />
        </label>

        <label className="route-builder-field">
          <span>사진 첨부</span>
          <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>

        {errorMessage && <p className="form-error-copy">{errorMessage}</p>}

        {actionHandler ? (
          <button type="button" className="primary-button route-submit-button" onClick={actionHandler}>
            {actionLabel}
          </button>
        ) : (
          <button type="submit" className="primary-button route-submit-button" disabled={submitting || body.trim().length < 4}>
            {submitting ? '올리는 중' : actionLabel}
          </button>
        )}
      </form>
    </section>
  );
}
