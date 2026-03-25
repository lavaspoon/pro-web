import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  FileText,
  Building2,
  CheckCircle2,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  LayoutGrid,
} from 'lucide-react';
import { fetchAllPendingCases, fetchCaseForReview, fetchAdminDashboard } from '../../api/adminApi';
import CaseReviewModal from './CaseReviewModal';
import { formatCaseCallDateTime } from '../../utils/caseDisplay';
import './PendingCasesPage.css';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  return `${diff}일 전`;
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

export default function PendingCasesPage() {
  const [reviewCase, setReviewCase] = useState(null);
  const [selectedTeamKey, setSelectedTeamKey] = useState(null);
  const [loadingCaseId, setLoadingCaseId] = useState(null);
  const [tableSort, setTableSort] = useState({ key: 'submitted', direction: 'asc' });

  const { data: dashboard, isLoading: loadingDash } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchAdminDashboard,
  });

  const { data: cases = [], isLoading: loadingCases } = useQuery({
    queryKey: ['pending-cases'],
    queryFn: fetchAllPendingCases,
  });

  const isLoading = loadingDash || loadingCases;

  const teamRows = useMemo(() => {
    const teams = dashboard?.teams ?? [];
    const pendingMap = new Map();
    for (const c of cases) {
      const key = (c.teamName && String(c.teamName).trim()) || '미지정';
      if (!pendingMap.has(key)) pendingMap.set(key, []);
      pendingMap.get(key).push(c);
    }
    const dashboardNames = new Set(teams.map((t) => t.name));

    const rows = teams.map((t) => ({
      key: `dept-${t.id}`,
      teamName: t.name,
      pendingCount: Number(t.pendingCount ?? 0),
      judgedCount: Number(t.judgedCount ?? 0),
      cases: pendingMap.get(t.name) || [],
    }));

    for (const [name, list] of pendingMap) {
      if (!dashboardNames.has(name)) {
        rows.push({
          key: `orphan-${name}`,
          teamName: name,
          pendingCount: list.length,
          judgedCount: 0,
          cases: list,
        });
      }
    }

    rows.sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko'));
    return rows;
  }, [dashboard, cases]);

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

  /** 팀 바뀌면 접수일 오름차순(오래된 것 먼저)으로 초기화 */
  useEffect(() => {
    setTableSort({ key: 'submitted', direction: 'asc' });
  }, [selectedTeamKey]);

  const selectedTeam = useMemo(
    () => teamRows.find((r) => r.key === selectedTeamKey) ?? null,
    [teamRows, selectedTeamKey]
  );

  const isAllTeamsView = selectedTeamKey === ALL_TEAMS_KEY;

  const totalPending = cases.length;
  const yearLabel = dashboard?.year ?? new Date().getFullYear();

  const sortedCases = useMemo(() => {
    const raw = isAllTeamsView ? cases : (selectedTeam?.cases ?? []);
    const list = [...raw];
    const { key, direction } = tableSort;
    const mul = direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
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
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return (ta - tb) * mul;
    });
    return list;
  }, [isAllTeamsView, cases, selectedTeam?.cases, tableSort]);

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
      <div className="page-container">
        <div className="loading-screen">
          <div className="spinner" />
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in pending-page">
      <header className="pending-topbar">
        <div>
          <h1 className="page-title">검토 대기</h1>
          <p className="page-sub">
            전체 대기 <strong>{totalPending}</strong>건 · {yearLabel}년 완료는 팀 트리에 표시
          </p>
        </div>
      </header>

      {teamRows.length === 0 ? (
        <div className="empty-state">
          <FileText size={40} className="empty-icon" />
          <h3>등록된 팀이 없습니다</h3>
        </div>
      ) : (
        <div className="pending-split">
          <aside className="pending-tree" aria-label="팀 선택">
            <div className="tree-root">
              <div className="tree-root-label">
                <Building2 size={14} strokeWidth={2.2} aria-hidden />
                실(부서)
                <span className="tree-root-meta">{teamRows.length}팀</span>
              </div>
              <button
                type="button"
                className={`tree-view-all ${isAllTeamsView ? 'is-active' : ''}`}
                onClick={() => setSelectedTeamKey(ALL_TEAMS_KEY)}
                aria-pressed={isAllTeamsView}
              >
                <LayoutGrid size={14} strokeWidth={2.2} aria-hidden />
                <span className="tree-view-all-main">
                  <span className="tree-view-all-title">전체 보기</span>
                  <span className="tree-view-all-meta">대기 {totalPending}건 한눈에</span>
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
                            <span className="tree-stat tree-stat--done" title={`${yearLabel}년 판정 완료`}>
                              <CheckCircle2 size={10} strokeWidth={2.5} aria-hidden />
                              {row.judgedCount}
                            </span>
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
                  <h2 className="pending-panel-title">
                    {isAllTeamsView ? '전체 대기' : selectedTeam.teamName}
                  </h2>
                  <span className="pending-panel-badge">
                    대기{' '}
                    <strong>{isAllTeamsView ? totalPending : selectedTeam.cases.length}</strong>건
                  </span>
                </div>

                {(isAllTeamsView ? cases.length === 0 : selectedTeam.cases.length === 0) ? (
                  <div className="pending-panel-empty">
                    {isAllTeamsView
                      ? '검토 대기 건이 없습니다.'
                      : '이 팀에는 검토 대기 건이 없습니다.'}
                  </div>
                ) : (
                  <div className="pending-table-wrap">
                    <table
                      className={`pending-table pending-table--compact${isAllTeamsView ? ' pending-table--with-team' : ''}`}
                    >
                      <thead>
                        <tr>
                          {isAllTeamsView && (
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
                          )}
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
                              aria-label="접수일 기준 정렬"
                            >
                              <span>접수</span>
                              <SortGlyph active={tableSort.key === 'submitted'} direction={tableSort.direction} />
                            </button>
                          </th>
                          <th scope="col" className="pending-th pending-th--action">
                            처리
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCases.map((c) => (
                          <tr key={c.id}>
                            {isAllTeamsView && (
                              <td className="pending-td-team">
                                <span className="pending-td-team-text" title={c.teamName || '미지정'}>
                                  {(c.teamName && String(c.teamName).trim()) || '미지정'}
                                </span>
                              </td>
                            )}
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
                            <td className="pending-td-action">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm pending-td-btn"
                                onClick={() => openReview(c)}
                                disabled={loadingCaseId === c.id}
                              >
                                {loadingCaseId === c.id ? '…' : '심사'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
        />
      )}
    </div>
  );
}
