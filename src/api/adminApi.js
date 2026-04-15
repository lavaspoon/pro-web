import axiosInstance from './axiosInstance';

/**
 * 관리자 대시보드 데이터 조회
 * GET /api/admin/dashboard
 */
export const fetchAdminDashboard = async () => {
  const { data } = await axiosInstance.get('/api/admin/dashboard');
  return data;
};

/**
 * 2depth 부서 기준 하위 leaf 팀 목록·집계
 * GET /api/admin/filter/leaf-teams?secondDepthDeptId=5 (생략 시 전체 2depth 하위 leaf 합집합)
 */
export const fetchAdminLeafTeams = async (secondDepthDeptId) => {
  const params = {};
  if (secondDepthDeptId != null && secondDepthDeptId !== '') {
    params.secondDepthDeptId = secondDepthDeptId;
  }
  const { data } = await axiosInstance.get('/api/admin/filter/leaf-teams', { params });
  return data;
};

/**
 * 랭킹 — 사례(TB_YOU_PRO_CASE) 접수 건수 기준 (combined 등 topN)
 * GET /api/admin/ranking?year=&topN=
 */
export const fetchAdminRanking = async (year, topN = 15) => {
  const { data } = await axiosInstance.get('/api/admin/ranking', {
    params: { year, topN },
  });
  return data;
};

/**
 * 팀(실) 상세 구성원 현황 조회
 * GET /api/admin/teams/{deptIdx}
 */
export const fetchTeamDetail = async (deptIdx) => {
  const { data } = await axiosInstance.get(`/api/admin/teams/${deptIdx}`);
  return data;
};

/**
 * 검토 대기 전체 사례 조회
 * GET /api/admin/cases/pending
 */
export const fetchAllPendingCases = async () => {
  const { data } = await axiosInstance.get('/api/admin/cases/pending');
  return data;
};

/**
 * 검토 대기 화면 — 대시보드 + 대기 사례 단일 요청
 * GET /api/admin/review-queue
 */
export const fetchAdminReviewQueue = async () => {
  const { data } = await axiosInstance.get('/api/admin/review-queue');
  return data;
};

/**
 * 사례 상세 조회 (STT 포함)
 * GET /api/admin/cases/{caseId}
 */
export const fetchCaseForReview = async (caseId) => {
  const { data } = await axiosInstance.get(`/api/admin/cases/${caseId}`);
  return data;
};

/**
 * 사례 판정 (선정 / 비선정)
 * POST /api/admin/cases/{caseId}/judge
 */
export const judgeCase = async ({
  caseId,
  decision,
  reason,
  adminSkid,
  aiKeyPhrase,
  aiKeyPoint,
}) => {
  const body = {
    adminSkid,
    decision,
    reason,
  };
  if (aiKeyPhrase != null && String(aiKeyPhrase).trim() !== '') {
    body.aiKeyPhrase = String(aiKeyPhrase).trim();
  }
  if (aiKeyPoint != null && String(aiKeyPoint).trim() !== '') {
    body.aiKeyPoint = String(aiKeyPoint).trim();
  }
  const { data } = await axiosInstance.post(`/api/admin/cases/${caseId}/judge`, body);
  return data;
};

/**
 * CS 만족도 — 연간 실(2depth)별 요약
 * GET /api/admin/cs-satisfaction/summary?year=&secondDepthDeptId=
 */
export const fetchCsSatisfactionSummary = async (year, secondDepthDeptId) => {
  const params = {};
  if (year != null) params.year = year;
  if (secondDepthDeptId != null && secondDepthDeptId !== '') {
    params.secondDepthDeptId = secondDepthDeptId;
  }
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/summary', { params });
  return data;
};

/**
 * CS 만족도 — 월별 평가·만족 건수 (실 1개 선택 시)
 * GET /api/admin/cs-satisfaction/monthly-trend?year=&secondDepthDeptId=
 */
export const fetchCsSatisfactionMonthlyTrend = async (year, secondDepthDeptId) => {
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/monthly-trend', {
    params: { year, secondDepthDeptId },
  });
  return data;
};

/**
 * CS 만족도 — 통합 월별(평가·만족·불만족) + 중점추진과제 월별 건수
 * GET /api/admin/cs-satisfaction/monthly-overview?year=
 */
export const fetchCsSatisfactionMonthlyOverview = async (year) => {
  const params = {};
  if (year != null) params.year = year;
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/monthly-overview', { params });
  return data;
};

/**
 * 선택 팀/센터 — 구성원별 만족도 (month 생략 시 해당 연도 전체, 지정 시 해당 월만)
 * GET /api/admin/cs-satisfaction/center-month-detail?secondDepthDeptId=&year=&month=
 */
export const fetchCsSatisfactionCenterMonthDetail = async (secondDepthDeptId, year, month) => {
  const params = { secondDepthDeptId };
  if (year != null) params.year = year;
  if (month != null && month !== '') params.month = month;
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/center-month-detail', { params });
  return data;
};

/**
 * CS 만족도 엑셀 업로드 (.xlsx) — multipart 필드명 file
 * (FormData 사용 시 기본 JSON Content-Type을 쓰지 않도록 fetch 사용)
 */
export const uploadCsSatisfactionExcel = async (file) => {
  const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${baseURL}/api/admin/cs-satisfaction/upload`, {
    method: 'POST',
    body: formData,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text);
      msg = j.message || j.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return text ? JSON.parse(text) : {};
};

/**
 * CS 만족도 — 해당 연·월의 센터별 목표% 조회 (월 1회 설정, DB는 그 달 1일 키)
 * GET /api/admin/cs-satisfaction/monthly-targets?year=&month=
 */
export const fetchCsSatisfactionMonthlyTargets = async (year, month) => {
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/monthly-targets', {
    params: { year, month },
  });
  return data;
};

/**
 * CS 만족도 — 월간 목표% 저장
 * POST /api/admin/cs-satisfaction/monthly-targets
 * @param {{ year: number, month: number, targets: Array<{ secondDepthDeptId: number, targetPercent: number }> }} body
 */
export const saveCsSatisfactionMonthlyTargets = async (body) => {
  await axiosInstance.post('/api/admin/cs-satisfaction/monthly-targets', body);
};

/**
 * CS 만족도 — 통합 목표 조회 (부서/스킬/연간)
 * GET /api/admin/cs-satisfaction/targets-unified?year=&month=
 */
export const fetchCsSatisfactionTargetsUnified = async (year, month) => {
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/targets-unified', {
    params: { year, month },
  });
  return data;
};

/**
 * CS 만족도 — 통합 목표 저장 (부서/스킬/연간)
 * POST /api/admin/cs-satisfaction/targets-unified
 * @param {{
 *   year: number,
 *   month: number,
 *   deptTargets: Array<{ deptId: number, targetPercent: number }>,
 *   skillTargets: Array<{ skillName: string, targetPercent: number }>,
 *   annualTargets: Array<{ taskCode: string, targetPercent: number }>
 * }} body
 */
export const saveCsSatisfactionTargetsUnified = async (body) => {
  await axiosInstance.post('/api/admin/cs-satisfaction/targets-unified', body);
};
