import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  X,
  MapPinned,
  UserCircle2,
  CheckCircle2,
  Trophy,
  Building2,
} from 'lucide-react';
import AdminSatisfactionSetupModal from './AdminSatisfactionSetupModal';
import AdminTargetMembersUploadModal from './AdminTargetMembersUploadModal';
import {
  fetchCsSatisfactionCenterMonthDetail,
  fetchCsSatisfactionDashboardKpis,
  fetchCsSatisfactionRanking,
  fetchCsSatisfactionSummary,
} from '../../api/adminApi';
import { mergeSecondDepthOptions } from '../../utils/adminSecondDepth';
import Skeleton from '../../components/common/Skeleton';
import './DashboardPage.css';
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

function RankingQuadSkeleton({ topN = 3 }) {
  return (
    <div className="adm-sat-rank-quad">
      {[0, 1, 2].map((c) => (
        <div key={c} className="adm-sat-rank-col">
          <div className="adm-sat-rank-col__head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Skeleton width={18} height={18} radius={6} />
            <Skeleton variant="text" width={60} height={13} />
            <Skeleton variant="text" width={48} height={11} />
          </div>
          <table className="adm-table adm-sat-rank-mini">
            <thead>
              <tr>
                <th className="adm-th-cell">순위</th>
                <th className="adm-th-cell">이름</th>
                <th className="adm-th-cell">소속</th>
                <th className="adm-th-cell">건수</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: topN }).map((_, r) => (
                <tr key={r}>
                  <td><Skeleton width={22} height={22} radius={999} /></td>
                  <td><Skeleton variant="text" width={60} height={12} /></td>
                  <td><Skeleton variant="text" width={70} height={12} /></td>
                  <td><Skeleton variant="text" width={30} height={12} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function SummaryTableSkeletonRows({ rows = 6, cols = 8 }) {
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

const SAT_RANK_TOP_N = 3;

function pct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function num(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('ko-KR');
}

function KpiScopeListCard({ title, icon: Icon, rows = [] }) {
  const shortDeptLabel = (name) => {
    const s = String(name ?? '').trim();
    if (!s) return '—';
    if (s === '종합') return s;
    return [...s].slice(0, 2).join('');
  };
  const toRow = (r) => ({
    scopeKey: r?.scopeKey ?? r?.secondDepthDeptId ?? r?.taskCode ?? 'UNKNOWN',
    scopeName: r?.scopeName ?? r?.centerName ?? '종합',
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
    { scopeKey: 'OVERALL', scopeName: '종합', achievementRate: null, targetMet: null };
  const busanRow =
    pickByName('부산') ?? { scopeKey: 'BUSAN', scopeName: '부산', achievementRate: null, targetMet: null };
  const seobuRow =
    pickByName('서부') ?? { scopeKey: 'SEOBU', scopeName: '서부', achievementRate: null, targetMet: null };
  const renderFixedRow = (r) => (
    <div key={`${title}-${r.scopeKey}`} className="adm-sat-kpi-center-row">
      <span className="adm-sat-kpi-center-name" title={r.scopeName}>
        {shortDeptLabel(r.scopeName)}
      </span>
      <span className="adm-sat-kpi-center-pct">{pct(r.achievementRate)}</span>
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
      <div className="adm-sat-kpi-center-list" aria-label={`${title} 종합/센터 달성률`}>
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

/** 필터된 행 기준 합계·가중 평균 목표%·통합 달성률 */
function computeSummaryTotals(list) {
  let evalSum = 0;
  let satSum = 0;
  let dissSum = 0;
  let evalTargetMemberSum = 0;
  let targetWeightedNum = 0;
  let targetWeightedDen = 0;
  for (const r of list) {
    const e = Number(r.evalCount) || 0;
    evalSum += e;
    satSum += Number(r.satisfiedCount) || 0;
    dissSum += Number(r.dissatisfiedCount) || 0;
    evalTargetMemberSum += Number(r.evalTargetMemberCount) || 0;
    const tp = r.targetPercent;
    if (tp != null && !Number.isNaN(Number(tp)) && e > 0) {
      targetWeightedNum += Number(tp) * e;
      targetWeightedDen += e;
    }
  }
  const satRatePct = evalSum > 0 ? (100 * satSum) / evalSum : null;
  const avgTarget =
    targetWeightedDen > 0 ? Math.round((targetWeightedNum / targetWeightedDen) * 10) / 10 : null;
  let achievement = null;
  if (avgTarget != null && avgTarget > 0 && satRatePct != null) {
    achievement = Math.round((100 * satRatePct) / avgTarget * 10) / 10;
  }
  return {
    evalSum,
    satSum,
    dissSum,
    evalTargetMemberSum,
    avgTarget,
    achievement,
  };
}

export default function AdminSatisfactionPage() {
  /** 표·차트 공통 연도 — 연도 선택 UI 없음(항상 당해 연도) */
  const year = new Date().getFullYear();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [targetUploadModalOpen, setTargetUploadModalOpen] = useState(false);

  /** null = 미적용, 문자열(빈 문자열 포함) = 해당 값과 일치하는 행만 — Dashboard와 동일 */
  const [filterCenter, setFilterCenter] = useState(null);
  const [filterGroup, setFilterGroup] = useState(null);
  const [selectedSecondDepthId, setSelectedSecondDepthId] = useState(null);

  const summaryQuery = useQuery({
    queryKey: ['cs-satisfaction-summary', year],
    queryFn: () => fetchCsSatisfactionSummary(year, undefined),
  });

  const dashboardKpisQuery = useQuery({
    queryKey: ['cs-satisfaction-dashboard-kpis', year],
    queryFn: () => fetchCsSatisfactionDashboardKpis(year),
  });

  const rankingQuery = useQuery({
    queryKey: ['cs-satisfaction-ranking', year, SAT_RANK_TOP_N],
    queryFn: () => fetchCsSatisfactionRanking(year, SAT_RANK_TOP_N),
  });

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

  /** month 생략 → API에서 해당 연도 1/1~12/31 (상단 연간 요약과 동일 범위로 구성원 집계) */
  const centerMonthDetailQuery = useQuery({
    queryKey: ['cs-satisfaction-center-month-detail', selectedSecondDepthId, year],
    queryFn: () => fetchCsSatisfactionCenterMonthDetail(selectedSecondDepthId, year, undefined),
    enabled: centerDetailEnabled,
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
        return true;
      }),
    [rows, filterCenter, filterGroup],
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

  const clearDeptFilters = () => {
    setFilterCenter(null);
    setFilterGroup(null);
  };

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in adm-sat-page">
      <header className="adm-header adm-header--yp">
        <div className="adm-header-row">
          <div className="adm-header-text">
            <p className="yadm-identity-kicker">YOU PRO · 관리</p>
            <h1 className="adm-title">CS 만족도 대시보드</h1>
            <p className="adm-sub">
              {year}년 기준 전체 센터 만족도와 실(부서)별 현황을
              <br />
              확인하세요.
            </p>
          </div>
          <div className="adm-sat-header-actions">
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

      <section className="adm-section adm-section--ranking adm-sat-ranking-section" aria-labelledby="adm-sat-rank-title">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 id="adm-sat-rank-title" className="adm-section-heading">
              연간 랭킹
            </h2>
            <p className="adm-section-hint adm-section-hint--ranking">
              {year}년 · 만족(satisfied) Y이면서 해당 중점지표도 Y인 건수 기준 · 구성원별 상위 {SAT_RANK_TOP_N}
              위 (전체 센터 통합)
            </p>
          </div>
        </div>
        {rankingQuery.isPending ? (
          <RankingQuadSkeleton topN={SAT_RANK_TOP_N} />
        ) : rankingQuery.isError ? (
          <p className="adm-sat-query-err">{rankingQuery.error?.message ?? '랭킹을 불러오지 못했습니다.'}</p>
        ) : (
          <div className="adm-sat-rank-quad">
            {[
              {
                title: '5대도시',
                entries: rankingQuery.data?.topByFiveMajorCities ?? [],
                valueLabel: '건수',
              },
              { title: '5060', entries: rankingQuery.data?.topByGen5060 ?? [], valueLabel: '건수' },
              {
                title: '문제해결',
                entries: rankingQuery.data?.topByProblemResolved ?? [],
                valueLabel: '건수',
              },
            ].map((col) => (
              <div key={col.title} className="adm-sat-rank-col">
                <div className="adm-sat-rank-col__head">
                  <Trophy className="adm-sat-rank-col__ico" size={17} strokeWidth={2.25} aria-hidden />
                  <span className="adm-sat-rank-col__title">{col.title}</span>
                  <span className="adm-sat-rank-col__sub">1 ~ {SAT_RANK_TOP_N}위</span>
                </div>
                <table className="adm-table adm-sat-rank-mini" aria-label={`${year}년 ${col.title} 랭킹`}>
                  <thead>
                    <tr>
                      <th scope="col" className="adm-th-cell">
                        순위
                      </th>
                      <th scope="col" className="adm-th-cell">
                        이름
                      </th>
                      <th scope="col" className="adm-th-cell">
                        소속
                      </th>
                      <th scope="col" className="adm-th-cell">
                        {col.valueLabel}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: SAT_RANK_TOP_N }, (_, i) => i + 1).map((rank) => {
                      const row = col.entries[rank - 1];
                      return (
                        <tr key={`${col.title}-${rank}`} className={row ? '' : 'adm-sat-rank-mini__tr--empty'}>
                          <td>
                            <span className={`adm-rank-pill ${rank <= 3 ? `adm-rank-pill--${rank}` : 'adm-rank-pill--rest'}`}>
                              {rank}
                            </span>
                          </td>
                          <td className="adm-sat-rank-mini__name">
                            {row?.memberName?.trim() ? row.memberName : row?.skid ?? '—'}
                          </td>
                          <td className="adm-sat-rank-mini__team">{row?.teamName?.trim() ? row.teamName : '—'}</td>
                          <td className="adm-sat-rank-mini__num">{row ? num(row.count) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="adm-section" aria-labelledby="adm-sat-table-title">
        <div className="adm-section-title adm-section-title--with-filter">
          <div className="adm-sat-section-heading">
            <span className="adm-title-bar" aria-hidden />
            <div className="adm-section-title-text">
              <h2 id="adm-sat-table-title" className="adm-section-heading">
                실(부서)별 만족도
              </h2>
              <p className="adm-section-hint">
                표 행은 설정(센터별 리프 팀 ID 목록) 순서로 고정됩니다. 평가건·만족건은{' '}
                <strong>평가대상자(you_yn=Y)</strong>만 집계합니다. 행을 클릭하면 해당 팀 구성원을 아래에 표시 ·{' '}
                <strong>센터·그룹</strong>을 클릭하면 같은 값만 필터(다시 클릭하면 해제)
              </p>
            </div>
          </div>
          <div className="adm-dept-filter adm-sat-filters">
            <button
              type="button"
              className="btn btn-secondary btn-sm adm-sat-refresh"
              onClick={() => {
                summaryQuery.refetch();
                centerMonthDetailQuery.refetch();
                dashboardKpisQuery.refetch();
                rankingQuery.refetch();
              }}
              disabled={summaryQuery.isFetching || dashboardKpisQuery.isFetching || rankingQuery.isFetching}
              aria-label="새로고침"
            >
              <RefreshCw
                size={14}
                className={
                  summaryQuery.isFetching || dashboardKpisQuery.isFetching || rankingQuery.isFetching
                    ? 'adm-sat-spin'
                    : ''
                }
                aria-hidden
              />
            </button>
          </div>
        </div>

        {(filterCenter !== null || filterGroup !== null) && (
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
                  팀명
                </th>
                <th scope="col" className="adm-th-cell">
                  평가건
                </th>
                <th scope="col" className="adm-th-cell">
                  만족건
                </th>
                <th scope="col" className="adm-th-cell">
                  불만건
                </th>
                <th scope="col" className="adm-th-cell">
                  목표%
                </th>
                <th scope="col" className="adm-th-cell">
                  달성률%
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SummaryTableSkeletonRows rows={6} cols={8} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="adm-table-empty">
                    데이터 없음
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="adm-table-empty">
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
                        <span className="adm-team-name">{r.secondDepthName}</span>
                        <span className="adm-member-badge">{num(r.evalTargetMemberCount)}명</span>
                      </td>
                      <td>{num(r.evalCount)}</td>
                      <td>{num(r.satisfiedCount)}</td>
                      <td>{num(r.dissatisfiedCount)}</td>
                      <td>{pct(r.targetPercent)}</td>
                      <td>{pct(r.achievementRate)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && rows.length > 0 && filteredRows.length > 0 ? (
              <tfoot>
                <tr className="adm-table-total-row">
                  <td colSpan={3} className="adm-sat-table-tfoot-label">
                    <span className="adm-table-total-label">합계</span>
                    <span className="adm-table-total-sublabel">
                      {sortedRows.length}개 실 · 평가대상 {num(summaryTotals.evalTargetMemberSum)}명
                    </span>
                  </td>
                  <td>{num(summaryTotals.evalSum)}</td>
                  <td>{num(summaryTotals.satSum)}</td>
                  <td>{num(summaryTotals.dissSum)}</td>
                  <td>{pct(summaryTotals.avgTarget)}</td>
                  <td>{pct(summaryTotals.achievement)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {selectedSecondDepthId != null ? (
          <div className="adm-sat-members-below">
            <p className="adm-sat-members-caption">
              {year}년 연간 기준 · 평가대상자 구성원별 만족도 건수 (상단 표와 동일 연도·집계 기준)
            </p>
            {centerMonthDetailQuery.isLoading ? (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th className="adm-th-cell">구성원</th>
                      <th className="adm-th-cell">평가건</th>
                      <th className="adm-th-cell">만족건</th>
                      <th className="adm-th-cell">불만건</th>
                      <th className="adm-th-cell">5060건</th>
                      <th className="adm-th-cell">5대 도시건</th>
                      <th className="adm-th-cell">문제해결건</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SummaryTableSkeletonRows rows={4} cols={7} />
                  </tbody>
                </table>
              </div>
            ) : centerMonthDetailQuery.isError ? (
              <p className="adm-team-detail-error">
                {centerMonthDetailQuery.error?.message ?? '불러오지 못했습니다.'}
              </p>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table" aria-label="선택한 팀 구성원 만족도 통계">
                  <thead>
                    <tr>
                      <th scope="col" className="adm-th-cell">
                        구성원
                      </th>
                      <th scope="col" className="adm-th-cell">
                        평가건
                      </th>
                      <th scope="col" className="adm-th-cell">
                        만족건
                      </th>
                      <th scope="col" className="adm-th-cell">
                        불만건
                      </th>
                      <th scope="col" className="adm-th-cell">
                        5060건
                      </th>
                      <th scope="col" className="adm-th-cell">
                        5대 도시건
                      </th>
                      <th scope="col" className="adm-th-cell">
                        문제해결건
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(centerMonthDetailQuery.data?.members?.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={7} className="adm-table-empty">
                          없음
                        </td>
                      </tr>
                    ) : (
                      centerMonthDetailQuery.data.members.map((m) => (
                        <tr key={m.skid}>
                          <td>
                            <span className="adm-sat-member-name">
                              {m.mbName?.trim() ? m.mbName : m.skid}
                            </span>
                            {m.mbName?.trim() ? (
                              <span className="adm-sat-member-skid">{m.skid}</span>
                            ) : null}
                          </td>
                          <td>{num(m.evalCount)}</td>
                          <td>{num(m.satisfiedCount)}</td>
                          <td>{num(m.dissatisfiedCount)}</td>
                          <td>{num(m.gen5060Count ?? 0)}</td>
                          <td>{num(m.fiveMajorCitiesCount ?? 0)}</td>
                          <td>{num(m.problemResolvedCount ?? 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <AdminSatisfactionSetupModal open={setupModalOpen} onClose={() => setSetupModalOpen(false)} />
      <AdminTargetMembersUploadModal
        open={targetUploadModalOpen}
        onClose={() => setTargetUploadModalOpen(false)}
      />
    </div>
  );
}
