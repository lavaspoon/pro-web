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
 * 랭킹 — tb_you_incentive_reflect 해당 연 최신 반영 월 cumulative_count 기준 (combined 등 topN)
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
 * 사례 상세 조회
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
 * CS 만족도 — 실(2depth)별 요약
 * GET /api/admin/cs-satisfaction/summary?year=&month=&secondDepthDeptId=&rollingThroughYesterday=
 */
export const fetchCsSatisfactionSummary = async ({
  year,
  secondDepthDeptId,
  month,
  rollingThroughYesterday,
} = {}) => {
  const params = {};
  if (year != null) params.year = year;
  if (month != null && month !== '') params.month = month;
  if (secondDepthDeptId != null && secondDepthDeptId !== '') {
    params.secondDepthDeptId = secondDepthDeptId;
  }
  if (rollingThroughYesterday) params.rollingThroughYesterday = true;
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
 * CS 만족도 — 관리자 상단 KPI(센터 연간 달성·스킬 평균·중점 3종 당월)
 * GET /api/admin/cs-satisfaction/dashboard-kpis?year=
 */
export const fetchCsSatisfactionDashboardKpis = async (year, month) => {
  const params = {};
  if (year != null) params.year = year;
  if (month != null && month !== '') params.month = month;
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/dashboard-kpis', { params });
  return data;
};

/**
 * CS 만족도 — 금일(09:00~18:59 KST) 시간대별 스냅샷
 * GET /api/admin/cs-satisfaction/today-hourly?secondDepthDeptId=&skill=&adminSkid=
 */
export const fetchCsSatisfactionTodayHourly = async ({ adminSkid, secondDepthDeptId, skill } = {}) => {
  const params = {};
  if (adminSkid) params.adminSkid = adminSkid;
  if (secondDepthDeptId !== undefined && secondDepthDeptId !== null) params.secondDepthDeptId = secondDepthDeptId;
  if (skill !== undefined && skill !== null) params.skill = skill;
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/today-hourly', { params });
  return data;
};

/**
 * CS 만족도 — 연간 구성원 랭킹(만족·5대도시·5060·문제해결 각 상위 N명)
 * GET /api/admin/cs-satisfaction/ranking?year=&topN=3
 */
export const fetchCsSatisfactionRanking = async (year, topN = 3, month) => {
  const params = { topN };
  if (year != null) params.year = year;
  if (month != null && month !== '') params.month = month;
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/ranking', { params });
  return data;
};

/**
 * 선택 팀/센터 — 구성원별 만족도
 * GET /api/admin/cs-satisfaction/center-month-detail?secondDepthDeptId=&year=&month=&rollingThroughYesterday=
 */
export const fetchCsSatisfactionCenterMonthDetail = async (
  secondDepthDeptId,
  { year, month, rollingThroughYesterday } = {},
) => {
  const params = { secondDepthDeptId };
  if (year != null) params.year = year;
  if (month != null && month !== '') params.month = month;
  if (rollingThroughYesterday) params.rollingThroughYesterday = true;
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/center-month-detail', { params });
  return data;
};

/**
 * 구성원별 연간 접수 row 월별 조회
 * GET /api/admin/cs-satisfaction/member-monthly-rows?skid=&year=
 */
export const fetchCsSatisfactionMemberMonthlyRows = async (skid, year) => {
  const params = { skid };
  if (year != null) params.year = year;
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/member-monthly-rows', { params });
  return data;
};

/**
 * CS 만족도 — 스킬 + 상담일시 구간(시작·종료 포함) 평가 제외(useYn='N')
 * POST /api/admin/cs-satisfaction/exclude-time
 * @param {{ skill: string, startAt: string, endAt: string }} body — ISO-8601 로컬 일시 문자열
 */
export const excludeCsSatisfactionEvalRange = async ({ skill, startAt, endAt, excludedBySkid }) => {
  const body = { skill, startAt, endAt };
  if (excludedBySkid != null && String(excludedBySkid).trim() !== '') {
    body.excludedBySkid = String(excludedBySkid).trim();
  }
  const { data } = await axiosInstance.post('/api/admin/cs-satisfaction/exclude-time', body);
  return data;
};

/**
 * 평가 제외 적용 이력 (최근 N건)
 * GET /api/admin/cs-satisfaction/exclude-log?limit=
 */
export const fetchCsSatisfactionExcludeLog = async (limit = 50) => {
  const { data } = await axiosInstance.get('/api/admin/cs-satisfaction/exclude-log', {
    params: { limit },
  });
  return data;
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

/**
 * 평가 대상자 엑셀 업로드 (.xlsx)
 * POST /api/admin/target-members/upload
 */
export const uploadTargetMembersExcel = async (file) => {
  const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${baseURL}/api/admin/target-members/upload`, {
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
