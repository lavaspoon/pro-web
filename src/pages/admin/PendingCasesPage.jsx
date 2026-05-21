import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  FileText,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  fetchAdminLeafTeams,
  fetchAdminReviewQueue,
  fetchCaseForReview,
  uploadCasesMigrationExcel,
} from '../../api/adminApi';
import CaseReviewModal from './CaseReviewModal';
import CaseReviewStageBadge from '../../components/common/CaseReviewStageBadge';
import { formatCaseCallDateMmDdHm, formatSubmittedDateMmDd } from '../../utils/caseDisplay';
import {
  CASE_STAGE_FILTERS,
  caseMatchesStageFilter,
  countCasesByStageFilter,
  getCaseReviewStage,
} from '../../utils/caseReviewStage';
import { mergeSecondDepthOptions } from '../../utils/adminSecondDepth';
import {
  buildTeamHierarchyMeta,
  buildTeamHierarchyPath,
  compareTeamHierarchy,
} from '../../utils/teamHierarchy';
import './DashboardPage.css';
import './PendingCasesPage.css';
import '../../pages/member/CaseListPage.css';

function SortGlyph({ active, direction }) {
  if (!active) {
    return <ArrowUpDown size={11} className="pending-sort-ico pending-sort-ico--idle" aria-hidden />;
  }
  return direction === 'asc' ? (
    <ArrowUp size={11} className="pending-sort-ico pending-sort-ico--active" aria-hidden />
  ) : (
    <ArrowDown size={11} className="pending-sort-ico pending-sort-ico--active" aria-hidden />
  );
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function caseMonthKey(c) {
  const raw = c.month || c.submittedAt || '';
  if (typeof raw === 'string' && raw.length >= 7) return raw.slice(0, 7);
  return '';
}

function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthBarLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${y}년 ${m}월`;
}

/** leaf 팀 목록에서 구성원 skid 집합 */
function collectSkidsFromLeafTeams(teams) {
  const s = new Set();
  for (const t of teams ?? []) {
    for (const m of t.members ?? []) {
      if (m.id) s.add(m.id);
    }
  }
  return s;
}

export default function PendingCasesPage() {
  const [reviewCase, setReviewCase] = useState(null);
  const [selectedTeamKey, setSelectedTeamKey] = useState(null);
  const [loadingCaseId, setLoadingCaseId] = useState(null);
  /** 'all' | 2depth dept_id 문자열 (대시보드와 동일) */
  const [secondDepthKey, setSecondDepthKey] = useState('all');
  /** 접수월 yyyy-MM */
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [tableSort, setTableSort] = useState({ key: 'submitted', direction: 'asc' });
  /** 전체 | 대기 | 1차완료 | 2차완료 */
  const [stageFilter, setStageFilter] = useState('waiting');
  const migrateFileRef = useRef(null);
  const [migratePending, setMigratePending] = useState(false);
  const [migrateMessage, setMigrateMessage] = useState('');

  const migrationYear = new Date().getFullYear();
  const MIGRATION_FROM_MONTH = 1;
  const MIGRATION_TO_MONTH = 4;

  const { data: queue, isLoading: queueLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-review-queue'],
    queryFn: fetchAdminReviewQueue,
  });

  const allCasesRaw = useMemo(() => queue?.allCases ?? queue?.pendingCases ?? [], [queue?.allCases, queue?.pendingCases]);

  const filterMeta = queue?.filterMeta ?? queue?.dashboard?.filterMeta;
  const secondDepthOptions = useMemo(
    () => mergeSecondDepthOptions(filterMeta?.secondDepthDepts),
    [filterMeta?.secondDepthDepts]
  );

  /** 선택한 2depth에 맞는 leaf 팀 목록 (사이드바) — review-queue와 병렬 로드 */
  const { data: leafPayload, isLoading: leafTeamsLoading } = useQuery({
    queryKey: ['admin-leaf-teams', secondDepthKey],
    queryFn: () =>
      fetchAdminLeafTeams(secondDepthKey === 'all' ? null : Number(secondDepthKey)),
  });

  /** 상단 카드 — API가 센터별 대기 건수를 한 번에 반환 (leaf-teams N회 호출 제거) */
  const pendingByCenter = useMemo(() => {
    const centers = (queue?.pendingByCenter ?? []).map((c) => ({
      id: c.secondDepthDeptId,
      name: c.centerName,
      count: Number(c.pendingCount ?? 0),
    }));
    return {
      totalAll: Number(queue?.totalPendingCount ?? queue?.pendingCases?.length ?? 0),
      centers,
    };
  }, [queue?.pendingByCenter, queue?.totalPendingCount, queue?.pendingCases?.length]);

  const teamsInScope = useMemo(() => leafPayload?.teams ?? [], [leafPayload?.teams]);

  const casesScopedByDept = useMemo(() => {
    if (secondDepthKey === 'all') return allCasesRaw;
    const skidSet = collectSkidsFromLeafTeams(teamsInScope);
    return allCasesRaw.filter((c) => skidSet.has(c.skid));
  }, [allCasesRaw, secondDepthKey, teamsInScope]);

  const { minMonthKey, maxMonthKey } = useMemo(() => {
    const max = currentMonthKey();
    const keys = casesScopedByDept.map(caseMonthKey).filter(Boolean);
    const earliest = keys.length ? [...keys].sort()[0] : max;
    const minWindow = addMonths(max, -36);
    const min = earliest < minWindow ? earliest : minWindow;
    return { minMonthKey: min, maxMonthKey: max };
  }, [casesScopedByDept]);

  const canPrevMonth = monthKey > minMonthKey;
  const canNextMonth = monthKey < maxMonthKey;

  const casesInMonth = useMemo(
    () => casesScopedByDept.filter((c) => caseMonthKey(c) === monthKey),
    [casesScopedByDept, monthKey],
  );

  const casesForTable = useMemo(
    () => casesInMonth.filter((c) => caseMatchesStageFilter(c, stageFilter)),
    [casesInMonth, stageFilter],
  );

  const stageFilterCounts = useMemo(() => {
    const counts = {};
    for (const { key } of CASE_STAGE_FILTERS) {
      counts[key] = countCasesByStageFilter(casesInMonth, key);
    }
    return counts;
  }, [casesInMonth]);

  const skidToTeamHierarchy = useMemo(() => {
    const map = new Map();
    for (const t of teamsInScope) {
      const info = {
        centerName: t.centerName ?? '',
        groupName: t.groupName ?? '',
        teamName: t.name ?? '',
        hierarchyPath: buildTeamHierarchyPath({
          centerName: t.centerName,
          groupName: t.groupName,
          teamName: t.name,
        }),
        hierarchyMeta: buildTeamHierarchyMeta({
          centerName: t.centerName,
          groupName: t.groupName,
        }),
      };
      for (const m of t.members ?? []) {
        if (m?.id) map.set(m.id, info);
      }
    }
    return map;
  }, [teamsInScope]);

  const teamRows = useMemo(() => {
    const rows = teamsInScope.map((t) => {
      const skids = new Set((t.members ?? []).map((m) => m.id));
      const monthTeamCases = casesInMonth.filter((c) => skids.has(c.skid));
      const list = monthTeamCases.filter((c) => caseMatchesStageFilter(c, stageFilter));
      const pendingCount = monthTeamCases.filter((c) => getCaseReviewStage(c) === 'waiting').length;
      const teamName = t.name ?? '';
      return {
        key: `leaf-${t.id}`,
        teamName,
        centerName: t.centerName ?? '',
        groupName: t.groupName ?? '',
        hierarchyPath: buildTeamHierarchyPath({
          centerName: t.centerName,
          groupName: t.groupName,
          teamName,
        }),
        hierarchyMeta: buildTeamHierarchyMeta({
          centerName: t.centerName,
          groupName: t.groupName,
        }),
        deptId: t.id,
        pendingCount,
        judgedCount: Number(t.judgedCount ?? 0),
        cases: list,
      };
    });
    rows.sort(compareTeamHierarchy);
    return rows;
  }, [teamsInScope, casesInMonth, stageFilter]);

  /** 범위·팀 목록이 바뀌면: 전체 보기(null) 유지, 또는 선택 팀이 없어지면 전체로 복귀 */
  useEffect(() => {
    if (teamRows.length === 0) {
      setSelectedTeamKey(null);
      return;
    }
    setSelectedTeamKey((prev) => {
      if (prev == null) return null;
      return teamRows.some((r) => r.key === prev) ? prev : null;
    });
  }, [teamRows]);

  /** 팀·월이 바뀌면 정렬을 접수일 오름차순으로 초기화 */
  useEffect(() => {
    setTableSort({ key: 'submitted', direction: 'asc' });
  }, [selectedTeamKey, monthKey, stageFilter]);

  const selectedTeam = useMemo(
    () => teamRows.find((r) => r.key === selectedTeamKey) ?? null,
    [teamRows, selectedTeamKey]
  );

  /** null = 범위 내 전체 팀 (상단 '범위' 셀렉트와 동일 스코프) */
  const isAllTeamsView = selectedTeamKey == null;

  const sortedCases = useMemo(() => {
    const raw = isAllTeamsView ? casesForTable : (selectedTeam?.cases ?? []);
    const list = [...raw];
    const { key, direction } = tableSort;
    const mul = direction === 'asc' ? 1 : -1;
    const statusOrder = (x) => {
      const stage = getCaseReviewStage(x);
      if (stage === 'waiting') return 0;
      if (stage === 'phase1') return 1;
      if (stage === 'phase2') {
        return String(x.status || '').toLowerCase() === 'selected' ? 2 : 3;
      }
      return 4;
    };
    list.sort((a, b) => {
      if (key === 'status') {
        const d = statusOrder(a) - statusOrder(b);
        if (d !== 0) return d * mul;
        return (a.id ?? 0) - (b.id ?? 0);
      }
      if (key === 'team') {
        const ta =
          skidToTeamHierarchy.get(a.skid)?.hierarchyPath ||
          (a.teamName && String(a.teamName).trim()) ||
          '미지정';
        const tb =
          skidToTeamHierarchy.get(b.skid)?.hierarchyPath ||
          (b.teamName && String(b.teamName).trim()) ||
          '미지정';
        return ta.localeCompare(tb, 'ko') * mul;
      }
      if (key === 'member') {
        return (a.memberName || '').localeCompare(b.memberName || '', 'ko') * mul;
      }
      if (key === 'submitted') {
        const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return (ta - tb) * mul;
      }
      if (key === 'callDate') {
        const ta = a.callDate ? new Date(a.callDate).getTime() : NaN;
        const tb = b.callDate ? new Date(b.callDate).getTime() : NaN;
        const na = Number.isNaN(ta);
        const nb = Number.isNaN(tb);
        if (na && nb) return 0;
        if (na) return 1 * mul;
        if (nb) return -1 * mul;
        return (ta - tb) * mul;
      }
      return 0;
    });
    return list;
  }, [isAllTeamsView, casesForTable, selectedTeam?.cases, tableSort, skidToTeamHierarchy]);

  const toggleSort = useCallback((key) => {
    setTableSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const handleMigrationFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setMigratePending(true);
      setMigrateMessage('');
      try {
        const res = await uploadCasesMigrationExcel(file, {
          year: migrationYear,
          fromMonth: MIGRATION_FROM_MONTH,
          toMonth: MIGRATION_TO_MONTH,
        });
        const rows = res.parsedRowCount ?? 0;
        const skipped = res.skippedRows ?? 0;
        setMigrateMessage(
          `${res.message ?? '파싱 완료'} (${migrationYear}년 ${MIGRATION_FROM_MONTH}~${MIGRATION_TO_MONTH}월 · 데이터 ${rows}행, 빈행 제외 ${skipped}건)`
        );
        refetch();
      } catch (err) {
        setMigrateMessage(err.message || '업로드에 실패했습니다.');
      } finally {
        setMigratePending(false);
      }
    },
    [migrationYear, refetch]
  );

  const openReview = useCallback(async (c) => {
    setLoadingCaseId(c.id);
    try {
      const full = await fetchCaseForReview(c.id);
      setReviewCase(full);
    } catch {
      setReviewCase(c);
    } finally {
      setLoadingCaseId(null);
    }
  }, []);

  if (queueLoading) {
    return (
      <div className="page-container adm-dashboard adm-dashboard--yp">
        <div className="loading-screen">
          <div className="spinner" />
          <p>접수 목록을 불러오는 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in pending-page">
      <header className="adm-header adm-header--yp pending-header">
        <Link
          to="/admin"
          className="adm-back-btn pending-header-back"
          aria-label="대시보드로 돌아가기"
        >
          <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
          <span>뒤로</span>
        </Link>
        <div className="adm-header-row pending-header-row">
          <div className="pending-header-body">
            <div className="adm-header-text">
              <p className="adm-identity-kicker">YOU PRO · 심사</p>
              <h1 className="adm-title">접수 현황</h1>
            </div>
            <div className="pending-header-actions">
              <input
                ref={migrateFileRef}
                type="file"
                className="pending-migrate-input"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleMigrationFile}
                aria-hidden
                tabIndex={-1}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm pending-migrate-btn"
                onClick={() => migrateFileRef.current?.click()}
                disabled={migratePending}
                title={`${migrationYear}년 1~4월 접수 엑셀 업로드 (양식 확정 전 · DB 미반영)`}
              >
                <Upload size={14} aria-hidden />
                {migratePending ? '업로드 중…' : '1~4월 엑셀 마이그레이션 (임시)'}
              </button>
              <div className="pending-header-stats" role="group" aria-label="센터별 검토 대기 건수">
                <div
                  className="pending-header-stat pending-header-stat--card pending-header-stat--total"
                  role="status"
                  aria-label={`전체 대기 ${pendingByCenter.totalAll}건`}
                >
                  <span className="pending-header-stat-label">전체 대기 건수</span>
                  <div className="pending-header-stat-figure">
                    <span className="pending-header-stat-value">{pendingByCenter.totalAll}</span>
                    <span className="pending-header-stat-unit">건</span>
                  </div>
                </div>
                {pendingByCenter.centers.map((c, idx) => (
                  <div
                    key={c.id}
                    className={`pending-header-stat pending-header-stat--card pending-header-stat--${
                      idx % 2 === 0 ? 'd5' : 'd7'
                    }`}
                    role="status"
                    aria-label={`${c.name} 대기 ${c.count}건`}
                  >
                    <span className="pending-header-stat-label" title={c.name}>
                        {c.name ? `${c.name.slice(0, 4)} 대기 건수` : ''}
                    </span>
                    <div className="pending-header-stat-figure">
                      <span className="pending-header-stat-value">{c.count}</span>
                      <span className="pending-header-stat-unit">건</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {migrateMessage ? (
              <p className="pending-migrate-msg" role="status">
                {migrateMessage}
              </p>
            ) : null}
            </div>
          </div>
      </header>

      {leafTeamsLoading ? (
        <div className="pending-split pending-split--yp pending-split--loading">
          <aside className="pending-tree pending-tree--skeleton" aria-hidden>
            <div className="loading-screen" style={{ minHeight: '12rem' }}>
              <div className="spinner" />
              <p>팀 목록을 불러오는 중…</p>
            </div>
          </aside>
          <main className="pending-panel pending-panel--skeleton" aria-hidden />
        </div>
      ) : teamsInScope.length === 0 && secondDepthKey !== 'all' ? (
        <div className="empty-state pending-empty-scope">
          <FileText size={40} className="empty-icon" />
          <h3>선택한 2depth 하위에 leaf 팀이 없습니다</h3>
          <p className="pending-empty-scope-hint">
            범위를 <strong>전체</strong>로 바꾸면 다른 팀의 대기 건도 볼 수 있어요.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSecondDepthKey('all')}>
            전체로 보기
          </button>
        </div>
      ) : teamRows.length === 0 ? (
        <div className="empty-state">
          <FileText size={40} className="empty-icon" />
          <h3>등록된 팀이 없습니다</h3>
        </div>
      ) : (
        <div className="pending-split pending-split--yp">
          <aside className="pending-tree" aria-label="팀 선택">
            <div className="tree-root pending-tree__root">
              <div className="pending-scope-filter">
                <label className="pending-scope-label" htmlFor="pending-scope-select">
                  범위
                </label>
                <div className="pending-scope-select-wrap">
                  <select
                    id="pending-scope-select"
                    className="pending-scope-select"
                    value={secondDepthKey}
                    onChange={(e) => setSecondDepthKey(e.target.value)}
                    aria-label="2depth 센터 범위"
                  >
                    <option value="all">전체 센터</option>
                    {secondDepthOptions.map((o) => (
                      <option key={o.id} value={String(o.id)}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pending-scope-chevron" aria-hidden />
                </div>
              </div>
              <ul className="tree-list">
                {teamRows.map((row, idx) => {
                  const isLast = idx === teamRows.length - 1;
                  const active = selectedTeamKey === row.key;
                  return (
                    <li
                      key={row.key}
                      className={`tree-item ${isLast ? 'tree-item--last' : ''}`}
                    >
                      <button
                        type="button"
                        className={`tree-leaf ${active ? 'is-active' : ''}`}
                        onClick={() =>
                          setSelectedTeamKey((prev) => (prev === row.key ? null : row.key))
                        }
                        aria-pressed={active}
                      >
                        <span className="tree-leaf-main">
                          <span className="tree-leaf-text">
                            {row.hierarchyMeta ? (
                              <span className="tree-leaf-path" title={row.hierarchyPath}>
                                {row.hierarchyMeta}
                              </span>
                            ) : null}
                            <span className="tree-leaf-name" title={row.hierarchyPath}>
                              {row.teamName}
                            </span>
                          </span>
                          <span className="tree-leaf-stats">
                            <span className="tree-stat tree-stat--wait">대기 {row.pendingCount}</span>
                          </span>
                        </span>
                        <ChevronRight size={14} className="tree-leaf-chevron" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          <main className="pending-panel">
            {isAllTeamsView || selectedTeam ? (
              <>
                <div className="pending-panel-head">
                  <div className="pending-panel-head-row">
                    <div className="pending-panel-head-text">
                      <span className="pending-panel-title-bar" aria-hidden />
                      <h2 className="pending-panel-title">
                        {isAllTeamsView ? '사례 목록' : selectedTeam.hierarchyPath}
                      </h2>
                    </div>
                    <div className="pending-panel-head-right">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm pending-refresh-btn pending-panel-refresh"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        title="목록을 다시 불러옵니다"
                      >
                        <RefreshCw size={14} className={isFetching ? 'pending-refresh-spin' : ''} aria-hidden />
                        새로고침
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pending-table-wrap">
                  <div className="pending-table-toolbar">
                    <div className="pending-stage-filters" role="tablist" aria-label="검증 단계 필터">
                      {CASE_STAGE_FILTERS.map(({ key, label }) => {
                        const active = stageFilter === key;
                        const count = stageFilterCounts[key] ?? 0;
                        return (
                          <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`pending-stage-filter${active ? ' is-active' : ''}`}
                            onClick={() => setStageFilter(key)}
                          >
                            {label}
                            <span className="pending-stage-filter__count">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="pending-table-toolbar-month" role="group" aria-label="접수 월 이동">
                      <button
                        type="button"
                        className="pending-month-nav-btn"
                        disabled={!canPrevMonth}
                        onClick={() => setMonthKey((k) => addMonths(k, -1))}
                        aria-label="이전 달"
                      >
                        <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
                      </button>
                      <span className="pending-month-nav-label">{formatMonthBarLabel(monthKey)}</span>
                      <button
                        type="button"
                        className="pending-month-nav-btn"
                        disabled={!canNextMonth}
                        onClick={() => setMonthKey((k) => addMonths(k, 1))}
                        aria-label="다음 달"
                      >
                        <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
                      </button>
                    </div>
                  </div>

                  {(isAllTeamsView ? casesForTable.length === 0 : selectedTeam.cases.length === 0) ? (
                    <div className="pending-panel-empty pending-panel-empty--in-table">
                      <div className="pending-panel-empty-visual" aria-hidden>
                        <Clock size={36} strokeWidth={1.75} />
                      </div>
                      <p className="pending-panel-empty-title">
                        {casesInMonth.length === 0
                          ? `${formatMonthBarLabel(monthKey)} 접수 건이 없습니다`
                          : `${CASE_STAGE_FILTERS.find((f) => f.key === stageFilter)?.label ?? ''} 건이 없습니다`}
                      </p>
                      <p className="pending-panel-empty-hint">
                        {casesInMonth.length === 0
                          ? '위에서 다른 월로 이동하거나 새 접수를 기다려 주세요.'
                          : '다른 단계 필터를 선택하거나 월을 변경해 보세요.'}
                      </p>
                    </div>
                  ) : (
                    <table className="pending-table pending-table--compact pending-table--with-team pending-table--center">
                      <thead>
                        <tr>
                          <th
                            scope="col"
                            className="pending-th pending-th--status"
                            aria-sort={
                              tableSort.key === 'status'
                                ? tableSort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                          >
                            <button
                              type="button"
                              className="pending-th-btn"
                              onClick={() => toggleSort('status')}
                              aria-label="상태 기준 정렬"
                            >
                              <span>상태</span>
                              <SortGlyph active={tableSort.key === 'status'} direction={tableSort.direction} />
                            </button>
                          </th>
                          <th
                            scope="col"
                            className="pending-th pending-th--team"
                            aria-sort={
                              tableSort.key === 'team'
                                ? tableSort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                          >
                            <button
                              type="button"
                              className="pending-th-btn"
                              onClick={() => toggleSort('team')}
                              aria-label="팀 기준 정렬"
                            >
                              <span>팀</span>
                              <SortGlyph active={tableSort.key === 'team'} direction={tableSort.direction} />
                            </button>
                          </th>
                          <th
                            scope="col"
                            className="pending-th pending-th--member"
                            aria-sort={
                              tableSort.key === 'member'
                                ? tableSort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                          >
                            <button
                              type="button"
                              className="pending-th-btn"
                              onClick={() => toggleSort('member')}
                              aria-label="구성원 기준 정렬"
                            >
                              <span>구성원</span>
                              <SortGlyph active={tableSort.key === 'member'} direction={tableSort.direction} />
                            </button>
                          </th>
                          <th
                            scope="col"
                            className="pending-th pending-th--date"
                            aria-sort={
                              tableSort.key === 'submitted'
                                ? tableSort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                          >
                            <button
                              type="button"
                              className="pending-th-btn"
                              onClick={() => toggleSort('submitted')}
                              aria-label="접수일자 기준 정렬"
                            >
                              <span>접수일자</span>
                              <SortGlyph active={tableSort.key === 'submitted'} direction={tableSort.direction} />
                            </button>
                          </th>
                          <th
                            scope="col"
                            className="pending-th pending-th--callDate"
                            aria-sort={
                              tableSort.key === 'callDate'
                                ? tableSort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                          >
                            <button
                              type="button"
                              className="pending-th-btn"
                              onClick={() => toggleSort('callDate')}
                              aria-label="상담일자 기준 정렬"
                            >
                              <span>상담일자</span>
                              <SortGlyph active={tableSort.key === 'callDate'} direction={tableSort.direction} />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCases.map((c) => (
                          <tr
                            key={c.id}
                            className="pending-table-row--clickable"
                            onClick={() => {
                              if (loadingCaseId === c.id) return;
                              openReview(c);
                            }}
                          >
                            <td className="pending-td-status">
                              <CaseReviewStageBadge caseItem={c} size="sm" />
                            </td>
                            <td className="pending-td-team">
                              {(() => {
                                const hier = skidToTeamHierarchy.get(c.skid);
                                const path =
                                  hier?.hierarchyPath ||
                                  (c.teamName && String(c.teamName).trim()) ||
                                  '미지정';
                                return (
                                  <span className="pending-td-team-wrap pending-td-team-wrap--one-line" title={path}>
                                    <span className="pending-td-team-text">{path}</span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="pending-td-member">
                              <span className="pending-td-name">{c.memberName}</span>
                            </td>
                            <td className="pending-td-date">
                              <span className="pending-td-date-val">
                                {formatSubmittedDateMmDd(c.submittedAt)}
                              </span>
                            </td>
                            <td className="pending-td-call">
                              <span className="pending-td-call-val">
                                {formatCaseCallDateMmDdHm(c.callDate)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : null}
          </main>
        </div>
      )}

      {reviewCase && (
        <CaseReviewModal
          caseData={reviewCase}
          memberName={reviewCase.memberName}
          deptHierarchy={skidToTeamHierarchy.get(reviewCase.skid)?.hierarchyPath}
          onClose={() => setReviewCase(null)}
          onRefreshCase={async () => {
            const full = await fetchCaseForReview(reviewCase.id);
            setReviewCase(full);
          }}
        />
      )}
    </div>
  );
}
