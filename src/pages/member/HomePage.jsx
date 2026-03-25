import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMemberModalStore } from '../../store/memberModalStore';
import {
  PlusCircle, ChevronRight, Clock, CheckCircle, XCircle,
  TrendingUp, Award, Users, Star, Coins,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import useAuthStore from '../../store/authStore';
import { fetchMemberHome, fetchMyCases } from '../../api/memberApi';
import './HomePage.css';

const now = new Date();
const currentMonth = now.toLocaleDateString('ko-KR', { month: 'long' });
const currentYear = now.getFullYear();
const thisMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const STATUS_LABEL = { pending: '검토 중', selected: '선정', rejected: '미선정' };
const STATUS_ICON = {
  pending: <Clock size={12} />,
  selected: <CheckCircle size={12} />,
  rejected: <XCircle size={12} />,
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="chart-tooltip-item">
          <span
            className="chart-tooltip-dot"
            style={{
              background: entry.fill || entry.color || entry.stroke,
            }}
          />
          <span>{entry.name}: {entry.value}건</span>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuthStore();
  const openSubmitModal = useMemberModalStore((s) => s.openSubmit);
  const openCaseListModal = useMemberModalStore((s) => s.openCaseList);
  const openCaseDetail = useMemberModalStore((s) => s.openCaseDetail);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['member-home', user?.skid],
    queryFn: () => fetchMemberHome(user.skid),
    enabled: !!user?.skid,
  });

  const { data: cases = [] } = useQuery({
    queryKey: ['my-cases', user?.skid],
    queryFn: () => fetchMyCases(user.skid),
    enabled: !!user?.skid,
  });

  // 월별 차트 데이터 — 올해 1~12월 전부 표시, 해당 연도 접수만 집계
  const monthlyChartData = useMemo(() => {
    const year = new Date().getFullYear();
    const yearPrefix = String(year);
    const acc = {};
    cases.forEach((c) => {
      const key = (c.month || c.submittedAt || '').slice(0, 7);
      if (!key || key.slice(0, 4) !== yearPrefix) return;
      if (!acc[key]) acc[key] = { selected: 0, pending: 0, rejected: 0 };
      acc[key][c.status] = (acc[key][c.status] || 0) + 1;
    });
    const months = [];
    for (let m = 1; m <= 12; m += 1) {
      const monthKey = `${year}-${String(m).padStart(2, '0')}`;
      const row = acc[monthKey] || { selected: 0, pending: 0, rejected: 0 };
      const submitted = row.selected + row.pending + row.rejected;
      months.push({
        monthKey,
        label: `${m}월`,
        selected: row.selected,
        submitted,
      });
    }
    return months;
  }, [cases]);

  if (isLoading || !data) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (isError) {
    return <div className="home-error">오류: {error?.message}</div>;
  }

  const {
    team,
    teamAvgSelected = 0,
    myTotalSelected = 0,
    monthlySelected = 0,
    monthlyLimit = 3,
    pendingCount = 0,
    annualLimit = 36,
  } = data;

  const annualPct = Math.min((myTotalSelected / annualLimit) * 100, 100);
  const monthlyPct = Math.min((monthlySelected / monthlyLimit) * 100, 100);
  const recentCases = cases.slice(0, 5);
  const estimatedRewardWon = myTotalSelected * 15000;

  // 이달 베스트 우수사례 — 이번 달 선정된 사례 중 가장 최근 것
  const bestCase = cases.find(
    (c) =>
      c.status === 'selected' &&
      (c.month || c.submittedAt || '').slice(0, 7) === thisMonthKey
  );

  return (
    <div className="home-wrap home-cute">
      <div className="home-float-deco" aria-hidden>
        <span className="home-float home-float--1">✨</span>
      </div>

      {/* ── 인사 배너 ─────────────────────────────────────────── */}
      <div className="home-banner home-hero-card">
        <div className="banner-left">
          <div className="banner-avatar">{user?.name?.[0] ?? '?'}</div>
          <div className="banner-text">
            <p className="home-kicker">오늘도 수고했어요 ✨</p>
            <h1 className="banner-name">
              안녕, <strong className="banner-name-strong">{user?.name}</strong>님
            </h1>
            <p className="banner-sub">
              <span className="banner-pill">{team?.name ?? '−'}</span>
              <span className="banner-dot">·</span>
              <span>{user?.position ?? '상담사'}</span>
            </p>
          </div>
        </div>
        <button type="button" className="banner-cta" onClick={openSubmitModal}>
          <PlusCircle size={17} strokeWidth={2.25} />
          우수사례 접수
        </button>
      </div>

      {/* ── KPI 카드 3~4개 ──────────────────────────────────── */}
      <div className={`kpi-row ${pendingCount > 0 ? 'kpi-row-4' : ''}`}>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">{currentMonth} 선정</span>
            <div className="kpi-icon kpi-icon-blue"><Award size={18} /></div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-big">{monthlySelected}</span>
            <span className="kpi-unit">/ {monthlyLimit}건</span>
          </div>
          <div className="kpi-bar-track">
            <div className="kpi-bar-fill kpi-fill-blue" style={{ width: `${monthlyPct}%` }} />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">{currentYear}년 누적</span>
            <div className="kpi-icon kpi-icon-amber"><TrendingUp size={18} /></div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-big">{myTotalSelected}</span>
            <span className="kpi-unit">/ {annualLimit}건</span>
          </div>
          <div className="kpi-bar-track">
            <div className="kpi-bar-fill kpi-fill-amber" style={{ width: `${annualPct}%` }} />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">실 평균</span>
            <div className="kpi-icon kpi-icon-green"><Users size={18} /></div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-big">{teamAvgSelected.toFixed(1)}</span>
            <span className="kpi-unit">건</span>
          </div>
          <div className="kpi-comparison">
            {myTotalSelected > teamAvgSelected
              ? <span className="kpi-above">실 평균 초과 ↑</span>
              : myTotalSelected < teamAvgSelected
              ? <span className="kpi-below">실 평균 미달 ↓</span>
              : <span className="kpi-equal">실 평균과 동일</span>
            }
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="kpi-card kpi-card-pending">
            <div className="kpi-card-header">
              <span className="kpi-label">검토 대기</span>
              <div className="kpi-icon kpi-icon-orange"><Clock size={18} /></div>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-big">{pendingCount}</span>
              <span className="kpi-unit">건</span>
            </div>
            <p className="kpi-pending-note">AI 검토 진행 중</p>
          </div>
        )}

      </div>

      {/* ── 연간 진행(좌) + 이달 베스트(우) ────────────────── */}
      <div className="annual-bar-card">

        {/* 좌: 연간 진행 (컴팩트) */}
        <div className="annual-compact">
          <div className="annual-compact-head">
            <div className="annual-compact-title-block">
              <div className="title-indicator ti-amber" />
              <div>
                <span className="annual-compact-label">연간 포상 진행률</span>
                <p className="annual-compact-hint">{currentYear}년 목표 {annualLimit}건 기준</p>
              </div>
            </div>
            <div className="annual-pct-badge">{annualPct.toFixed(0)}%</div>
          </div>

          <div className="annual-stat-row">
            <div className="annual-stat-main">
              <span className="annual-compact-big">{myTotalSelected}</span>
              <span className="annual-stat-slash">/</span>
              <span className="annual-compact-goal">{annualLimit}</span>
              <span className="annual-stat-unit">건</span>
            </div>
          </div>

          <div className="annual-track-wrap">
            <div className="annual-track-lg">
              <div className="annual-fill-lg" style={{ width: `${annualPct}%` }} />
            </div>
            <div className="annual-track-ticks">
              <span>0</span>
              <span>목표 {annualLimit}</span>
            </div>
          </div>

          <div className="annual-compact-footer">
            <div className="annual-reward-chip">
              <Coins size={15} className="annual-reward-icon" aria-hidden />
              <div className="annual-reward-text">
                <span className="annual-reward-label">예상 포상금</span>
                <span className="annual-reward-value">
                  <span className="annual-reward-num">
                    ~{estimatedRewardWon.toLocaleString('ko-KR')}
                  </span>
                  <span className="annual-reward-won">원</span>
                </span>
              </div>
            </div>
            {pendingCount > 0 && (
              <span className="annual-bar-pending">
                <Clock size={10} /> 검토 대기 {pendingCount}건
              </span>
            )}
          </div>
        </div>

        <div className="annual-divider" />

        {/* 우: 이달 베스트 우수사례 */}
        <div className="best-case-panel">
          <div className="best-case-header">
            <Star size={15} className="best-case-star" />
            <span className="best-case-title">{currentMonth} 베스트 우수사례</span>
          </div>
          {bestCase ? (
            <button
              className="best-case-item"
              onClick={() => openCaseDetail(bestCase.id)}
            >
              <div className="best-case-badge">선정</div>
              <p className="best-case-name">{bestCase.title}</p>
              <p className="best-case-date">
                {bestCase.submittedAt?.slice(0, 10).replace(/-/g, '.')}
              </p>
              <span className="best-case-link">
                자세히 보기 <ChevronRight size={12} />
              </span>
            </button>
          ) : (
            <div className="best-case-empty">
              <Star size={24} />
              <p>이번 달 선정된 사례가 없습니다</p>
              <span>우수사례를 접수해 보세요!</span>
            </div>
          )}
        </div>

      </div>

      {/* ── 메인 그리드: 월별 차트(좌) + 최근 사례(우) ────────── */}
      <div className="home-main-grid">

        {/* 월별 접수 현황 차트 */}
        <div className="chart-card">
          <div className="card-section-header">
            <div className="title-indicator ti-blue" />
            <div>
              <h2 className="card-section-title">월별 접수 현황</h2>
              <p className="card-section-sub">나의 우수사례 접수 추이 ({currentYear}년 1월~12월)</p>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyChartData} barCategoryGap="18%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(219, 39, 119, 0.07)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#9d174d', opacity: 0.65 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#9d174d', opacity: 0.55 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: '#831843' }}>{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="submitted"
                  name="접수건"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#6ee7b7', strokeWidth: 0 }}
                  activeDot={{ r: 5.5 }}
                />
                <Bar
                  dataKey="selected"
                  name="선정건"
                  fill="#f472b6"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 최근 접수 사례 */}
        <div className="recent-card">
          <div className="recent-card-header">
            <div className="card-section-header" style={{ marginBottom: 0 }}>
              <div className="title-indicator ti-green" />
              <div>
                <h2 className="card-section-title">최근 접수 사례</h2>
                <p className="card-section-sub">최근 5건의 사례</p>
              </div>
            </div>
            {cases.length > 5 && (
              <button type="button" className="view-all-link" onClick={openCaseListModal}>
                전체 보기 <ChevronRight size={14} />
              </button>
            )}
          </div>

          {recentCases.length === 0 ? (
            <div className="empty-state">
              <Clock size={32} />
              <h3>접수한 사례가 없습니다</h3>
              <p>위 버튼을 눌러 첫 번째 우수사례를 접수해보세요.</p>
            </div>
          ) : (
            <>
              <div className="case-list-stack">
                {recentCases.map((c) => (
                  <button
                    key={c.id}
                    className="case-stack-row"
                    onClick={() => openCaseDetail(c.id)}
                  >
                    <div className="case-stack-left">
                      <span className={`case-dot case-dot-${c.status}`} />
                      <div className="case-stack-info">
                        <span className="case-stack-title">{c.title}</span>
                        <span className="case-stack-date">
                          {c.submittedAt?.slice(0, 10).replace(/-/g, '.')}
                        </span>
                      </div>
                    </div>
                    <span className={`case-status-badge badge-${c.status}`}>
                      {STATUS_ICON[c.status]}
                      {STATUS_LABEL[c.status]}
                    </span>
                  </button>
                ))}
              </div>
              <button type="button" className="view-all-btn" onClick={openCaseListModal}>
                내 사례 전체 보기 <ChevronRight size={14} />
              </button>
            </>
          )}
        </div>

      </div>

    </div>
  );
}
