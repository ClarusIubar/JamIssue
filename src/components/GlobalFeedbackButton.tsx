const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfKNC80Y2_kDm2NFzOAa6IBOfcgjdZYv48EavTkjdbEI4bMQw/viewform?usp=publish-editor';

function FeedbackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="review-action-button__svg" aria-hidden="true">
      <path
        d="M8 3.75h6.5l3.75 3.75V18A2.25 2.25 0 0 1 16 20.25H8A2.25 2.25 0 0 1 5.75 18V6A2.25 2.25 0 0 1 8 3.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 3.75V8h4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17.25" r="1.05" fill="currentColor" />
    </svg>
  );
}

export function GlobalFeedbackButton() {
  return (
    <a
      className="secondary-button icon-button feedback-button"
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="피드백 보내기"
      title="피드백 보내기"
    >
      <FeedbackIcon />
    </a>
  );
}
