import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  Clock,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { fetchAdminLeafTeams, fetchAdminReviewQueue, fetchCaseForReview } from '../../api/adminApi';
import CaseReviewModal from './CaseReviewModal';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import { mergeSecondDepthOptions } from '../../utils/adminSecondDepth';
import './DashboardPage.css';
import './PendingCasesPage.css';
import '../../pages/member/CaseListPage.css';

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

  const { data: queue, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-review-queue'],
    queryFn: fetchAdminReviewQueue,
  });

  const dashboard = queue?.dashboard;
  const allCasesRaw = useMemo(() => queue?.allCases ?? queue?.pendingCases ?? [], [queue?.allCases, queue?.pendingCases]);

  const filterMeta = dashboard?.filterMeta;
  const secondDepthOptions = useMemo(
    () => mergeSecondDepthOptions(filterMeta?.secondDepthDepts),
    [filterMeta?.secondDepthDepts]
  );

  /** 2depth별 leaf(4depth) 팀 — 상단 센터 통계용 (캐시 키가 사이드바와 동일하면 재사용) */
  const leafStatsQueries = useQueries({
    queries: secondDepthOptions.map((opt) => ({
      queryKey: ['admin-leaf-teams', String(opt.id)],
      queryFn: () => fetchAdminLeafTeams(opt.id),
      enabled: secondDepthOptions.length > 0,
    })),
  });

  /** 선택한 2depth에 맞는 leaf 팀 목록 (사이드바) */
  const { data: leafPayload, isLoading: leafTeamsLoading } = useQuery({
    queryKey: ['admin-leaf-teams', secondDepthKey],
    queryFn: () =>
      fetchAdminLeafTeams(secondDepthKey === 'all' ? null : Number(secondDepthKey)),
    enabled: !!queue,
  });

  /** 상단 카드 — TB_YOU_PRO_CASE 스코프 내 대기 + 2depth 센터별(하위 leaf 구성원 skid 기준) */
  const pendingByCenter = useMemo(() => {
    const pendingOnly = allCasesRaw.filter((c) => String(c.status || '').toLowerCase() === 'pending');
    const centers = secondDepthOptions.map((opt, i) => {
      const teams = leafStatsQueries[i]?.data?.teams ?? [];
      const skidSet = collectSkidsFromLeafTeams(teams);
      const count = pendingOnly.filter((c) => skidSet.has(c.skid)).length;
      return { id: opt.id, name: opt.name, count };
    });
    return {
      totalAll: pendingOnly.length,
      centers,
    };
  }, [allCasesRaw, secondDepthOptions, leafStatsQueries]);

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
    () => casesInMonth.filter((c) => String(c.status || '').toLowerCase() === 'pending'),
    [casesInMonth]
  );

  const teamRows = useMemo(() => {
    const teams = teamsInScope;
    const rows = teams.map((t) => {
      const skids = new Set((t.members ?? []).map((m) => m.id));
      const list = casesForTable.filter((c) => skids.has(c.skid));
      const pendingCount = list.filter((c) => String(c.status || '').toLowerCase() === 'pending').length;
      return {
        key: `leaf-${t.id}`,
        teamName: t.name,
        deptId: t.id,
        pendingCount,
        judgedCount: Number(t.judgedCount ?? 0),
        cases: list,
      };
    });
    rows.sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko'));
    return rows;
  }, [teamsInScope, casesForTable]);

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
  }, [selectedTeamKey, monthKey]);

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
          <div className="pending-header-body">
            <div className="adm-header-text">
              <p className="adm-identity-kicker">YOU PRO · 심사</p>
              <h1 className="adm-title">검토 대기</h1>
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
                      {c.name} 대기
                    </span>
                    <div className="pending-header-stat-figure">
                      <span className="pending-header-stat-value">{c.count}</span>
                      <span className="pending-header-stat-unit">건</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </div>
      </header>

      {leafTeamsLoading && filterMeta ? (
        <div className="loading-screen" style={{ minHeight: '40vh' }}>
          <div className="spinner" />
          <p>leaf 팀 목록을 불러오는 중…</p>
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
                      <p className="pending-panel-sub">접수 월은 아래 테이블 상단에서 선택합니다.</p>
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
                          : '이 달에 검토 대기 건이 없습니다'}
                      </p>
                      <p className="pending-panel-empty-hint">
                        {casesInMonth.length === 0
                          ? '위에서 다른 월로 이동하거나 새 접수를 기다려 주세요.'
                          : '다른 월을 선택하거나 접수를 기다려 주세요.'}
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
                              aria-label="통화일자 기준 정렬"
                            >
                              <span>통화일자</span>
                              <SortGlyph active={tableSort.key === 'callDate'} direction={tableSort.direction} />
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
                          <tr
                            key={c.id}
                            className="pending-table-row--clickable"
                            onClick={() => {
                              if (loadingCaseId === c.id) return;
                              openReview(c);
                            }}
                          >
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
                              <span className="pending-td-date-val">{formatDate(c.submittedAt)}</span>
                            </td>
                            <td className="pending-td-call">
                              <span className="pending-td-call-val">
                                {c.callDate ? formatCaseCallDateTime(c.callDate) : '—'}
                              </span>
                            </td>
                            <td className="pending-td-action pending-td-selection">
                              <button
                                type="button"
                                className="pending-qbtn pending-qbtn--detail"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReview(c);
                                }}
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
