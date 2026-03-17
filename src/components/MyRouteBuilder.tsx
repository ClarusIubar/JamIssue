import { useState } from 'react';
import type { Place, UserRoute } from '../types';

interface MyRouteBuilderProps {
  collectedPlaces: Place[];
  routes: UserRoute[];
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (payload: { title: string; description: string; mood: string; placeIds: string[] }) => Promise<void>;
  onOpenPlace: (placeId: string) => void;
}

const moodOptions = ['딸기잼', '버터', '초코스프레드', '크림치즈', '무화과잼'];

export function MyRouteBuilder({ collectedPlaces, routes, submitting, errorMessage, onSubmit, onOpenPlace }: MyRouteBuilderProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mood, setMood] = useState('딸기잼');
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);

  function togglePlace(placeId: string) {
    setSelectedPlaceIds((current) => (current.includes(placeId) ? current.filter((item) => item !== placeId) : [...current, placeId]));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      title,
      description,
      mood,
      placeIds: selectedPlaceIds,
    });
    setTitle('');
    setDescription('');
    setMood('딸기잼');
    setSelectedPlaceIds([]);
  }

  return (
    <>
      <section className="card-block community-route-block">
        <div className="section-title-row section-title-row--tight">
          <div>
            <p className="eyebrow">MY ROUTE MAKER</p>
            <h3>내 스탬프로 추천 경로 만들기</h3>
            <p className="section-copy">실제로 수집한 스탬프들을 엮어 새로운 토스트 모음집을 만들고, <strong>커뮤니티에 다른 여행자들을 위해 추천해주세요.</strong></p>
          </div>
        </div>

        {collectedPlaces.length < 2 ? (
          <p className="empty-copy">스탬프를 두 곳 이상 모아야 공개 경로를 만들 수 있어요.</p>
        ) : (
          <form className="route-builder-form" onSubmit={handleSubmit}>
            <label className="route-builder-field">
              <span>경로 제목</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 노을 보러 가는 대전 한입 코스" maxLength={120} />
            </label>
            <label className="route-builder-field">
              <span>한 줄 소개</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="이 경로가 왜 좋았는지, 어떤 분위기인지 짧게 적어 주세요."
                maxLength={255}
                rows={3}
              />
            </label>
            <div className="route-builder-field">
              <span>무드 선택</span>
              <div className="chip-row compact-gap">
                {moodOptions.map((item) => (
                  <button key={item} type="button" className={item === mood ? 'chip is-active' : 'chip'} onClick={() => setMood(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="route-builder-field">
              <span>경로에 넣을 스탬프 장소</span>
              <div className="route-place-picker">
                {collectedPlaces.map((place, index) => {
                  const isSelected = selectedPlaceIds.includes(place.id);
                  const selectedOrder = selectedPlaceIds.indexOf(place.id);
                  return (
                    <button
                      key={place.id}
                      type="button"
                      className={isSelected ? 'route-place-option is-selected' : 'route-place-option'}
                      onClick={() => togglePlace(place.id)}
                    >
                      <strong>{isSelected ? selectedOrder + 1 : index + 1}</strong>
                      <span>{place.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {errorMessage && <p className="form-error-copy">{errorMessage}</p>}
            <button type="submit" className="primary-button route-submit-button" disabled={submitting || selectedPlaceIds.length < 2}>
              {submitting ? '추천 올리는 중...' : '공개 추천 토스트 발행하기'}
            </button>
          </form>
        )}
      </section>

      <section className="card-block compact-list-card">
        <div className="section-title-row section-title-row--tight">
          <div>
            <p className="eyebrow">MY ROUTES</p>
            <h3>내가 만든 공개 경로</h3>
          </div>
          <span className="counter-pill">{routes.length}개</span>
        </div>
        {routes.map((route) => (
          <article key={route.id} className="community-route-card community-route-card--my">
            <div className="community-route-card__header">
              <div>
                <p className="eyebrow">{route.mood}</p>
                <h4>{route.title}</h4>
              </div>
              <span className="counter-pill">좋아요 {route.likeCount}</span>
            </div>
            <p>{route.description}</p>
            <div className="course-card__places community-route-places">
              {route.placeIds.map((placeId, index) => (
                <button key={`${route.id}-${placeId}`} type="button" className="soft-tag soft-tag--button course-card__place" onClick={() => onOpenPlace(placeId)}>
                  {index + 1}. {route.placeNames[index] ?? placeId}
                </button>
              ))}
            </div>
          </article>
        ))}
        {routes.length === 0 && <p className="empty-copy">아직 내가 만든 공개 경로가 없어요.</p>}
      </section>
    </>
  );
}
