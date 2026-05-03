import axiosInstance from './axiosInstance';

/**
 * 구성원 홈 화면 데이터 조회
 * GET /api/member/home?skid={skid}
 */
export const fetchMemberHome = async (skid) => {
  const { data } = await axiosInstance.get('/api/member/home', { params: { skid } });
  return data;
};

/**
 * 내 사례 목록 조회
 * GET /api/member/cases?skid={skid}
 */
export const fetchMyCases = async (skid) => {
  const { data } = await axiosInstance.get('/api/member/cases', { params: { skid } });
  return data;
};

/**
 * 사례 상세 조회
 * GET /api/member/cases/{caseId}
 */
export const fetchCaseDetail = async (caseId) => {
  const { data } = await axiosInstance.get(`/api/member/cases/${caseId}`);
  return data;
};

/**
 * 우수사례 접수
 * POST /api/member/cases
 */
export const submitCase = async ({ skid, title, description, callDate }) => {
  const { data } = await axiosInstance.post('/api/member/cases', {
    skid,
    title,
    description,
    callDate,
  });
  return data;
};

/**
 * 구성원 CS 만족도 조회
 * GET /api/member/satisfaction?skid={skid}&year={year}&month={month}
 *
 * 응답에 `dailyTrend`가 있으면 차트에 사용:
 * `{ day: '4/8', satisfiedCount, receivedCount }` — 만족도% = (만족/접수)×100, 접수 0(연차)은 실적 제외·차트는 선만 이어짐. 화면에서는 최근 7영업일만 표시.
 */
export const fetchMemberSatisfaction = async ({ skid, year, month }) => {
  const { data } = await axiosInstance.get('/api/member/satisfaction', {
    params: { skid, year, month },
  });
  return data;
};

/**
 * 구성원 당월 중점추진과제(5대도시·5060·문제해결) Y 건수
 * GET /api/member/satisfaction/focus-tasks?skid=&year=&month=
 */
export const fetchMemberFocusTasks = async ({ skid, year, month }) => {
  const { data } = await axiosInstance.get('/api/member/satisfaction/focus-tasks', {
    params: { skid, year, month },
  });
  return data;
};

/**
 * AI 인사이트 프롬프트용 멘트 — 평가시간(Y)만, 해당 월 중 상담일이 가장 최근인 날짜 행에서 추출
 * GET /api/member/satisfaction/ai-insight-ments?skid=&year=&month=
 */
export const fetchMemberCsInsightPromptMents = async ({ skid, year, month }) => {
  const { data } = await axiosInstance.get('/api/member/satisfaction/ai-insight-ments', {
    params: { skid, year, month },
  });
  return data;
};

/**
 * 구성원 당월 불만족 유형(1~5)별 상담 상세
 * GET /api/member/satisfaction/unsatisfied-details?skid=&year=&month=&dissatisfactionType=
 */
export const fetchMemberUnsatisfiedDetails = async ({ skid, year, month, dissatisfactionType }) => {
  const { data } = await axiosInstance.get('/api/member/satisfaction/unsatisfied-details', {
    params: { skid, year, month, dissatisfactionType },
  });
  return data;
};
