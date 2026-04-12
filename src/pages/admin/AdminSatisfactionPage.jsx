import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { RefreshCw, Upload } from 'lucide-react';
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
  fetchCsSatisfactionMonthlyTrend,
  fetchCsSatisfactionSummary,
} from '../../api/adminApi';
import { mergeSecondDepthOptions } from '../../utils/adminSecondDepth';
import './DashboardPage.css';
import './AdminSatisfactionPage.css';

const YEAR_OPTIONS_LEN = 4;

/** 월별 비교 차트 — 상위 2depth(설정상 5·6번 실) */
const COMPARE_SECOND_DEPTH_IDS = [5, 6];

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

export default function AdminSatisfactionPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [secondDepthKey, setSecondDepthKey] = useState('all');
  const [selectedSecondDepthId, setSelectedSecondDepthId] = useState(null);

  const summaryQuery = useQuery({
    queryKey: ['cs-satisfaction-summary', year, secondDepthKey],
    queryFn: () =>
      fetchCsSatisfactionSummary(
        year,
        secondDepthKey === 'all' ? undefined : Number(secondDepthKey),
      ),
  });

  const secondDepthOptions = useMemo(
    () => mergeSecondDepthOptions(summaryQuery.data?.filterMeta?.secondDepthDepts),
    [summaryQuery.data?.filterMeta?.secondDepthDepts],
  );

  const trendQueries = useQueries({
    queries: COMPARE_SECOND_DEPTH_IDS.map((id) => ({
      queryKey: ['cs-satisfaction-trend', year, id],
      queryFn: () => fetchCsSatisfactionMonthlyTrend(year, id),
    })),
  });

  const trendDataA = trendQueries[0]?.data;
  const trendDataB = trendQueries[1]?.data;

  const trendChart = useMemo(() => {
    const monthsA = trendDataA?.months ?? [];
    const monthsB = trendDataB?.months ?? [];
    const nameA = trendDataA?.secondDepthName?.trim() || '5번 실';
    const nameB = trendDataB?.secondDepthName?.trim() || '6번 실';
    const points = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const pa = monthsA.find((m) => m.month === month);
      const pb = monthsB.find((m) => m.month === month);
      return {
        label: `${month}월`,
        evalA: pa?.evalCount ?? 0,
        evalB: pb?.evalCount ?? 0,
      };
    });
    return { points, nameA, nameB };
  }, [trendDataA, trendDataB]);

  const trendLoading = trendQueries.some((q) => q.isPending);
  const trendError = trendQueries.find((q) => q.isError)?.error;

  const centerDetailEnabled =
    selectedSecondDepthId != null &&
    !Number.isNaN(selectedSecondDepthId) &&
    selectedSecondDepthId > 0;

  const dCal = new Date();
  const thisCalYear = dCal.getFullYear();
  const thisCalMonth = dCal.getMonth() + 1;

  const centerMonthDetailQuery = useQuery({
    queryKey: ['cs-satisfaction-center-month-detail', selectedSecondDepthId, thisCalYear, thisCalMonth],
    queryFn: () =>
      fetchCsSatisfactionCenterMonthDetail(selectedSecondDepthId, thisCalYear, thisCalMonth),
    enabled: centerDetailEnabled,
  });

  const yearOptions = useMemo(() => {
    const y0 = new Date().getFullYear();
    return Array.from({ length: YEAR_OPTIONS_LEN }, (_, i) => y0 - i);
  }, []);

  const rows = useMemo(() => summaryQuery.data?.rows ?? [], [summaryQuery.data]);
  const loading = summaryQuery.isLoading;
  const err = summaryQuery.error?.message;

  useEffect(() => {
    if (selectedSecondDepthId == null) return;
    const still = rows.some(
      (r) => r.secondDepthDeptId === selectedSecondDepthId && isSatisfactionRowSelectable(r),
    );
    if (!still) setSelectedSecondDepthId(null);
  }, [rows, selectedSecondDepthId]);

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in adm-sat-page">
      <header className="adm-header adm-header--yp">
        <div className="adm-header-row">
          <div className="adm-header-text">
            <p className="adm-identity-kicker">YOU PRO · 관리</p>
            <h1 className="adm-title">CS 만족도 대시보드</h1>
            <p className="adm-sub">
              {year}년 기준 상위 실(5번·6번) 월별 만족도{' '}
              <strong>평가 건수</strong>를 비교·
              <br />
              확인하세요.
            </p>
          </div>
          <div className="adm-sat-header-actions">
            <Link to="/admin" className="adm-header-link">
              YOU PRO 대시보드
            </Link>
            <Link
              to="/admin/satisfaction/setup"
              className="btn btn-secondary btn-sm adm-sat-upload-entry"
            >
              <Upload size={15} strokeWidth={2.25} aria-hidden />
              목표 · 엑셀
            </Link>
          </div>
        </div>
      </header>

      <section className="adm-section adm-sat-trend-section" aria-labelledby="adm-sat-trend-title">
        <div className="adm-section-title">
          <span className="adm-title-bar" />
          <div>
            <h2 id="adm-sat-trend-title" className="adm-section-heading">
              5번·6번 실 월별 평가건
            </h2>
            <p className="adm-section-hint">
              {year}년 · 꺾은선은 각 실의 월간 CS 만족도 평가 건수입니다.
            </p>
          </div>
        </div>
        <div className="adm-sat-chart-shell">
          {trendLoading ? (
            <div className="adm-sat-chart-loading">
              <div className="spinner" />
              <p>차트 불러오는 중…</p>
            </div>
          ) : trendError ? (
            <p className="adm-sat-chart-error">{trendError?.message ?? '차트를 불러오지 못했습니다.'}</p>
          ) : (
            <ResponsiveContainer width="100%" height={300} minWidth={0}>
              <LineChart
                data={trendChart.points}
                margin={{ top: 10, right: 8, left: -8, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="admSatLineA" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0a7ea4" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                  <linearGradient id="admSatLineB" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
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
                  width={36}
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
                  formatter={(value) => <span style={{ color: '#334155', fontWeight: 600 }}>{value}</span>}
                />
                <Line
                  type="monotone"
                  dataKey="evalA"
                  name={trendChart.nameA}
                  stroke="url(#admSatLineA)"
                  strokeWidth={2.75}
                  dot={{ r: 3.5, strokeWidth: 2, stroke: '#fff', fill: '#0a7ea4' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="evalB"
                  name={trendChart.nameB}
                  stroke="url(#admSatLineB)"
                  strokeWidth={2.75}
                  dot={{ r: 3.5, strokeWidth: 2, stroke: '#fff', fill: '#6366f1' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="adm-section" aria-labelledby="adm-sat-table-title">
        <div className="adm-section-title adm-section-title--with-filter">
          <span className="adm-title-bar" />
          <div className="adm-section-title-text">
            <h2 id="adm-sat-table-title" className="adm-section-heading">
              실(부서)별 만족도
            </h2>
          </div>
          <div className="adm-dept-filter adm-sat-filters">
            <select
              className="adm-dept-filter-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="연도"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              className="adm-dept-filter-select"
              value={secondDepthKey}
              onChange={(e) => setSecondDepthKey(e.target.value)}
              aria-label="2depth 부서 필터"
            >
              <option value="all">전체</option>
              {secondDepthOptions.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))}
              <option value="-1">기타</option>
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-sm adm-sat-refresh"
              onClick={() => {
                summaryQuery.refetch();
                centerMonthDetailQuery.refetch();
                trendQueries.forEach((q) => q.refetch());
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
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col" className="adm-th-cell">
                  실명
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
                  만족비중
                </th>
                <th scope="col" className="adm-th-cell">
                  목표%
                </th>
                <th scope="col" className="adm-th-cell">
                  달성율
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="adm-table-empty">
                    불러오는 중…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="adm-table-empty">
                    데이터 없음
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
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
                        <span className="adm-team-name">{r.secondDepthName}</span>
                      </td>
                      <td>{num(r.evalCount)}</td>
                      <td>{num(r.satisfiedCount)}</td>
                      <td>{num(r.dissatisfiedCount)}</td>
                      <td>{pct(r.satisfactionRate)}</td>
                      <td>{pct(r.targetPercent)}</td>
                      <td>{pct(r.achievementRate)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedSecondDepthId != null ? (
          <div className="adm-sat-members-below">
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
                <table className="adm-table" aria-label="선택한 실 구성원">
                  <thead>
                    <tr>
                      <th scope="col" className="adm-th-cell">
                        구성원
                      </th>
                      <th scope="col" className="adm-th-cell">
                        부서
                      </th>
                      <th scope="col" className="adm-th-cell">
                        평가건
                      </th>
                      <th scope="col" className="adm-th-cell">
                        만족
                      </th>
                      <th scope="col" className="adm-th-cell">
                        불만족
                      </th>
                      <th scope="col" className="adm-th-cell">
                        만족률
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(centerMonthDetailQuery.data?.members?.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={6} className="adm-table-empty">
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
                          <td className="adm-sat-member-dept">{m.deptName ?? '—'}</td>
                          <td>{num(m.evalCount)}</td>
                          <td>{num(m.satisfiedCount)}</td>
                          <td>{num(m.dissatisfiedCount)}</td>
                          <td>{pct(m.satisfactionRate)}</td>
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
    </div>
  );
}
