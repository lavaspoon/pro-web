import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  LayoutGrid,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { fetchAdminReviewQueue, fetchCaseForReview } from '../../api/adminApi';
import CaseReviewModal from './CaseReviewModal';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import './DashboardPage.css';
import './PendingCasesPage.css';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  return `${diff}일 전`;
}

function formatCaseStatus(status) {
  const s = (status && String(status).toLowerCase()) || '';
  if (s === 'pending') return '검토대기';
  if (s === 'selected') return '선정';
  if (s === 'rejected') return '비선정';
  return status ? String(status) : '—';
}

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

const ALL_TEAMS_KEY = '__all__';

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

export default function PendingCasesPage() {
  const navigate = useNavigate();
  const [reviewCase, setReviewCase] = useState(null);
  const [selectedTeamKey, setSelectedTeamKey] = useState(null);
  const [loadingCaseId, setLoadingCaseId] = useState(null);
  /** 'all' — 전체 | 'dept5'·'dept7' — 해당 부서만 */
  const [deptFilter, setDeptFilter] = useState('all');
  /** 테이블 상태 필터: 기본 대기만, 클릭 시 전체(선정·비선정 포함) */
  const [statusFilter, setStatusFilter] = useState('pending');
  /** 접수월 yyyy-MM */
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [tableSort, setTableSort] = useState({ key: 'submitted', direction: 'asc' });

  const { data: queue, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-review-queue'],
    queryFn: fetchAdminReviewQueue,
  });

  const dashboard = queue?.dashboard;
  const allCasesRaw = useMemo(() => queue?.allCases ?? queue?.pendingCases ?? [], [queue?.allCases, queue?.pendingCases]);

  /** 상단 카드용 — 스코프 내 전체 대기 및 부서 ID 5·7(센터)별 대기 건수 */
  const pendingByCenter = useMemo(() => {
    const teams = dashboard?.teams ?? [];
    const pendingOnly = allCasesRaw.filter((c) => String(c.status || '').toLowerCase() === 'pending');
    const teamNameForDept = (deptId) => {
      const t = teams.find((x) => Number(x.id) === deptId);
      return t?.name ? String(t.name).trim() : null;
    };
    const countForTeamName = (teamName) => {
      if (!teamName) return 0;
      return pendingOnly.filter((c) => (c.teamName && String(c.teamName).trim()) === teamName).length;
    };
    return {
      totalAll: pendingOnly.length,
      dept5: countForTeamName(teamNameForDept(5)),
      dept7: countForTeamName(teamNameForDept(7)),
    };
  }, [allCasesRaw, dashboard?.teams]);

  const teamsInScope = useMemo(() => {
    const all = dashboard?.teams ?? [];
    if (deptFilter === 'all') return all;
    if (deptFilter === 'dept5') {
      const t = all.find((x) => Number(x.id) === 5);
      return t ? [t] : [];
    }
    if (deptFilter === 'dept7') {
      const t = all.find((x) => Number(x.id) === 7);
      return t ? [t] : [];
    }
    return [];
  }, [dashboard?.teams, deptFilter]);

  const casesScopedByDept = useMemo(() => {
    if (deptFilter === 'all') return allCasesRaw;
    const allowed = new Set(teamsInScope.map((t) => t.name));
    return allCasesRaw.filter((c) => allowed.has((c.teamName && String(c.teamName).trim()) || ''));
  }, [allCasesRaw, deptFilter, teamsInScope]);

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

  const casesForTable = useMemo(() => {
    if (statusFilter === 'all') return casesInMonth;
    return casesInMonth.filter((c) => String(c.status || '').toLowerCase() === 'pending');
  }, [casesInMonth, statusFilter]);

  const teamRows = useMemo(() => {
    const teams = teamsInScope;
    const pendingMap = new Map();
    for (const c of casesForTable) {
      const key = (c.teamName && String(c.teamName).trim()) || '미지정';
      if (!pendingMap.has(key)) pendingMap.set(key, []);
      pendingMap.get(key).push(c);
    }
    const dashboardNames = new Set(teams.map((t) => t.name));

    const rows = teams.map((t) => ({
      key: `dept-${t.id}`,
      teamName: t.name,
      deptId: t.id,
      pendingCount: Number(t.pendingCount ?? 0),
      judgedCount: Number(t.judgedCount ?? 0),
      cases: pendingMap.get(t.name) || [],
    }));

    if (deptFilter === 'all') {
      for (const [name, list] of pendingMap) {
        if (!dashboardNames.has(name)) {
          const pendingOnly = casesScopedByDept.filter(
            (c) =>
              String(c.status || '').toLowerCase() === 'pending' &&
              (c.teamName && String(c.teamName).trim()) === name
          ).length;
          rows.push({
            key: `orphan-${name}`,
            teamName: name,
            deptId: null,
            pendingCount: pendingOnly,
            judgedCount: 0,
            cases: list,
          });
        }
      }
    }

    rows.sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko'));
    return rows;
  }, [teamsInScope, casesForTable, deptFilter, casesScopedByDept]);

  /** 데이터가 바뀌면 선택 팀 유지, 없으면 대기 있는 팀 → 첫 팀 (전체보기는 유지) */
  useEffect(() => {
    if (teamRows.length === 0) {
      setSelectedTeamKey(null);
      return;
    }
    setSelectedTeamKey((prev) => {
      if (prev === ALL_TEAMS_KEY) return ALL_TEAMS_KEY;
      if (prev != null && teamRows.some((r) => r.key === prev)) return prev;
      const firstWith = teamRows.find((r) => r.cases.length > 0);
      return firstWith?.key ?? teamRows[0].key;
    });
  }, [teamRows]);

  /** 팀·월·상태 필터가 바뀌면 정렬을 접수일 오름차순으로 초기화 */
  useEffect(() => {
    setTableSort({ key: 'submitted', direction: 'asc' });
  }, [selectedTeamKey, monthKey, statusFilter]);

  const selectedTeam = useMemo(
    () => teamRows.find((r) => r.key === selectedTeamKey) ?? null,
    [teamRows, selectedTeamKey]
  );

  const isAllTeamsView = selectedTeamKey === ALL_TEAMS_KEY;

  const tableFilteredCount = casesForTable.length;

  const sortedCases = useMemo(() => {
    const raw = isAllTeamsView ? casesForTable : (selectedTeam?.cases ?? []);
    const list = [...raw];
    const { key, direction } = tableSort;
    const mul = direction === 'asc' ? 1 : -1;
    const statusOrder = (x) => {
      const s = (x.status && String(x.status).toLowerCase()) || '';
      if (s === 'pending') return 0;
      if (s === 'selected') return 1;
      if (s === 'rejected') return 2;
      return 3;
    };
    list.sort((a, b) => {
      if (key === 'status') {
        const d = statusOrder(a) - statusOrder(b);
        if (d !== 0) return d * mul;
        return (a.id ?? 0) - (b.id ?? 0);
      }
      if (key === 'team') {
        const ta = (a.teamName && String(a.teamName).trim()) || '미지정';
        const tb = (b.teamName && String(b.teamName).trim()) || '미지정';
        return ta.localeCompare(tb, 'ko') * mul;
      }
      if (key === 'member') {
        return (a.memberName || '').localeCompare(b.memberName || '', 'ko') * mul;
      }
      if (key === 'title') {
        return (a.title || '').localeCompare(b.title || '', 'ko') * mul;
      }
      if (key === 'submitted') {
        const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return (ta - tb) * mul;
      }
      return 0;
    });
    return list;
  }, [isAllTeamsView, casesForTable, selectedTeam?.cases, tableSort]);

  const toggleSort = useCallback((key) => {
    setTableSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  }, []);

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

  if (isLoading) {
    return (
      <div className="page-container adm-dashboard adm-dashboard--yp">
        <div className="loading-screen">
          <div className="spinner" />
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in pending-page">
      <header className="adm-header adm-header--yp pending-header">
        <div className="adm-header-row pending-header-row">
          <button
            type="button"
            className="adm-back-btn"
            onClick={() => navigate('/admin')}
            aria-label="대시보드로 돌아가기"
          >
            <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
            <span>뒤로</span>
          </button>
          <div className="pending-header-body">
            <div className="adm-header-text">
              <p className="adm-identity-kicker">YOU PRO · 심사</p>
              <h1 className="adm-title">검토 대기</h1>
              <p className="adm-sub">
                기본은 <strong>부서 5·7</strong> 실만 표시합니다. 행에서 선정·비선정을 바로 처리하거나 상세로
                이동하세요.
              </p>
            </div>
            <div className="pending-header-actions">
              <div className="pending-header-stats" role="group" aria-label="센터별 검토 대기 건수">
                <div
                  className="pending-header-stat pending-header-stat--card pending-header-stat--total"
                  role="status"
                  aria-label={`전체 대기 ${pendingByCenter.totalAll}건`}
                >
                  <span className="pending-header-stat-label">전체 대기</span>
                  <div className="pending-header-stat-figure">
                    <span className="pending-header-stat-value">{pendingByCenter.totalAll}</span>
                    <span className="pending-header-stat-unit">건</span>
                  </div>
                </div>
                <div
                  className="pending-header-stat pending-header-stat--card pending-header-stat--d5"
                  role="status"
                  aria-label={`5번 센터 대기 ${pendingByCenter.dept5}건`}
                >
                  <span className="pending-header-stat-label">5번 센터 대기</span>
                  <div className="pending-header-stat-figure">
                    <span className="pending-header-stat-value">{pendingByCenter.dept5}</span>
                    <span className="pending-header-stat-unit">건</span>
                  </div>
                </div>
                <div
                  className="pending-header-stat pending-header-stat--card pending-header-stat--d7"
                  role="status"
                  aria-label={`7번 센터 대기 ${pendingByCenter.dept7}건`}
                >
                  <span className="pending-header-stat-label">7번 센터 대기</span>
                  <div className="pending-header-stat-figure">
                    <span className="pending-header-stat-value">{pendingByCenter.dept7}</span>
                    <span className="pending-header-stat-unit">건</span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
      </header>

      {teamsInScope.length === 0 && (deptFilter === 'dept5' || deptFilter === 'dept7') ? (
        <div className="empty-state pending-empty-scope">
          <FileText size={40} className="empty-icon" />
          <h3>
            {deptFilter === 'dept5' ? '5번' : '7번'} 부서가 대시보드 팀 목록에 없습니다
          </h3>
          <p className="pending-empty-scope-hint">
            범위를 <strong>전체</strong>로 바꾸면 다른 실의 대기 건도 볼 수 있어요.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeptFilter('all')}>
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
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    aria-label="검토 대기 부서 범위"
                  >
                    <option value="all">전체</option>
                    <option value="dept5">5번 부서</option>
                    <option value="dept7">7번 부서</option>
                  </select>
                  <ChevronDown size={16} className="pending-scope-chevron" aria-hidden />
                </div>
              </div>
              <button
                type="button"
                className={`tree-view-all ${isAllTeamsView ? 'is-active' : ''}`}
                onClick={() => setSelectedTeamKey(ALL_TEAMS_KEY)}
                aria-pressed={isAllTeamsView}
              >
                <LayoutGrid size={14} strokeWidth={2.2} aria-hidden />
                <span className="tree-view-all-main">
                  <span className="tree-view-all-title">전체</span>
                </span>
                <ChevronRight size={14} className="tree-leaf-chevron" aria-hidden />
              </button>
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
                        onClick={() => setSelectedTeamKey(row.key)}
                        aria-pressed={active}
                      >
                        <span className="tree-leaf-main">
                          <span className="tree-leaf-name">{row.teamName}</span>
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
                        {isAllTeamsView ? '사례 목록' : selectedTeam.teamName}
                      </h2>
                      <p className="pending-panel-sub">
                        접수월·상태 필터는 아래 테이블 상단에서 조정합니다.
                      </p>
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
                      <span className="pending-panel-badge">
                        {statusFilter === 'pending' ? '대기' : '전체'}{' '}
                        <strong>{isAllTeamsView ? tableFilteredCount : selectedTeam.cases.length}</strong>건
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pending-table-wrap">
                  <div className="pending-table-toolbar">
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
                    <div className="pending-table-toolbar-filters">
                      <label className="pending-table-toolbar-label" htmlFor="pending-status-filter">
                        상태
                      </label>
                      <div className="pending-status-select-wrap">
                        <select
                          id="pending-status-filter"
                          className="pending-status-select"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          aria-label="사례 상태 필터"
                        >
                          <option value="pending">대기</option>
                          <option value="all">전체</option>
                        </select>
                        <ChevronDown size={16} className="pending-status-select-chevron" aria-hidden />
                      </div>
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
                          : statusFilter === 'pending'
                            ? '이 달에 검토 대기 건이 없습니다'
                            : '표시할 사례가 없습니다'}
                      </p>
                      <p className="pending-panel-empty-hint">
                        {casesInMonth.length === 0
                          ? '위에서 다른 월로 이동하거나 새 접수를 기다려 주세요.'
                          : statusFilter === 'pending'
                            ? '상태 필터를 전체로 바꿔 선정·비선정 건을 확인해 보세요.'
                            : '필터·월을 조정해 보세요.'}
                      </p>
                    </div>
                  ) : (
                    <table className="pending-table pending-table--compact pending-table--with-team">
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
                            className="pending-th pending-th--title"
                            aria-sort={
                              tableSort.key === 'title'
                                ? tableSort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                          >
                            <button
                              type="button"
                              className="pending-th-btn"
                              onClick={() => toggleSort('title')}
                              aria-label="제목 기준 정렬"
                            >
                              <span>제목</span>
                              <SortGlyph active={tableSort.key === 'title'} direction={tableSort.direction} />
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
                            className="pending-th pending-th--selection"
                            aria-label="상세"
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCases.map((c) => (
                          <tr key={c.id}>
                            <td className="pending-td-status">
                              <span className="pending-td-status-pill">{formatCaseStatus(c.status)}</span>
                            </td>
                            <td className="pending-td-team">
                              <span className="pending-td-team-text" title={c.teamName || '미지정'}>
                                {(c.teamName && String(c.teamName).trim()) || '미지정'}
                              </span>
                            </td>
                            <td className="pending-td-member">
                              <span className="pending-td-avatar">{c.memberName?.[0] ?? '?'}</span>
                              <span className="pending-td-name">{c.memberName}</span>
                            </td>
                            <td className="pending-td-title">
                              <span className="pending-td-title-text">{c.title}</span>
                            </td>
                            <td className="pending-td-date">
                              <Clock size={10} className="pending-td-ico" aria-hidden />
                              {formatDate(c.submittedAt)}
                              {c.callDate && (
                                <span className="pending-td-sub">
                                  · 통화 {formatCaseCallDateTime(c.callDate)}
                                </span>
                              )}
                            </td>
                            <td className="pending-td-action pending-td-selection">
                              <button
                                type="button"
                                className="pending-qbtn pending-qbtn--detail"
                                onClick={() => openReview(c)}
                                disabled={loadingCaseId === c.id}
                              >
                                <ExternalLink size={13} aria-hidden />
                                상세
                              </button>
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
