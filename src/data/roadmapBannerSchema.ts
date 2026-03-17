export interface RoadmapBannerSchema {
  eyebrow: string;
  title: string;
  subtitle: string;
  helper: string;
  summaryItems: Array<{ label: string; value: string; tone: 'pink' | 'blue' | 'mint' }>;
  milestones: Array<{
    id: string;
    dateLabel: string;
    statusLabel: string;
    title: string;
    body: string;
    deliverable: string;
    tags: string[];
    accentColor: string;
    badgeTone: 'pink' | 'blue' | 'mint' | 'peach';
  }>;
  closingNote: string;
}

export const roadmapBannerSchema: RoadmapBannerSchema = {
  eyebrow: 'MARCH BUILD SCHEDULE',
  title: '3월 16일 - 3월 19일 작업 일정 배너',
  subtitle: '이번 배치에서 무엇을 먼저 정리하는지 날짜 순서로 바로 보이게 만든 일정형 배너 예시입니다.',
  helper: '상단 배너에서 일정 요약을 먼저 보여주고, 필요하면 카드 상세를 펼쳐보는 구조를 가정했습니다.',
  summaryItems: [
    { label: '총 기간', value: '4일', tone: 'pink' },
    { label: '첫 배치', value: 'UI 정리', tone: 'blue' },
    { label: '마감 목표', value: '3월 19일', tone: 'mint' },
  ],
  milestones: [
    {
      id: 'schedule-ui',
      dateLabel: '3월 16일',
      statusLabel: 'DAY 1',
      title: '탐색 · 코스 · 스탬프 1차 UI 정리',
      body: '상단 고정 영역을 줄이고 줄바꿈과 카드 비율을 다시 맞춰 모바일 첫 화면을 정리합니다.',
      deliverable: '탐색 / 코스 / 스탬프 1차 UI 정리본',
      tags: ['UI 정리', '모바일 우선', '줄바꿈'],
      accentColor: '#ff8fb7',
      badgeTone: 'pink',
    },
    {
      id: 'schedule-policy',
      dateLabel: '3월 17일',
      statusLabel: 'DAY 2',
      title: '스탬프 기반 후기 권한 연결',
      body: '현장 스탬프 적립 여부와 후기 작성 자격을 연결해서 장소별 후기 흐름을 명확하게 정리합니다.',
      deliverable: '후기 작성 제한 정책 + 비활성 안내 UX',
      tags: ['24시간 규칙', '현장성', '어뷰징 방지'],
      accentColor: '#8ecbff',
      badgeTone: 'blue',
    },
    {
      id: 'schedule-public-data',
      dateLabel: '3월 18일',
      statusLabel: 'DAY 3',
      title: '대전 관광 공공데이터 모듈 정리',
      body: '공공 API 원본을 별도 모듈과 별도 테이블로 받고, map과 관계형으로 연결되는 구조를 마무리합니다.',
      deliverable: 'public_data 모듈 정리 + map 연결 규칙',
      tags: ['public_data', '정규화', 'map 관계'],
      accentColor: '#7fe1d1',
      badgeTone: 'mint',
    },
    {
      id: 'schedule-qa',
      dateLabel: '3월 19일',
      statusLabel: 'DAY 4',
      title: '모바일 QA와 배너 병합 초안',
      body: '실제 모바일 화면에서 깨지는 부분을 다시 확인하고, 일정 배너를 어느 화면에 흡수할지 초안을 정리합니다.',
      deliverable: '모바일 QA 체크 + 상단 배너 병합안',
      tags: ['QA', '배너 병합', '최종 정리'],
      accentColor: '#ffbf7a',
      badgeTone: 'peach',
    },
  ],
  closingNote: '이 문서는 일정형 배너 예시입니다. 실제 서비스에는 핵심 카드만 요약 노출하고, 자세한 일정은 문서나 관리자 화면으로 분리하는 쪽을 기본값으로 둡니다.',
};