import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Upload } from 'lucide-react';
import AdminSatisfactionSetupModal from './AdminSatisfactionSetupModal';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchCsSatisfactionCenterMonthDetail,
  fetchCsSatisfactionMonthlyOverview,
  fetchCsSatisfactionSummary,
} from '../../api/adminApi';
import './DashboardPage.css';
import './AdminSatisfactionPage.css';

function pct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function num(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('ko-KR');
}

function isSatisfactionRowSelectable(r) {
  const id = r?.secondDepthDeptId;
  return typeof id === 'number' && id > 0;
}

function centerLabel(r) {
  return (r.centerName && String(r.centerName).trim()) || '—';
}

function groupLabel(r) {
  return (r.groupName && String(r.groupName).trim()) || '—';
}

/** 필터된 행 기준 합계·가중 평균 목표%·통합 달성률 */
function computeSummaryTotals(list) {
  let evalSum = 0;
  let satSum = 0;
  let dissSum = 0;
  let targetWeightedNum = 0;
  let targetWeightedDen = 0;
  for (const r of list) {
    const e = Number(r.evalCount) || 0;
    evalSum += e;
    satSum += Number(r.satisfiedCount) || 0;
    dissSum += Number(r.dissatisfiedCount) || 0;
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
  return { evalSum, satSum, dissSum, avgTarget, achievement };
}

export default function AdminSatisfactionPage() {
  /** 표·차트 공통 연도 — 연도 선택 UI 없음(항상 당해 연도) */
  const year = new Date().getFullYear();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  const [centerFilter, setCenterFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedSecondDepthId, setSelectedSecondDepthId] = useState(null);

  const summaryQuery = useQuery({
    queryKey: ['cs-satisfaction-summary', year],
    queryFn: () => fetchCsSatisfactionSummary(year, undefined),
  });

  const monthlyOverviewQuery = useQuery({
    queryKey: ['cs-satisfaction-monthly-overview', year],
    queryFn: () => fetchCsSatisfactionMonthlyOverview(year),
  });

  const unifiedChartPoints = useMemo(() => {
    const u = monthlyOverviewQuery.data?.unified ?? [];
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const row = u.find((x) => x.month === month);
      return {
        label: `${month}월`,
        evalCount: Number(row?.evalCount ?? 0),
        satisfiedCount: Number(row?.satisfiedCount ?? 0),
        dissatisfiedCount: Number(row?.dissatisfiedCount ?? 0),
      };
    });
  }, [monthlyOverviewQuery.data]);

  const focusChartPoints = useMemo(() => {
    const f = monthlyOverviewQuery.data?.focusTasks ?? [];
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const row = f.find((x) => x.month === month);
      return {
        label: `${month}월`,
        fiveMajorCitiesCount: Number(row?.fiveMajorCitiesCount ?? 0),
        gen5060Count: Number(row?.gen5060Count ?? 0),
        problemResolvedCount: Number(row?.problemResolvedCount ?? 0),
      };
    });
  }, [monthlyOverviewQuery.data]);

  const overviewLoading = monthlyOverviewQuery.isPending;
  const overviewError = monthlyOverviewQuery.error;

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

  const centerOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(centerLabel(r)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [rows]);

  const groupOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (centerFilter !== 'all' && centerLabel(r) !== centerFilter) return;
      set.add(groupLabel(r));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [rows, centerFilter]);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (centerFilter !== 'all' && centerLabel(r) !== centerFilter) return false;
        if (groupFilter !== 'all' && groupLabel(r) !== groupFilter) return false;
        return true;
      }),
    [rows, centerFilter, groupFilter],
  );

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
    if (groupFilter === 'all') return;
    if (!groupOptions.includes(groupFilter)) {
      setGroupFilter('all');
    }
  }, [groupOptions, groupFilter]);

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

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in adm-sat-page">
      <header className="adm-header adm-header--yp">
        <div className="adm-header-row">
          <div className="adm-header-text">
            <p className="yadm-identity-kicker">YOU PRO · 관리</p>
            <h1 className="adm-title">CS 만족도 대시보드</h1>
            <p className="adm-sub">
              {year}년 기준 통합 월별 추이와 실(부서)별 만족도를
              <br />
              확인하세요.
            </p>
          </div>
          <div className="adm-sat-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm adm-sat-upload-entry"
              onClick={() => setSetupModalOpen(true)}
            >
              <Upload size={15} strokeWidth={2.25} aria-hidden />
              목표 · 엑셀
            </button>
          </div>
        </div>
      </header>

      <section className="adm-section adm-sat-trend-section" aria-labelledby="adm-sat-trend-title">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 id="adm-sat-trend-title" className="adm-section-heading">
              월별 만족도 추이
            </h2>
            <p className="adm-section-hint">
              {year}년 · 설정된 상위 실(서부·부산 등) 소속을 통합한 월별 건수와 중점추진과제(Y) 건수입니다.
            </p>
          </div>
        </div>
        <div className="adm-sat-charts-stack adm-sat-charts-stack--two">
          {overviewLoading ? (
            <div className="adm-sat-chart-shell adm-sat-chart-shell--full">
              <div className="adm-sat-chart-loading">
                <div className="spinner" />
                <p>차트 불러오는 중…</p>
              </div>
            </div>
          ) : overviewError ? (
            <div className="adm-sat-chart-shell adm-sat-chart-shell--full">
              <p className="adm-sat-chart-error">
                {overviewError?.message ?? '차트를 불러오지 못했습니다.'}
              </p>
            </div>
          ) : (
            <>
              <div className="adm-sat-chart-shell">
                <h3 className="adm-sat-trend-chart-caption">월별 평가·만족·불만족</h3>
                <ResponsiveContainer width="100%" height={280} minWidth={0}>
                  <LineChart
                    data={unifiedChartPoints}
                    margin={{ top: 10, right: 12, left: -4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(15,23,42,0.1)' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      width={38}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid rgba(15,23,42,0.08)',
                        boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                        fontSize: 12,
                      }}
                      labelStyle={{ fontWeight: 700, marginBottom: 6, color: '#0f172a' }}
                      formatter={(value, name) => [`${Number(value).toLocaleString('ko-KR')}건`, name]}
                      labelFormatter={(label) => `${year}년 ${label}`}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
                      formatter={(value) => (
                        <span style={{ color: '#334155', fontWeight: 600 }}>{value}</span>
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="evalCount"
                      name="평가건"
                      stroke="#0a7ea4"
                      strokeWidth={2.75}
                      dot={{ r: 3.5, strokeWidth: 2, stroke: '#fff', fill: '#0a7ea4' }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="satisfiedCount"
                      name="만족건"
                      stroke="#059669"
                      strokeWidth={2.75}
                      dot={{ r: 3.5, strokeWidth: 2, stroke: '#fff', fill: '#059669' }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="dissatisfiedCount"
                      name="불만족건"
                      stroke="#c2410c"
                      strokeWidth={2.75}
                      dot={{ r: 3.5, strokeWidth: 2, stroke: '#fff', fill: '#c2410c' }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="adm-sat-chart-shell">
                <h3 className="adm-sat-trend-chart-caption">중점추진과제 (5대도시 · 5060 · 문제해결)</h3>
                <ResponsiveContainer width="100%" height={280} minWidth={0}>
                  <LineChart
                    data={focusChartPoints}
                    margin={{ top: 10, right: 12, left: -4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(15,23,42,0.1)' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      width={38}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid rgba(15,23,42,0.08)',
                        boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                        fontSize: 12,
                      }}
                      labelStyle={{ fontWeight: 700, marginBottom: 6, color: '#0f172a' }}
                      formatter={(value, name) => [`${Number(value).toLocaleString('ko-KR')}건`, name]}
                      labelFormatter={(label) => `${year}년 ${label}`}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
                      formatter={(value) => (
                        <span style={{ color: '#334155', fontWeight: 600 }}>{value}</span>
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="fiveMajorCitiesCount"
                      name="5대 도시"
                      stroke="#4f46e5"
                      strokeWidth={2.75}
                      dot={{ r: 3.5, strokeWidth: 2, stroke: '#fff', fill: '#4f46e5' }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="gen5060Count"
                      name="5060"
                      stroke="#d97706"
                      strokeWidth={2.75}
                      dot={{ r: 3.5, strokeWidth: 2, stroke: '#fff', fill: '#d97706' }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="problemResolvedCount"
                      name="문제해결"
                      stroke="#db2777"
                      strokeWidth={2.75}
                      dot={{ r: 3.5, strokeWidth: 2, stroke: '#fff', fill: '#db2777' }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="adm-section" aria-labelledby="adm-sat-table-title">
        <div className="adm-section-title adm-section-title--with-filter">
          <div className="adm-sat-section-heading">
            <span className="adm-title-bar" aria-hidden />
            <div className="adm-section-title-text">
              <h2 id="adm-sat-table-title" className="adm-section-heading">
                실(부서)별 만족도
              </h2>
            </div>
          </div>
          <div className="adm-dept-filter adm-sat-filters">
            <button
              type="button"
              className="btn btn-secondary btn-sm adm-sat-refresh"
              onClick={() => {
                summaryQuery.refetch();
                centerMonthDetailQuery.refetch();
                monthlyOverviewQuery.refetch();
              }}
              disabled={summaryQuery.isFetching}
              aria-label="새로고침"
            >
              <RefreshCw size={14} className={summaryQuery.isFetching ? 'adm-sat-spin' : ''} aria-hidden />
            </button>
          </div>
        </div>

        {err ? <p className="adm-sat-query-err">{err}</p> : null}

        <div className="adm-table-wrap">
          <table className="adm-table adm-sat-summary-table">
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
              <tr className="adm-sat-thead-filter-row">
                <th scope="col" className="adm-th-cell adm-th-cell--filter">
                  <label className="sr-only" htmlFor="adm-sat-filter-center">
                    센터 필터
                  </label>
                  <select
                    id="adm-sat-filter-center"
                    className="adm-sat-th-filter"
                    value={centerFilter}
                    onChange={(e) => {
                      setCenterFilter(e.target.value);
                      setGroupFilter('all');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="센터로 필터"
                  >
                    <option value="all">전체</option>
                    {centerOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </th>
                <th scope="col" className="adm-th-cell adm-th-cell--filter">
                  <label className="sr-only" htmlFor="adm-sat-filter-group">
                    그룹 필터
                  </label>
                  <select
                    id="adm-sat-filter-group"
                    className="adm-sat-th-filter"
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="그룹으로 필터"
                  >
                    <option value="all">전체</option>
                    {groupOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </th>
                <th scope="col" colSpan={6} className="adm-th-cell adm-th-cell--filter-spacer" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="adm-table-empty">
                    불러오는 중…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="adm-table-empty">
                    데이터 없음
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="adm-table-empty">
                    필터 조건에 맞는 행이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
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
                      <td>{(r.centerName && String(r.centerName).trim()) || '—'}</td>
                      <td>{(r.groupName && String(r.groupName).trim()) || '—'}</td>
                      <td>
                        <span className="adm-team-name">{r.secondDepthName}</span>
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
                <tr>
                  <td colSpan={3} className="adm-sat-table-tfoot-label">
                    합계
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
              {year}년 연간 기준 · 구성원별 만족도 건수 (상단 표와 동일 연도 범위)
            </p>
            {centerMonthDetailQuery.isLoading ? (
              <div className="adm-team-detail-loading adm-sat-members-loading">
                <div className="spinner" />
                <p>불러오는 중…</p>
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
    </div>
  );
}
