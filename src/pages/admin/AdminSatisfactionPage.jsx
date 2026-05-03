import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  MapPinned,
  UserCircle2,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import AdminSatisfactionSetupModal from './AdminSatisfactionSetupModal';
import AdminTargetMembersUploadModal from './AdminTargetMembersUploadModal';
import {
  fetchCsSatisfactionCenterMonthDetail,
  fetchCsSatisfactionDashboardKpis,
  fetchCsSatisfactionMemberMonthlyRows,
  fetchCsSatisfactionSummary,
  fetchCsSatisfactionTodayHourly,
  fetchCsSatisfactionExcludeLog,
  excludeCsSatisfactionEvalRange,
} from '../../api/adminApi';
import { mergeSecondDepthOptions } from '../../utils/adminSecondDepth';
import Skeleton from '../../components/common/Skeleton';
import './DashboardPage.css';
import './TeamDetailPage.css';
import './AdminSatisfactionPage.css';

function KpiOverviewSkeleton() {
  return (
    <div className="adm-overview-grid adm-sat-kpi-grid adm-sat-kpi-grid--four">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="adm-kpi-card adm-kpi-card--tone-files adm-sat-kpi-card--centers">
          <div className="adm-kpi-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Skeleton width={28} height={28} radius={8} />
            <Skeleton variant="text" width={90} height={14} />
          </div>
          <div className="adm-sat-kpi-center-list" style={{ marginTop: 10 }}>
            {[0, 1, 2].map((j) => (
              <div key={j} className="adm-sat-kpi-center-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0' }}>
                <Skeleton variant="text" width={28} height={12} />
                <Skeleton variant="text" width={48} height={12} />
                <Skeleton width={42} height={20} radius={999} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TodayHourlySkeleton() {
  return (
    <div className="adm-hourly-skeleton">
      <div className="adm-hourly-skeleton__filters">
        <Skeleton height={36} radius={10} />
        <Skeleton height={36} radius={10} />
      </div>
      <div className="adm-hourly-skeleton__grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={140} radius={16} />
        ))}
      </div>
    </div>
  );
}

function SummaryTableSkeletonRows({ rows = 6, cols = 9 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={`sk-${r}`}>
      {Array.from({ length: cols }).map((__, c) => (
        <td key={c}>
          <Skeleton variant="text" width={c < 3 ? 70 : 44} height={12} />
        </td>
      ))}
    </tr>
  ));
}

const MEMBER_ROWS_PAGE_SIZE = 10;

/** 금일 시간대별 카드 — 한 화면에 표시할 슬롯 수(나머지는 ◀ ▶ 로 이동) */
const HOURLY_CAROUSEL_PAGE_SIZE = 5;

/** 평가 제외 — TB_YOU_CS.스킬 과 동일한 4종 (고정) */
const SAT_EXCLUDE_SKILLS = ['일반', '리텐션', '이관', '멀티/기술'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDatetimeLocalValue(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(
    d.getMinutes(),
  )}`;
}

function monthRangeDatetimeLocal(y, m) {
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const lastDay = new Date(y, m, 0).getDate();
  const end = new Date(y, m - 1, lastDay, 23, 59, 0, 0);
  return { start: toDatetimeLocalValue(start), end: toDatetimeLocalValue(end) };
}

/** datetime-local(분 단위) → API LocalDateTime용 항상 해당 분의 :00초 */
function normalizeDatetimeLocalForApi(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  const minutePart = t.length >= 16 ? t.slice(0, 16) : t;
  if (minutePart.length === 16) return `${minutePart}:00`;
  return t;
}

function pct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(1)}%`;
}

/** 문제해결 연간 목표 대비 역산 달성률(%), 서버와 동일 식 */
function problemInverseAchievementPct(actualResolvedPct, targetResolvedPct) {
  if (actualResolvedPct == null || targetResolvedPct == null) return null;
  const t = Number(targetResolvedPct);
  const a = Number(actualResolvedPct);
  if (Number.isNaN(t) || Number.isNaN(a) || t <= 0 || t >= 100) return null;
  const targetGap = 100 - t;
  const actualGap = 100 - a;
  if (actualGap <= 0) return 100;
  if (targetGap <= 0) return null;
  return Math.min(100, Math.round((100 * targetGap) / actualGap * 10) / 10);
}

function num(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('ko-KR');
}

function fmtHourlyPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function yesNo(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === 'Y') return 'Y';
  if (s === 'N') return 'N';
  return '—';
}

function ynClass(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === 'Y') return 'is-yes';
  if (s === 'N') return 'is-no';
  return 'is-empty';
}

function formatDateTime(dt) {
  if (!dt) return '—';
  return String(dt).replace('T', ' ');
}

function dateKeyFromDateTime(dt) {
  if (!dt) return '';
  return String(dt).slice(0, 10);
}

function nextYnFilter(v) {
  if (v === 'ALL') return 'Y';
  if (v === 'Y') return 'N';
  return 'ALL';
}

function matchesYnFilter(value, filterValue) {
  if (filterValue === 'ALL') return true;
  return String(value ?? '').trim().toUpperCase() === filterValue;
}

function filterToneClass(v) {
  if (v === 'Y') return 'is-filter-y';
  if (v === 'N') return 'is-filter-n';
  return 'is-filter-all';
}

function KpiScopeListCard({ title, icon: Icon, rows = [] }) {
  const shortScopeLabel = (name) => {
    const s = String(name ?? '').trim();
    if (!s) return '—';
    if (s === '종합') return s;
    return [...s].slice(0, 2).join('');
  };

  const toRow = (r) => ({
    scopeKey: r?.scopeKey ?? r?.secondDepthDeptId ?? r?.taskCode ?? 'UNKNOWN',
    scopeName: r?.scopeName ?? r?.centerName ?? '종합',
    targetPercent: r?.targetPercent ?? null,
    actualRate: r?.actualRate ?? null,
    achievementRate: r?.achievementRate ?? null,
    targetMet:
      typeof r?.targetMet === 'boolean'
        ? r.targetMet
        : r?.achievementRate != null
          ? Number(r.achievementRate) >= 100
          : null,
  });

  const sourceRows = Array.isArray(rows)
    ? rows.map(toRow)
    : rows && typeof rows === 'object'
      ? [toRow(rows)]
      : [];

  const pickByName = (keyword) =>
    sourceRows.find((r) => String(r.scopeName ?? '').includes(keyword));
  const overallRow =
    sourceRows.find((r) => String(r.scopeName ?? '').trim() === '종합' || String(r.scopeKey) === 'OVERALL') ??
    { scopeKey: 'OVERALL', scopeName: '종합', targetPercent: null, actualRate: null, achievementRate: null, targetMet: null };
  const busanRow =
    pickByName('부산') ?? { scopeKey: 'BUSAN', scopeName: '부산', targetPercent: null, actualRate: null, achievementRate: null, targetMet: null };
  const seobuRow =
    pickByName('서부') ?? { scopeKey: 'SEOBU', scopeName: '서부', targetPercent: null, actualRate: null, achievementRate: null, targetMet: null };
  const renderFixedRow = (r) => (
    <div key={`${title}-${r.scopeKey}`} className="adm-sat-kpi-center-row">
      <span className="adm-sat-kpi-center-name" title={r.scopeName}>
        {shortScopeLabel(r.scopeName)}
      </span>
      <span className="adm-sat-kpi-center-pct">{pct(r.targetPercent)}</span>
      <span className="adm-sat-kpi-center-pct adm-sat-kpi-center-pct--actual">{pct(r.actualRate)}</span>
      <span
        className={
          r.targetMet == null
            ? 'adm-sat-kpi-badge adm-sat-kpi-badge--no'
            : r.targetMet
              ? 'adm-sat-kpi-badge adm-sat-kpi-badge--ok'
              : 'adm-sat-kpi-badge adm-sat-kpi-badge--no'
        }
      >
        {r.targetMet == null ? '—' : r.targetMet ? '달성' : '미달성'}
      </span>
    </div>
  );

  return (
    <div className="adm-kpi-card adm-kpi-card--tone-files adm-sat-kpi-card--centers">
      <div className="adm-kpi-head">
        <span className="adm-kpi-icon-wrap" aria-hidden>
          <Icon className="adm-kpi-ico" size={18} strokeWidth={2.25} />
        </span>
        <span className="adm-kpi-title">{title}</span>
      </div>
      <div className="adm-sat-kpi-center-list" aria-label={`${title} 구분·목표·실적·달성여부`}>
        <div className="adm-sat-kpi-center-head" aria-hidden>
          <span>구분</span>
          <span>목표</span>
          <span>실적</span>
          <span>달성여부</span>
        </div>
        {renderFixedRow(overallRow)}
        {renderFixedRow(busanRow)}
        {renderFixedRow(seobuRow)}
      </div>
    </div>
  );
}

function isSatisfactionRowSelectable(r) {
  const id = r?.secondDepthDeptId;
  return typeof id === 'number' && id > 0;
}

/** 센터·그룹 필터용 정규화 (빈 값은 '') — Dashboard 실(부서)별 성과와 동일 */
function normFilterKey(v) {
  return String(v ?? '').trim();
}

function localeKoTrim(a, b) {
  return String(a ?? '')
    .trim()
    .localeCompare(String(b ?? '').trim(), 'ko');
}

/** 필터된 행 기준 합계·가중 %용 분모(평가건) */
function computeSummaryTotals(list) {
  let fiveMajorSum = 0;
  let gen5060Sum = 0;
  let problemResolvedSum = 0;
  let evalTargetMemberSum = 0;
  let evalSum = 0;
  let satSum = 0;
  for (const r of list) {
    evalTargetMemberSum += Number(r.evalTargetMemberCount) || 0;
    fiveMajorSum += Number(r.fiveMajorCitiesCount) || 0;
    gen5060Sum += Number(r.gen5060Count) || 0;
    problemResolvedSum += Number(r.problemResolvedCount) || 0;
    evalSum += Number(r.evalCount) || 0;
    satSum += Number(r.satisfiedCount) || 0;
  }
  const satisfactionPct = evalSum === 0 ? null : Math.round((1000 * satSum) / evalSum) / 10;
  const fivePct = evalSum === 0 ? null : Math.round((1000 * fiveMajorSum) / evalSum) / 10;
  const genPct = evalSum === 0 ? null : Math.round((1000 * gen5060Sum) / evalSum) / 10;
  const probPct = evalSum === 0 ? null : Math.round((1000 * problemResolvedSum) / evalSum) / 10;
  return {
    evalTargetMemberSum,
    fiveMajorSum,
    gen5060Sum,
    problemResolvedSum,
    evalSum,
    satSum,
    satisfactionPct,
    fivePct,
    genPct,
    probPct,
  };
}

export default function AdminSatisfactionPage() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const adminSkid = authUser?.skid ?? authUser?.id ?? '';
  const [hourlyTuned, setHourlyTuned] = useState(false);
  const [hourlyCenter, setHourlyCenter] = useState(0);
  const [hourlySkill, setHourlySkill] = useState('');
  const [hourlyCarouselStart, setHourlyCarouselStart] = useState(0);
  const [baseMonth, setBaseMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const year = baseMonth.getFullYear();
  const month = baseMonth.getMonth() + 1;
  const monthLabel = `${year}년 ${month}월`;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [targetUploadModalOpen, setTargetUploadModalOpen] = useState(false);
  const [excludeModalOpen, setExcludeModalOpen] = useState(false);
  const [excludeSkill, setExcludeSkill] = useState(SAT_EXCLUDE_SKILLS[0]);
  const [excludeStartLocal, setExcludeStartLocal] = useState('');
  const [excludeEndLocal, setExcludeEndLocal] = useState('');
  const [excludeMsg, setExcludeMsg] = useState('');
  const [excludeErr, setExcludeErr] = useState('');

  /** null = 미적용, 문자열(빈 문자열 포함) = 해당 값과 일치하는 행만 — Dashboard와 동일 */
  const [filterCenter, setFilterCenter] = useState(null);
  const [filterGroup, setFilterGroup] = useState(null);
  const [filterSkill, setFilterSkill] = useState(null);
  const [selectedSecondDepthId, setSelectedSecondDepthId] = useState(null);
  const [selectedMemberSkid, setSelectedMemberSkid] = useState(null);

  const summaryQuery = useQuery({
    queryKey: ['cs-satisfaction-summary', 'rolling-mtd'],
    queryFn: () => fetchCsSatisfactionSummary({ rollingThroughYesterday: true }),
  });

  const dashboardKpisQuery = useQuery({
    queryKey: ['cs-satisfaction-dashboard-kpis', year, month],
    queryFn: () => fetchCsSatisfactionDashboardKpis(year, month),
  });

  const hourlyQuery = useQuery({
    queryKey: ['cs-satisfaction-today-hourly', hourlyTuned, adminSkid, hourlyCenter, hourlySkill],
    queryFn: () =>
      hourlyTuned
        ? fetchCsSatisfactionTodayHourly({
            adminSkid: adminSkid || undefined,
            secondDepthDeptId: hourlyCenter,
            skill: hourlySkill,
          })
        : fetchCsSatisfactionTodayHourly({ adminSkid: adminSkid || undefined }),
  });

  const hourlyCenterSelectValue = hourlyTuned
    ? hourlyCenter
    : hourlyQuery.data?.appliedSecondDepthDeptId ?? 0;
  const hourlySkillSelectValue = hourlyTuned
    ? hourlySkill
    : hourlyQuery.data?.appliedSkill ?? '';

  const hourlyHours = useMemo(() => hourlyQuery.data?.hours ?? [], [hourlyQuery.data?.hours]);
  const hourlyHoursKey = useMemo(() => hourlyHours.map((h) => h.hour).join(','), [hourlyHours]);
  const hourlyCarouselMaxStart = Math.max(0, hourlyHours.length - HOURLY_CAROUSEL_PAGE_SIZE);
  const hourlyCarouselSafeStart = Math.min(hourlyCarouselStart, hourlyCarouselMaxStart);
  const visibleHourlySlots = hourlyHours.slice(
    hourlyCarouselSafeStart,
    hourlyCarouselSafeStart + HOURLY_CAROUSEL_PAGE_SIZE,
  );
  const canGoHourlyPrev = hourlyCarouselSafeStart > 0;
  const canGoHourlyNext = hourlyCarouselSafeStart < hourlyCarouselMaxStart;

  useEffect(() => {
    setHourlyCarouselStart(0);
  }, [hourlyHoursKey]);

  useEffect(() => {
    setHourlyCarouselStart((s) => Math.min(s, hourlyCarouselMaxStart));
  }, [hourlyCarouselMaxStart]);

  const filterMeta = summaryQuery.data?.filterMeta;
  const secondDepthOptions = useMemo(
    () => mergeSecondDepthOptions(filterMeta?.secondDepthDepts),
    [filterMeta?.secondDepthDepts],
  );
  const secondDepthLabelHint =
    secondDepthOptions.length > 0
      ? secondDepthOptions.map((o) => o.name).join(' · ')
      : '—';

  const kpiData = dashboardKpisQuery.data;
  const overviewLoading = dashboardKpisQuery.isPending;
  const overviewError = dashboardKpisQuery.error;

  const centerDetailEnabled =
    selectedSecondDepthId != null &&
    !Number.isNaN(selectedSecondDepthId) &&
    selectedSecondDepthId > 0;

  const centerMonthDetailQuery = useQuery({
    queryKey: ['cs-satisfaction-center-month-detail', selectedSecondDepthId, 'rolling-mtd'],
    queryFn: () =>
      fetchCsSatisfactionCenterMonthDetail(selectedSecondDepthId, { rollingThroughYesterday: true }),
    enabled: centerDetailEnabled,
  });

  const excludeLogQuery = useQuery({
    queryKey: ['cs-satisfaction-exclude-log'],
    queryFn: () => fetchCsSatisfactionExcludeLog(40),
    enabled: excludeModalOpen,
  });

  const memberMonthlyRowsQuery = useQuery({
    queryKey: ['cs-satisfaction-member-monthly-rows', selectedMemberSkid, year],
    queryFn: () => fetchCsSatisfactionMemberMonthlyRows(selectedMemberSkid, year),
    enabled: selectedMemberSkid != null && selectedMemberSkid !== '',
  });

  const rows = useMemo(() => summaryQuery.data?.rows ?? [], [summaryQuery.data]);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (filterCenter !== null) {
          const c = normFilterKey(r.centerName);
          if (filterCenter === '' ? c !== '' : c !== filterCenter) return false;
        }
        if (filterGroup !== null) {
          const g = normFilterKey(r.groupName);
          if (filterGroup === '' ? g !== '' : g !== filterGroup) return false;
        }
        if (filterSkill !== null) {
          const s = normFilterKey(r.skill);
          if (filterSkill === '' ? s !== '' : s !== filterSkill) return false;
        }
        return true;
      }),
    [rows, filterCenter, filterGroup, filterSkill],
  );

  /** 기본: 센터 → 그룹 → 실명(팀명) 오름차순 — 관리 대시보드 실(부서)별 성과와 동일 계층 */
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      const c = localeKoTrim(a.centerName, b.centerName);
      if (c !== 0) return c;
      const g = localeKoTrim(a.groupName, b.groupName);
      if (g !== 0) return g;
      return localeKoTrim(a.secondDepthName, b.secondDepthName);
    });
    return list;
  }, [filteredRows]);

  const summaryTotals = useMemo(() => computeSummaryTotals(filteredRows), [filteredRows]);
  const statPeriodHint = useMemo(() => {
    const d = summaryQuery.data;
    if (d?.statFrom && d?.statTo) {
      return `${d.statFrom} ~ ${d.statTo} (KST · 1일이면 전월 전체, 아니면 당월 1일~전일)`;
    }
    return monthLabel;
  }, [summaryQuery.data, monthLabel]);
  const summaryFooterProblemInverse = useMemo(
    () =>
      problemInverseAchievementPct(
        summaryTotals.probPct,
        summaryQuery.data?.problemResolvedAnnualTargetPercent,
      ),
    [summaryTotals.probPct, summaryQuery.data?.problemResolvedAnnualTargetPercent],
  );
  const memberRows = useMemo(
    () => centerMonthDetailQuery.data?.members ?? [],
    [centerMonthDetailQuery.data],
  );
  const selectedMember = useMemo(
    () => memberRows.find((m) => m.skid === selectedMemberSkid) ?? null,
    [memberRows, selectedMemberSkid],
  );
  const selectedDeptRow = useMemo(
    () => rows.find((r) => r.secondDepthDeptId === selectedSecondDepthId) ?? null,
    [rows, selectedSecondDepthId],
  );
  const modalDateBuckets = useMemo(() => {
    const months = memberMonthlyRowsQuery.data?.months ?? [];
    const allRows = months.flatMap((m) => m.rows ?? []);
    const grouped = new Map();
    for (const row of allRows) {
      const k = dateKeyFromDateTime(row?.consultDateTime);
      if (!k) continue;
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(row);
    }
    return [...grouped.entries()]
      .sort((a, b) => String(b[0]).localeCompare(String(a[0]), 'ko'))
      .map(([date, rowsInDate]) => ({ date, rows: rowsInDate, count: rowsInDate.length }));
  }, [memberMonthlyRowsQuery.data]);
  const [modalDate, setModalDate] = useState(null);
  const [modalPage, setModalPage] = useState(1);
  const [modalYnFilters, setModalYnFilters] = useState({
    satisfiedYn: 'ALL',
    fiveMajorCitiesYn: 'ALL',
    gen5060Yn: 'ALL',
    problemResolvedYn: 'ALL',
  });
  const modalDateIndex = useMemo(
    () => modalDateBuckets.findIndex((b) => String(b.date) === String(modalDate)),
    [modalDateBuckets, modalDate],
  );
  const modalSelectedBucket = modalDateIndex >= 0 ? modalDateBuckets[modalDateIndex] : null;
  const modalFilteredRows = useMemo(() => {
    const rowsInDate = modalSelectedBucket?.rows ?? [];
    return rowsInDate.filter((r) => {
      if (!matchesYnFilter(r?.satisfiedYn, modalYnFilters.satisfiedYn)) return false;
      if (!matchesYnFilter(r?.fiveMajorCitiesYn, modalYnFilters.fiveMajorCitiesYn)) return false;
      if (!matchesYnFilter(r?.gen5060Yn, modalYnFilters.gen5060Yn)) return false;
      if (!matchesYnFilter(r?.problemResolvedYn, modalYnFilters.problemResolvedYn)) return false;
      return true;
    });
  }, [modalSelectedBucket, modalYnFilters]);
  const modalTotalPages = useMemo(() => {
    const total = modalFilteredRows.length;
    return Math.max(1, Math.ceil(total / MEMBER_ROWS_PAGE_SIZE));
  }, [modalFilteredRows]);
  const modalFilteredCount = modalFilteredRows.length;
  const modalPagedRows = useMemo(() => {
    const start = (modalPage - 1) * MEMBER_ROWS_PAGE_SIZE;
    return modalFilteredRows.slice(start, start + MEMBER_ROWS_PAGE_SIZE);
  }, [modalFilteredRows, modalPage]);

  const excludeTimeMutation = useMutation({
    mutationFn: ({ skill, startAt, endAt, excludedBySkid }) =>
      excludeCsSatisfactionEvalRange({ skill, startAt, endAt, excludedBySkid }),
    onSuccess: (res) => {
      setExcludeMsg(
        `해당건을 평가 제외 했습니다.`,
      );
      setExcludeErr('');
      summaryQuery.refetch();
      centerMonthDetailQuery.refetch();
      dashboardKpisQuery.refetch();
      hourlyQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-summary'] });
      queryClient.invalidateQueries({ queryKey: ['cs-satisfaction-exclude-log'] });
    },
    onError: (e) => {
      setExcludeErr(e?.message ?? '평가 제외 처리 중 오류가 발생했습니다.');
      setExcludeMsg('');
    },
  });

  const loading = summaryQuery.isLoading;
  const err = summaryQuery.error?.message;

  useEffect(() => {
    if (searchParams.get('setup') === '1') {
      setSetupModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('setup');
      navigate({ pathname: '/admin/satisfaction', search: next.toString() }, { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    if (selectedSecondDepthId == null) return;
    const still = rows.some(
      (r) => r.secondDepthDeptId === selectedSecondDepthId && isSatisfactionRowSelectable(r),
    );
    if (!still) {
      setSelectedSecondDepthId(null);
      return;
    }
    const visible = filteredRows.some(
      (r) => r.secondDepthDeptId === selectedSecondDepthId && isSatisfactionRowSelectable(r),
    );
    if (!visible) setSelectedSecondDepthId(null);
  }, [rows, filteredRows, selectedSecondDepthId]);

  useEffect(() => {
    setSelectedMemberSkid(null);
  }, [selectedSecondDepthId, year]);

  useEffect(() => {
    if (selectedMemberSkid == null) {
      setModalDate(null);
      setModalPage(1);
      setModalYnFilters({
        satisfiedYn: 'ALL',
        fiveMajorCitiesYn: 'ALL',
        gen5060Yn: 'ALL',
        problemResolvedYn: 'ALL',
      });
      return;
    }
    if (modalDateBuckets.length === 0) return;
    const exists = modalDateBuckets.some((b) => String(b.date) === String(modalDate));
    if (!exists) {
      setModalDate(modalDateBuckets[0].date);
      setModalPage(1);
    }
  }, [selectedMemberSkid, modalDateBuckets, modalDate]);

  useEffect(() => {
    setModalPage(1);
  }, [modalDate, modalYnFilters]);

  useEffect(() => {
    setModalPage((p) => Math.min(p, modalTotalPages));
  }, [modalTotalPages]);

  useEffect(() => {
    if (!excludeModalOpen) return;
    if (!excludeSkill || !SAT_EXCLUDE_SKILLS.includes(excludeSkill)) {
      setExcludeSkill(SAT_EXCLUDE_SKILLS[0]);
    }
  }, [excludeModalOpen, excludeSkill]);

  useEffect(() => {
    if (selectedMemberSkid == null) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedMemberSkid(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedMemberSkid]);

  const handleCenterFilterClick = (e, r) => {
    e.stopPropagation();
    const key = normFilterKey(r.centerName);
    setFilterCenter((prev) => (prev === key ? null : key));
  };

  const handleGroupFilterClick = (e, r) => {
    e.stopPropagation();
    const key = normFilterKey(r.groupName);
    setFilterGroup((prev) => (prev === key ? null : key));
  };

  const handleSkillFilterClick = (e, r) => {
    e.stopPropagation();
    const key = normFilterKey(r.skill);
    setFilterSkill((prev) => (prev === key ? null : key));
  };

  const clearDeptFilters = () => {
    setFilterCenter(null);
    setFilterGroup(null);
    setFilterSkill(null);
  };

  const moveMonth = (delta) => {
    setBaseMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const openExcludeModal = () => {
    const { start, end } = monthRangeDatetimeLocal(year, month);
    setExcludeSkill(SAT_EXCLUDE_SKILLS[0]);
    setExcludeStartLocal(start);
    setExcludeEndLocal(end);
    setExcludeModalOpen(true);
    setExcludeMsg('');
    setExcludeErr('');
  };

  const closeExcludeModal = () => {
    setExcludeModalOpen(false);
    setExcludeMsg('');
    setExcludeErr('');
  };

  const handleExcludeSubmit = () => {
    const startAt = normalizeDatetimeLocalForApi(excludeStartLocal);
    const endAt = normalizeDatetimeLocalForApi(excludeEndLocal);
    if (!excludeSkill || !startAt || !endAt) {
      setExcludeErr('스킬, 시작 일시, 종료 일시를 모두 입력해 주세요.');
      setExcludeMsg('');
      return;
    }
    if (new Date(startAt).getTime() > new Date(endAt).getTime()) {
      setExcludeErr('시작 일시가 종료 일시보다 늦을 수 없습니다.');
      setExcludeMsg('');
      return;
    }
    excludeTimeMutation.mutate({
      skill: excludeSkill,
      startAt,
      endAt,
      excludedBySkid: adminSkid || undefined,
    });
  };

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in adm-sat-page">
      <header className="adm-header adm-header--yp">
        <div className="adm-header-row">
          <div className="adm-header-text">
            <p className="adm-identity-kicker">YOU PRO · 관리</p>
            <h1 className="adm-title">CS 만족도 대시보드</h1>
            <p className="adm-sub">
              상단 KPI는 <strong>{monthLabel}</strong>, 실별·구성원 표는{' '}
              <strong>당월 1일~전일(KST·1일이면 전월)</strong> 누적 구간입니다.
            </p>
          </div>
          <div className="adm-sat-header-actions">
            <div className="adm-sat-month-nav" aria-label="조회 월 이동">
              <button
                type="button"
                className="btn btn-secondary btn-sm adm-sat-month-nav-btn"
                onClick={() => moveMonth(-1)}
                aria-label="이전 달"
              >
                <ChevronLeft size={14} aria-hidden />
              </button>
              <strong className="adm-sat-month-nav-label">{monthLabel}</strong>
              <button
                type="button"
                className="btn btn-secondary btn-sm adm-sat-month-nav-btn"
                onClick={() => moveMonth(1)}
                aria-label="다음 달"
              >
                <ChevronRight size={14} aria-hidden />
              </button>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm adm-sat-upload-entry"
              onClick={openExcludeModal}
            >
              평가 제외
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm adm-sat-upload-entry"
              onClick={() => setTargetUploadModalOpen(true)}
            >
              평가 대상자
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm adm-sat-upload-entry"
              onClick={() => setSetupModalOpen(true)}
            >
              목표 설정
            </button>
          </div>
        </div>
      </header>

      <section className="adm-section adm-section--center-overview" aria-labelledby="adm-sat-overview-title">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 id="adm-sat-overview-title" className="adm-section-heading">
              전체 센터 현황
            </h2>
            <p className="adm-section-hint">
              <strong>{secondDepthLabelHint}</strong> · 기준:{' '}
              {kpiData?.kpiMonth != null ? (
                <>
                  {kpiData.kpiYear}년 {kpiData.kpiMonth}월
                </>
              ) : (
                '당월'
              )}
              {' · '}
              중점 추진은 연간 목표 기준
            </p>
          </div>
        </div>
        <div className="adm-overview-shell">
          {overviewLoading ? (
            <KpiOverviewSkeleton />
          ) : overviewError ? (
            <p className="adm-sat-chart-error">{overviewError?.message ?? '지표를 불러오지 못했습니다.'}</p>
          ) : (
            <div className="adm-overview-grid adm-sat-kpi-grid adm-sat-kpi-grid--four">
              <KpiScopeListCard title="종합 만족도" icon={Building2} rows={kpiData?.centerAchievements ?? []} />
              <KpiScopeListCard title="5대 도시" icon={MapPinned} rows={kpiData?.fiveMajorCities ?? []} />
              <KpiScopeListCard title="5060" icon={UserCircle2} rows={kpiData?.gen5060 ?? []} />
              <KpiScopeListCard title="문제해결" icon={CheckCircle2} rows={kpiData?.problemResolved ?? []} />
            </div>
          )}
        </div>
      </section>

      <section className="adm-section adm-hourly-section" aria-labelledby="adm-hourly-title">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 id="adm-hourly-title" className="adm-section-heading">
              금일 시간대별 만족도
            </h2>
          </div>
        </div>

        <div className="adm-hourly-shell">
          <div className="adm-hourly-toolbar">
            <div className="adm-hourly-filters" aria-label="시간대별 만족도 필터">
              <label className="adm-hourly-filter">
                <span className="adm-hourly-filter-k">센터</span>
                <select
                  className="adm-hourly-select"
                  value={hourlyCenterSelectValue}
                  onChange={(e) => {
                    setHourlyTuned(true);
                    setHourlyCenter(Number(e.target.value));
                  }}
                  disabled={hourlyQuery.isPending}
                >
                  {(hourlyQuery.data?.centers ?? [{ id: 0, name: '전체' }]).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="adm-hourly-filter">
                <span className="adm-hourly-filter-k">스킬</span>
                <select
                  className="adm-hourly-select"
                  value={hourlySkillSelectValue}
                  onChange={(e) => {
                    setHourlyTuned(true);
                    setHourlySkill(e.target.value);
                  }}
                  disabled={hourlyQuery.isPending}
                >
                  <option value="">전체 스킬</option>
                  {(hourlyQuery.data?.skillOptions ?? SAT_EXCLUDE_SKILLS).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="adm-hourly-meta">
              <button
                type="button"
                className="adm-hourly-nav-btn"
                onClick={() =>
                  setHourlyCarouselStart((s) => Math.max(0, s - HOURLY_CAROUSEL_PAGE_SIZE))
                }
                disabled={!canGoHourlyPrev || hourlyQuery.isPending}
                aria-label="이전 시간대"
              >
                <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
              </button>
              <button
                type="button"
                className="adm-hourly-nav-btn"
                onClick={() =>
                  setHourlyCarouselStart((s) =>
                    Math.min(hourlyCarouselMaxStart, s + HOURLY_CAROUSEL_PAGE_SIZE),
                  )
                }
                disabled={!canGoHourlyNext || hourlyQuery.isPending}
                aria-label="다음 시간대"
              >
                <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm adm-sat-refresh"
                onClick={() => {
                  summaryQuery.refetch();
                  centerMonthDetailQuery.refetch();
                  dashboardKpisQuery.refetch();
                  hourlyQuery.refetch();
                }}
                disabled={
                  summaryQuery.isFetching ||
                  centerMonthDetailQuery.isFetching ||
                  dashboardKpisQuery.isFetching ||
                  hourlyQuery.isFetching
                }
                aria-label="새로고침"
              >
                <RefreshCw
                  size={14}
                  className={
                    summaryQuery.isFetching ||
                    centerMonthDetailQuery.isFetching ||
                    dashboardKpisQuery.isFetching ||
                    hourlyQuery.isFetching
                      ? 'adm-sat-spin'
                      : ''
                  }
                  aria-hidden
                />
              </button>
            </div>
          </div>

          {hourlyQuery.isPending ? (
            <TodayHourlySkeleton />
          ) : hourlyQuery.isError ? (
            <p className="adm-sat-query-err">{hourlyQuery.error?.message ?? '시간대별 데이터를 불러오지 못했습니다.'}</p>
          ) : (hourlyQuery.data?.hours ?? []).length === 0 ? (
            <p className="adm-hourly-empty">
              아직 표시할 이전 시간대가 없습니다. (업무 시작 09시 이전이거나, 첫 시간대 진행 중일 수 있습니다.)
            </p>
          ) : (
            <div className="adm-hourly-strip" role="list">
              {visibleHourlySlots.map((slot) => (
                <article key={slot.hour} className="adm-hourly-slot" role="listitem">
                  <div className="adm-hourly-slot__head">
                    <span className="adm-hourly-slot__time">{slot.label}</span>
                    <span className="adm-hourly-slot__n">{num(slot.sampleCount)}건</span>
                  </div>
                  <dl className="adm-hourly-slot__metrics">
                    <div className="adm-hourly-metric">
                      <dt>만족</dt>
                      <dd className="adm-hourly-metric-val adm-hourly-metric-val--pos">{fmtHourlyPct(slot.satisfiedPct)}</dd>
                    </div>
                    <div className="adm-hourly-metric">
                      <dt>불만족</dt>
                      <dd className="adm-hourly-metric-val adm-hourly-metric-val--neg">{fmtHourlyPct(slot.dissatisfiedPct)}</dd>
                    </div>
                    <div className="adm-hourly-metric">
                      <dt>5대도시</dt>
                      <dd className="adm-hourly-metric-val">{fmtHourlyPct(slot.fiveMajorCitiesPct)}</dd>
                    </div>
                    <div className="adm-hourly-metric">
                      <dt>5060</dt>
                      <dd className="adm-hourly-metric-val">{fmtHourlyPct(slot.gen5060Pct)}</dd>
                    </div>
                    <div className="adm-hourly-metric">
                      <dt>문제해결</dt>
                      <dd className="adm-hourly-metric-val">{fmtHourlyPct(slot.problemResolvedPct)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="adm-section" aria-labelledby="adm-sat-table-title">
        <div className="adm-section-title">
          <div className="adm-sat-section-heading">
            <span className="adm-title-bar" aria-hidden />
            <div className="adm-section-title-text">
              <h2 id="adm-sat-table-title" className="adm-section-heading">
                실별 만족도
              </h2>
            </div>
          </div>
        </div>

        {(filterCenter !== null || filterGroup !== null || filterSkill !== null) && (
          <div className="adm-dept-filter-bar" aria-label="적용 중인 필터">
            <span className="adm-dept-filter-bar__label">필터</span>
            {filterCenter !== null && (
              <button
                type="button"
                className="adm-dept-filter-chip"
                onClick={() => setFilterCenter(null)}
                aria-label={`센터 필터 해제: ${filterCenter === '' ? '없음' : filterCenter}`}
              >
                센터: {filterCenter === '' ? '없음' : filterCenter}
                <X className="adm-dept-filter-chip__x" size={14} strokeWidth={2.2} aria-hidden />
              </button>
            )}
            {filterGroup !== null && (
              <button
                type="button"
                className="adm-dept-filter-chip"
                onClick={() => setFilterGroup(null)}
                aria-label={`그룹 필터 해제: ${filterGroup === '' ? '없음' : filterGroup}`}
              >
                그룹: {filterGroup === '' ? '없음' : filterGroup}
                <X className="adm-dept-filter-chip__x" size={14} strokeWidth={2.2} aria-hidden />
              </button>
            )}
            {filterSkill !== null && (
              <button
                type="button"
                className="adm-dept-filter-chip"
                onClick={() => setFilterSkill(null)}
                aria-label={`스킬 필터 해제: ${filterSkill === '' ? '없음' : filterSkill}`}
              >
                스킬: {filterSkill === '' ? '없음' : filterSkill}
                <X className="adm-dept-filter-chip__x" size={14} strokeWidth={2.2} aria-hidden />
              </button>
            )}
            <button type="button" className="adm-dept-filter-clear" onClick={clearDeptFilters}>
              전체 해제
            </button>
          </div>
        )}

        {err ? <p className="adm-sat-query-err">{err}</p> : null}

        <div className="adm-table-wrap">
          <table className="adm-table adm-table--dept-performance adm-sat-summary-table">
            <thead>
              <tr>
                <th scope="col" className="adm-th-cell">
                  센터
                </th>
                <th scope="col" className="adm-th-cell">
                  그룹
                </th>
                <th scope="col" className="adm-th-cell">
                  스킬
                </th>
                <th scope="col" className="adm-th-cell">
                  팀명
                </th>
                <th scope="col" className="adm-th-cell">
                  만족도
                </th>
                <th scope="col" className="adm-th-cell">
                  5대도시
                </th>
                <th scope="col" className="adm-th-cell">
                  5060
                </th>
                <th scope="col" className="adm-th-cell">
                  문제해결
                </th>
                <th scope="col" className="adm-th-cell">
                  문제해결 달성(역산)
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SummaryTableSkeletonRows rows={6} cols={8} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="adm-table-empty">
                    데이터 없음
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="adm-table-empty">
                    조건에 맞는 실이 없습니다. 필터를 해제하거나 다른 값을 선택해 보세요.
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => {
                  const selectable = isSatisfactionRowSelectable(r);
                  const sid = r.secondDepthDeptId;
                  return (
                    <tr
                      key={String(sid ?? 'unmatched')}
                      className={selectable ? `adm-tr ${selectedSecondDepthId === sid ? 'is-selected' : ''}` : undefined}
                      onClick={
                        selectable
                          ? () =>
                              setSelectedSecondDepthId((prev) => (prev === sid ? null : sid))
                          : undefined
                      }
                    >
                      <td>
                        <button
                          type="button"
                          className={`adm-dept-filter-btn ${
                            filterCenter !== null && normFilterKey(r.centerName) === filterCenter
                              ? 'is-active'
                              : ''
                          }`}
                          onClick={(e) => handleCenterFilterClick(e, r)}
                          title="이 센터만 보기 (같은 값을 다시 클릭하면 해제)"
                        >
                          {(r.centerName && String(r.centerName).trim()) || '—'}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`adm-dept-filter-btn ${
                            filterGroup !== null && normFilterKey(r.groupName) === filterGroup
                              ? 'is-active'
                              : ''
                          }`}
                          onClick={(e) => handleGroupFilterClick(e, r)}
                          title="이 그룹만 보기 (같은 값을 다시 클릭하면 해제)"
                        >
                          {(r.groupName && String(r.groupName).trim()) || '—'}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`adm-dept-filter-btn ${
                            filterSkill !== null && normFilterKey(r.skill) === filterSkill
                              ? 'is-active'
                              : ''
                          }`}
                          onClick={(e) => handleSkillFilterClick(e, r)}
                          title="이 스킬만 보기 (같은 값을 다시 클릭하면 해제)"
                        >
                          {(r.skill && String(r.skill).trim()) || '—'}
                        </button>
                      </td>
                      <td>
                        <span className="adm-team-name">{r.secondDepthName}</span>
                        <span className="adm-member-badge">{num(r.evalTargetMemberCount)}명</span>
                      </td>
                      <td>{pct(r.satisfactionRate)}</td>
                      <td>{pct(r.fiveMajorCitiesPct)}</td>
                      <td>{pct(r.gen5060Pct)}</td>
                      <td>{pct(r.problemResolvedPct)}</td>
                      <td>{pct(r.problemResolvedInverseAchievementPct)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && rows.length > 0 && filteredRows.length > 0 ? (
              <tfoot>
                <tr className="adm-table-total-row">
                  <td colSpan={4} className="adm-sat-table-tfoot-label">
                    <span className="adm-table-total-label">합계</span>
                    <span className="adm-table-total-sublabel">
                      {sortedRows.length}개 실 · 평가대상 {num(summaryTotals.evalTargetMemberSum)}명 · 평가{' '}
                      {num(summaryTotals.evalSum)}건
                    </span>
                  </td>
                  <td>{pct(summaryTotals.satisfactionPct)}</td>
                  <td>{pct(summaryTotals.fivePct)}</td>
                  <td>{pct(summaryTotals.genPct)}</td>
                  <td>{pct(summaryTotals.probPct)}</td>
                  <td>{pct(summaryFooterProblemInverse)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        <div className="adm-sat-members-below">
          <div className="adm-section-title">
            <span className="adm-title-bar" />
            <div>
              <h3 className="adm-section-heading">구성원 상세 현황</h3>
            </div>
          </div>

          {selectedSecondDepthId == null ? (
            <div className="adm-select-prompt">
              <UserCircle2 className="adm-select-prompt-ico" size={40} strokeWidth={1.35} />
              <h3>팀을 선택해 주세요</h3>
              <p>위 표에서 실(부서) 행을 클릭하면 해당 팀 구성원 상세를 아래에서 바로 확인할 수 있습니다.</p>
            </div>
          ) : centerMonthDetailQuery.isLoading ? (
            <div className="adm-team-detail-loading">
              <div className="spinner" />
              <p>구성원 만족도 정보를 불러오는 중…</p>
            </div>
          ) : centerMonthDetailQuery.isError ? (
            <p className="adm-team-detail-error">
              {centerMonthDetailQuery.error?.message ?? '구성원 만족도 정보를 불러오지 못했습니다.'}
            </p>
          ) : memberRows.length === 0 ? (
            <div className="adm-select-prompt adm-sat-members-empty">
              <h3>구성원 데이터 없음</h3>
              <p>선택한 팀에 해당 구간 기준 평가대상자 구성원 데이터가 없습니다.</p>
            </div>
          ) : (
            <div className="adm-team-detail-embed member-cards-list adm-sat-members-list">
              {memberRows.map((m) => {
                const selected = selectedMemberSkid === m.skid;
                return (
                  <article
                    key={m.skid}
                    className={`member-detail-card member-detail-card--metrics adm-sat-member-detail-card ${
                      selected ? 'is-selected' : ''
                    }`}
                    onClick={() => setSelectedMemberSkid(m.skid)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedMemberSkid(m.skid);
                      }
                    }}
                  >
                    <div className="member-card-header">
                      <div className="member-card-left">
                        <div className="member-avatar-lg">
                          {(m.mbName?.trim() ? m.mbName : m.skid).charAt(0)}
                        </div>
                        <div>
                          <div className="member-card-name">{m.mbName?.trim() ? m.mbName : m.skid}</div>
                          <div className="member-card-pos">
                            {m.skid} · {(selectedDeptRow?.centerName ?? '—')} / {(selectedDeptRow?.groupName ?? '—')} /{' '}
                            {(selectedDeptRow?.skill ?? '—')}
                          </div>
                        </div>
                      </div>

                      <div className="member-card-stats member-card-stats--metrics">
                        <div className="mcs-item mcs-item--panel">
                          <span className="mcs-label">만족도</span>
                          <span className="mcs-value">{pct(m.satisfactionRate)}</span>
                        </div>
                        <div className="mcs-item mcs-item--panel">
                          <span className="mcs-label">5대도시</span>
                          <span className="mcs-value">{pct(m.fiveMajorCitiesPct)}</span>
                        </div>
                        <div className="mcs-item mcs-item--panel">
                          <span className="mcs-label">5060</span>
                          <span className="mcs-value">{pct(m.gen5060Pct)}</span>
                        </div>
                        <div className="mcs-item mcs-item--panel">
                          <span className="mcs-label">문제해결</span>
                          <span className="mcs-value">{pct(m.problemResolvedPct)}</span>
                        </div>
                        <div className="mcs-item mcs-item--panel">
                          <span className="mcs-label">문제해결 달성(역산)</span>
                          <span className="mcs-value">{pct(m.problemResolvedInverseAchievementPct)}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedMemberSkid != null && (
        <div
          className="adm-sat-row-modal-backdrop"
          onClick={() => setSelectedMemberSkid(null)}
          role="presentation"
        >
          <section
            className="adm-sat-row-modal"
            role="dialog"
            aria-modal="true"
            aria-label="구성원 접수 상세"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="adm-sat-row-modal-head">
              <div>
                <h3 className="adm-sat-row-modal-title">
                  {(memberMonthlyRowsQuery.data?.memberName || selectedMember?.mbName || selectedMemberSkid)} ({selectedMemberSkid})
                </h3>
                <p className="adm-sat-row-modal-sub">
                  {year}년 전체 접수 상세 · 총 {num(memberMonthlyRowsQuery.data?.totalCount ?? 0)}건
                </p>
              </div>
              <div className="adm-sat-row-modal-month-nav">
                <button
                  type="button"
                  className="adm-sat-row-modal-month-btn"
                  onClick={() => {
                    if (modalDateIndex >= modalDateBuckets.length - 1) return;
                    setModalDate(modalDateBuckets[modalDateIndex + 1].date);
                  }}
                  disabled={modalDateIndex < 0 || modalDateIndex >= modalDateBuckets.length - 1}
                  aria-label="이전 일자"
                >
                  <ChevronLeft size={14} aria-hidden />
                </button>
                <strong className="adm-sat-row-modal-month-label">
                  {modalSelectedBucket ? modalSelectedBucket.date : '—'}
                </strong>
                <button
                  type="button"
                  className="adm-sat-row-modal-month-btn"
                  onClick={() => {
                    if (modalDateIndex <= 0) return;
                    setModalDate(modalDateBuckets[modalDateIndex - 1].date);
                  }}
                  disabled={modalDateIndex <= 0}
                  aria-label="다음 일자"
                >
                  <ChevronRight size={14} aria-hidden />
                </button>
              </div>
              <button
                type="button"
                className="adm-sat-row-modal-close"
                onClick={() => setSelectedMemberSkid(null)}
                aria-label="모달 닫기"
              >
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="adm-sat-row-modal-body">
              {memberMonthlyRowsQuery.isLoading ? (
                <div className="adm-team-detail-loading">
                  <div className="spinner" />
                  <p>구성원 접수 row를 불러오는 중…</p>
                </div>
              ) : memberMonthlyRowsQuery.isError ? (
                <p className="adm-team-detail-error">
                  {memberMonthlyRowsQuery.error?.message ?? '구성원 접수 row를 불러오지 못했습니다.'}
                </p>
              ) : (memberMonthlyRowsQuery.data?.months?.length ?? 0) === 0 ? (
                <p className="adm-sat-query-empty">해당 연도 접수 row가 없습니다.</p>
              ) : (
                <div className="adm-sat-member-month-bucket">
                  <div className="adm-sat-modal-context-bar">
                    <div className="adm-sat-modal-context-date">
                      <span className="adm-sat-modal-context-kicker">조회 일자</span>
                      <strong>{modalSelectedBucket ? modalSelectedBucket.date : '—'}</strong>
                    </div>
                    <div className="adm-sat-modal-context-meta">
                      <span className="adm-sat-modal-context-pill">필터 결과 {num(modalFilteredCount)}건</span>
                      <span className="adm-sat-modal-context-pill">페이지 {modalPage} / {modalTotalPages}</span>
                    </div>
                  </div>
                  <div className="adm-table-wrap adm-sat-modal-table-wrap">
                    <table className="adm-table adm-sat-modal-rows-table">
                      <thead>
                        <tr>
                          <th><span className="adm-sat-modal-th-wrap">상담일시</span></th>
                          <th><span className="adm-sat-modal-th-wrap">상담유형</span></th>
                          <th>
                            <div className="adm-sat-modal-th-filter">
                              <button
                                type="button"
                                className="adm-sat-modal-th-btn"
                                onClick={() =>
                                  setModalYnFilters((prev) => ({
                                    ...prev,
                                    satisfiedYn: nextYnFilter(prev.satisfiedYn),
                                  }))
                                }
                                aria-label={`만족 필터 변경 현재 ${modalYnFilters.satisfiedYn}`}
                              >
                                <span
                                  className={`adm-sat-modal-th-wrap ${filterToneClass(modalYnFilters.satisfiedYn)}`}
                                >
                                  만족
                                </span>
                              </button>
                            </div>
                          </th>
                          <th>
                            <button
                              type="button"
                              className="adm-sat-modal-th-btn"
                              onClick={() =>
                                setModalYnFilters((prev) => ({
                                  ...prev,
                                  fiveMajorCitiesYn: nextYnFilter(prev.fiveMajorCitiesYn),
                                }))
                              }
                              aria-label={`5대도시 필터 변경 현재 ${modalYnFilters.fiveMajorCitiesYn}`}
                            >
                              <span
                                className={`adm-sat-modal-th-wrap ${filterToneClass(modalYnFilters.fiveMajorCitiesYn)}`}
                              >
                                5대도시
                              </span>
                            </button>
                          </th>
                          <th>
                            <button
                              type="button"
                              className="adm-sat-modal-th-btn"
                              onClick={() =>
                                setModalYnFilters((prev) => ({
                                  ...prev,
                                  gen5060Yn: nextYnFilter(prev.gen5060Yn),
                                }))
                              }
                              aria-label={`5060 필터 변경 현재 ${modalYnFilters.gen5060Yn}`}
                            >
                              <span
                                className={`adm-sat-modal-th-wrap ${filterToneClass(modalYnFilters.gen5060Yn)}`}
                              >
                                5060
                              </span>
                            </button>
                          </th>
                          <th>
                            <button
                              type="button"
                              className="adm-sat-modal-th-btn"
                              onClick={() =>
                                setModalYnFilters((prev) => ({
                                  ...prev,
                                  problemResolvedYn: nextYnFilter(prev.problemResolvedYn),
                                }))
                              }
                              aria-label={`문제해결 필터 변경 현재 ${modalYnFilters.problemResolvedYn}`}
                            >
                              <span
                                className={`adm-sat-modal-th-wrap ${filterToneClass(modalYnFilters.problemResolvedYn)}`}
                              >
                                문제해결
                              </span>
                            </button>
                          </th>
                          <th><span className="adm-sat-modal-th-wrap">Good 멘트</span></th>
                          <th><span className="adm-sat-modal-th-wrap">Bad 멘트</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalPagedRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="adm-table-empty">
                              선택한 조건에 맞는 접수 row가 없습니다.
                            </td>
                          </tr>
                        ) : (
                          modalPagedRows.map((row) => (
                            <tr key={row.id}>
                              <td className="adm-sat-modal-cell-dt">{formatDateTime(row.consultDateTime)}</td>
                              <td className="adm-sat-modal-cell-type">
                                {[row.consultType1, row.consultType2, row.consultType3]
                                  .filter((v) => String(v ?? '').trim() !== '')
                                  .join(' / ') || '—'}
                              </td>
                              <td><span className={`adm-sat-yn-chip ${ynClass(row.satisfiedYn)}`}>{yesNo(row.satisfiedYn)}</span></td>
                              <td><span className={`adm-sat-yn-chip ${ynClass(row.fiveMajorCitiesYn)}`}>{yesNo(row.fiveMajorCitiesYn)}</span></td>
                              <td><span className={`adm-sat-yn-chip ${ynClass(row.gen5060Yn)}`}>{yesNo(row.gen5060Yn)}</span></td>
                              <td><span className={`adm-sat-yn-chip ${ynClass(row.problemResolvedYn)}`}>{yesNo(row.problemResolvedYn)}</span></td>
                              <td className="adm-sat-modal-cell-ment">{row.goodMent?.trim() ? row.goodMent : '—'}</td>
                              <td className="adm-sat-modal-cell-ment">{row.badMent?.trim() ? row.badMent : '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="adm-sat-modal-pagination">
                    <button
                      type="button"
                      className="adm-sat-modal-page-btn"
                      onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                      disabled={modalPage <= 1}
                    >
                      이전
                    </button>
                    <span className="adm-sat-modal-page-label">
                      {modalPage} / {modalTotalPages}
                    </span>
                    <button
                      type="button"
                      className="adm-sat-modal-page-btn"
                      onClick={() => setModalPage((p) => Math.min(modalTotalPages, p + 1))}
                      disabled={modalPage >= modalTotalPages}
                    >
                      다음
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {excludeModalOpen && (
        <div className="adm-sat-exclude-backdrop" onClick={closeExcludeModal} role="presentation">
          <section
            className="adm-sat-exclude-modal"
            role="dialog"
            aria-modal="true"
            aria-label="평가 제외 설정"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="adm-sat-exclude-head">
              <h3>평가 제외</h3>
              <button
                type="button"
                className="adm-sat-row-modal-close"
                onClick={closeExcludeModal}
                aria-label="평가 제외 닫기"
              >
                <X size={18} aria-hidden />
              </button>
            </header>
            <div className="adm-sat-exclude-body">
              <div className="adm-sat-exclude-grid adm-sat-exclude-grid--range">
                <label className="adm-sat-exclude-field adm-sat-exclude-field--full">
                  <span>스킬</span>
                  <select
                    className="adm-dept-filter-select"
                    value={excludeSkill}
                    onChange={(e) => {
                      setExcludeSkill(e.target.value);
                      setExcludeErr('');
                      setExcludeMsg('');
                    }}
                  >
                    {SAT_EXCLUDE_SKILLS.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="adm-sat-exclude-field">
                  <span>시작 일시</span>
                  <input
                    type="datetime-local"
                    className="adm-sat-exclude-datetime"
                    step={60}
                    value={excludeStartLocal}
                    onChange={(e) => {
                      setExcludeStartLocal(e.target.value);
                      setExcludeErr('');
                      setExcludeMsg('');
                    }}
                  />
                </label>
                <label className="adm-sat-exclude-field">
                  <span>종료 일시</span>
                  <input
                    type="datetime-local"
                    className="adm-sat-exclude-datetime"
                    step={60}
                    value={excludeEndLocal}
                    onChange={(e) => {
                      setExcludeEndLocal(e.target.value);
                      setExcludeErr('');
                      setExcludeMsg('');
                    }}
                  />
                </label>
              </div>
              {excludeErr && <p className="adm-sat-query-err adm-sat-exclude-msg">{excludeErr}</p>}
              {excludeMsg && <p className="adm-sat-exclude-msg adm-sat-exclude-msg--ok">{excludeMsg}</p>}
              <div className="adm-sat-exclude-history">
                <h4 className="adm-sat-exclude-history-title">최근 평가 제외 이력</h4>
                {excludeLogQuery.isLoading ? (
                  <p className="adm-sat-exclude-history-empty">불러오는 중…</p>
                ) : excludeLogQuery.isError ? (
                  <p className="adm-sat-exclude-history-empty">이력을 불러오지 못했습니다.</p>
                ) : (excludeLogQuery.data?.entries ?? []).length === 0 ? (
                  <p className="adm-sat-exclude-history-empty">
                    저장된 이력이 없습니다. 제외를 적용하면 스킬·구간·건수가 기록됩니다.
                  </p>
                ) : (
                  <ul className="adm-sat-exclude-history-list">
                    {(excludeLogQuery.data?.entries ?? []).map((e) => (
                      <li key={e.id} className="adm-sat-exclude-history-item">
                        <span className="adm-sat-exclude-history-skill">{e.skill}</span>
                        <span className="adm-sat-exclude-history-range">
                          {formatDateTime(e.startAt)} ~ {formatDateTime(e.endAt)}
                        </span>
                        <span className="adm-sat-exclude-history-meta">
                          {num(e.updatedRowCount)}건 · {e.excludedBySkid?.trim() ? e.excludedBySkid : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="adm-sat-exclude-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={closeExcludeModal}>
                  닫기
                </button>
                {!excludeMsg ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleExcludeSubmit}
                    disabled={
                      excludeTimeMutation.isPending ||
                      !excludeSkill ||
                      !excludeStartLocal ||
                      !excludeEndLocal
                    }
                  >
                    {excludeTimeMutation.isPending ? '처리 중...' : '평가 제외 적용'}
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      )}

      <AdminSatisfactionSetupModal open={setupModalOpen} onClose={() => setSetupModalOpen(false)} />
      <AdminTargetMembersUploadModal
        open={targetUploadModalOpen}
        onClose={() => setTargetUploadModalOpen(false)}
      />
    </div>
  );
}
