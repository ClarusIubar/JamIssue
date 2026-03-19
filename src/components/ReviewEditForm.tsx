import { useEffect, useState } from 'react';
import type { ReviewMood } from '../types';

const moodOptions: ReviewMood[] = ['혼자서', '친구랑', '데이트', '야경 맛집'];

interface ReviewEditFormProps {
  reviewId: string;
  initialBody: string;
  initialMood: ReviewMood;
  hasExistingImage: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onSave: (payload: { body: string; mood: ReviewMood; file: File | null }) => Promise<void>;
  onCancel: () => void;
}

export function ReviewEditForm({
  reviewId,
  initialBody,
  initialMood,
  hasExistingImage,
  submitting,
  errorMessage,
  onSave,
  onCancel,
}: ReviewEditFormProps) {
  const [body, setBody] = useState(initialBody);
  const [mood, setMood] = useState<ReviewMood>(initialMood);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setBody(initialBody);
    setMood(initialMood);
    setFile(null);
  }, [reviewId, initialBody, initialMood]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim().length < 4) return;
    await onSave({ body: body.trim(), mood, file });
  }

  return (
    <form className="route-builder-form review-edit-form" onSubmit={handleSubmit}>
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

      <div className="route-builder-field">
        <span>사진 변경 (선택)</span>
        <label className="file-picker" htmlFor={`review-edit-image-${reviewId}`}>
          <span>{file ? file.name : hasExistingImage ? '기존 사진 유지' : '사진을 고르세요'}</span>
          <strong>{file ? '다시 선택' : '사진 선택'}</strong>
        </label>
        <input
          id={`review-edit-image-${reviewId}`}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </div>

      {errorMessage && <p className="form-error-copy">{errorMessage}</p>}

      <div className="review-edit-actions">
        <button type="submit" className="primary-button" disabled={submitting || body.trim().length < 4}>
          {submitting ? '저장 중' : '수정 완료'}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={submitting}>
          취소
        </button>
      </div>
    </form>
  );
}
