import { useState } from 'react';
import type { ReviewMood } from '../types';

/**
 * 리뷰 작성기가 가질 수 있는 상태값 타입입니다.
 */
type ReviewComposerStatus = 'login' | 'claim' | 'ready' | 'daily-limit';

/**
 * ReviewComposer 컴포넌트의 Props 인터페이스입니다.
 * 작성기 상태 제어값과 제출, 인증 요청 등의 이벤트 핸들러를 포함합니다.
 */
interface ReviewComposerProps {
  placeName: string;
  loggedIn: boolean;
  canSubmit: boolean;
  status: ReviewComposerStatus;
  submitting: boolean;
  errorMessage: string | null;
  proofMessage: string;
  onSubmit: (payload: { body: string; mood: ReviewMood; file: File | null }) => Promise<void>;
  onRequestLogin: () => void;
  onRequestProof: () => void;
}

const moodOptions: ReviewMood[] = ['혼자서', '친구랑', '데이트', '야경 맛집'];

/**
 * 장소 상세 바텀시트 하단에 노출되는 피드(리뷰) 작성 컴포넌트입니다.
 * 사진 첨부, 기분(mood) 선택, 본문 입력을 지원하며 권한(스탬프 획득 여부)에 따라
 * 입력창을 비활성화하거나 인증/로그인 버튼을 대신 보여줍니다.
 */
export function ReviewComposer({
  placeName,
  loggedIn,
  canSubmit,
  status,
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

    await onSubmit({ body: body.trim(), mood, file });
    setBody('');
    setFile(null);
    setMood('혼자서');
  }

  const fieldsDisabled = status !== 'ready' || submitting;
  const isDailyLimitReached = status === 'daily-limit';
  const actionLabel = !loggedIn
    ? '로그인하고 작성'
    : isDailyLimitReached
      ? '오늘 피드 작성 완료'
      : canSubmit
        ? '피드 올리기'
        : '오늘 스탬프 먼저 찍기';
  const actionHandler = !loggedIn ? onRequestLogin : canSubmit || isDailyLimitReached ? undefined : onRequestProof;

  return (
    <section className="sheet-card stack-gap review-composer">
      <div>
        <p className="eyebrow">WRITE FEED</p>
        <h3>{placeName} 피드 남기기</h3>
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
              disabled={fieldsDisabled}
            >
              {option}
            </button>
          ))}
        </div>

        <label className="route-builder-field">
          <span>오늘의 기록</span>
          <textarea
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="오늘 분위기나 동선을 짧고 자연스럽게 적어 보세요."
            disabled={fieldsDisabled}
          />
        </label>

        <div className="route-builder-field">
          <span>사진 첨부</span>
          <label className={fieldsDisabled ? 'file-picker is-disabled' : 'file-picker'} htmlFor="review-image-input">
            <span>{file ? file.name : '사진을 골라주세요'}</span>
            <strong>{file ? '다시 선택' : '사진 선택'}</strong>
          </label>
          <input
            id="review-image-input"
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={fieldsDisabled}
          />
        </div>

        {errorMessage && <p className="form-error-copy">{errorMessage}</p>}

        {actionHandler ? (
          <button type="button" className="primary-button route-submit-button" onClick={actionHandler}>
            {actionLabel}
          </button>
        ) : (
          <button
            type="submit"
            className="primary-button route-submit-button"
            disabled={submitting || body.trim().length < 4 || isDailyLimitReached}
          >
            {submitting ? '올리는 중' : actionLabel}
          </button>
        )}
      </form>
    </section>
  );
}

