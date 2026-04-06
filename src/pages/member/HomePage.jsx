import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemberModalStore } from '../../store/memberModalStore';
import {
  Sparkles,
  TrendingUp,
  Award,
  BadgeCheck,
  PiggyBank,
  ClipboardList,
  ListOrdered,
  ChevronRight,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import useAuthStore from '../../store/authStore';
import { fetchMemberHome, fetchMyCases } from '../../api/memberApi';
import '../admin/DashboardPage.css';
import './HomePage.css';

const now = new Date();
const currentMonth = now.toLocaleDateString('ko-KR', { month: 'long' });
const currentYear = now.getFullYear();

/** Recharts ResponsiveContainer: 부모 % 높이 미확정 시 width/height -1 오류 방지 */
const HOME_MONTHLY_CHART_PX = 200;

/** 홈 프로필 인사 옆에 붙는 YOU PRO 시스템 아이덴티티 멘트 */
const MEMBER_IDENTITY_MENT = '우수 상담을 프로답게 기록하는 YOU PRO';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="yp-chart-tooltip">
      <p className="yp-chart-tooltip-label">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="yp-chart-tooltip-item">
          <span
            className="yp-chart-tooltip-dot"
            style={{
              background: entry.fill || entry.color || entry.stroke,
            }}
          />
          <span>
            {entry.name}: {entry.value}건
          </span>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuthStore();
  const openSubmitModal = useMemberModalStore((s) => s.openSubmit);

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

  /** 올해(접수일·month 기준) 접수 건수 대비 선정(인증) 건수 → 인증률 */
  const myYearCertRate = useMemo(() => {
    const y = String(currentYear);
    let submitted = 0;
    let certified = 0;
    for (const c of cases) {
      const raw = c.month || c.submittedAt || '';
      if (typeof raw !== 'string' || raw.length < 4) continue;
      if (raw.slice(0, 4) !== y) continue;
      submitted += 1;
      if (c.status === 'selected') certified += 1;
    }
    const ratePct = submitted === 0 ? 0 : (certified / submitted) * 100;
    return { submitted, certified, ratePct };
  }, [cases, currentYear]);

  /** 이번 달(접수일·month 기준) 신청·선정·비선정·대기 건수 */
  const monthSubmissionPreview = useMemo(() => {
    const d = new Date();
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let selected = 0;
    let pending = 0;
    let rejected = 0;
    cases.forEach((c) => {
      const key = (c.month || c.submittedAt || '').slice(0, 7);
      if (key !== mk) return;
      if (c.status === 'selected') selected += 1;
      else if (c.status === 'pending') pending += 1;
      else if (c.status === 'rejected') rejected += 1;
    });
    const applied = selected + pending + rejected;
    return { applied, selected, rejected, pending };
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
    myTotalSelected = 0,
    monthlySelected = 0,
    monthlyLimit = 3,
    annualLimit = 36,
    evalCenterInScope = false,
    evalCenterTeamRank,
    evalCenterTeamTotal = 0,
    evalCenterTeamSelectedYear = 0,
  } = data;

  const annualPct = Math.min((myTotalSelected / annualLimit) * 100, 100);
  const monthlyPct = Math.min((monthlySelected / monthlyLimit) * 100, 100);
  const rewardPerCaseWon = 15000;
  const estimatedRewardWon = myTotalSelected * rewardPerCaseWon;
  const maxAnnualRewardWon = annualLimit * rewardPerCaseWon;
  /** 연간 선정 상한까지 남은 건수 (다음 인센티브·최대치 모두 이 숫자로 표현 가능) */
  const remainingCasesToAnnualCap = Math.max(0, annualLimit - myTotalSelected);

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in yp-home">
      <header className="adm-header adm-header--yp">
        <div className="adm-header-row">
          <div className="adm-header-text">
            <h1 className="adm-title">나의 YOU PRO</h1>
            <p className="adm-sub">
              {user?.name ?? '구성원'}님 · {MEMBER_IDENTITY_MENT} {currentYear}년 기준 선정·접수 현황과 인센티브를
              한눈에 확인하세요.
            </p>
          </div>
          <button
            type="button"
            className="adm-header-link adm-pending-btn--cute"
            onClick={openSubmitModal}
            aria-label="우수사례 사례 접수"
          >
            <span className="adm-pending-shine" aria-hidden />
            <span className="adm-pending-btn__inner">
              <Sparkles size={18} strokeWidth={2.25} aria-hidden />
              <span className="adm-pending-btn__label">사례 접수</span>
            </span>
            <ChevronRight className="adm-pending-btn__chev" size={18} strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </header>

      <div className="yp-kpi-row yp-kpi-row--4">
        <div className="yp-kpi-card yp-kpi-card--data">
          <div className="yp-kpi-head">
            <span className="yp-kpi-label">{currentYear}년 누적 선정</span>
            <div className="yp-kpi-ico yp-kpi-ico--amber">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="yp-kpi-values">
            <span className="yp-kpi-big">{myTotalSelected}</span>
            <span className="yp-kpi-unit">/ {annualLimit}건</span>
          </div>
          <div className="yp-kpi-bar">
            <div className="yp-kpi-fill yp-kpi-fill--amber" style={{ width: `${annualPct}%` }} />
          </div>
        </div>

        <div className="yp-kpi-card yp-kpi-card--monthly">
          <div className="yp-kpi-head">
            <span className="yp-kpi-label">{currentMonth} 선정</span>
            <div className="yp-kpi-ico yp-kpi-ico--blue">
              <Award size={18} />
            </div>
          </div>
          <div className="yp-kpi-values">
            <span className="yp-kpi-big">{monthlySelected}</span>
            <span className="yp-kpi-unit">/ {monthlyLimit}건</span>
          </div>
          <div className="yp-kpi-bar">
            <div className="yp-kpi-fill yp-kpi-fill--blue" style={{ width: `${monthlyPct}%` }} />
          </div>
        </div>

        <div className="yp-kpi-card yp-kpi-card--cert">
          <div className="yp-kpi-head">
            <span className="yp-kpi-label">{currentYear}년 나의 인증률</span>
            <div className="yp-kpi-ico yp-kpi-ico--green">
              <BadgeCheck size={18} />
            </div>
          </div>
          <div className="yp-kpi-values">
            <span className="yp-kpi-big" aria-label={`인증률 ${myYearCertRate.ratePct.toFixed(1)}퍼센트`}>
              {myYearCertRate.submitted === 0 ? '—' : `${myYearCertRate.ratePct.toFixed(1)}`}
            </span>
            <span className="yp-kpi-unit">{myYearCertRate.submitted === 0 ? '' : '%'}</span>
          </div>
          <p className="yp-kpi-compare yp-kpi-compare--cert-rate">
            {myYearCertRate.submitted === 0 ? (
              <span className="yp-kpi-cert-hint">올해 접수된 사례가 없습니다</span>
            ) : (
              <>
                <span className="yp-kpi-cert-line">
                  인증(선정) <strong>{myYearCertRate.certified}</strong>건
                </span>
                <span className="yp-kpi-cert-sep" aria-hidden>
                  ·
                </span>
                <span className="yp-kpi-cert-line">
                  접수 <strong>{myYearCertRate.submitted}</strong>건
                </span>
              </>
            )}
          </p>
        </div>

        <div className="yp-kpi-card yp-kpi-card--rank">
          <div className="yp-kpi-head">
            <span className="yp-kpi-label">팀 순위</span>
            <div className="yp-kpi-ico yp-kpi-ico--violet">
              <ListOrdered size={18} />
            </div>
          </div>
          {evalCenterInScope && evalCenterTeamRank != null ? (
            <>
              <div className="yp-kpi-values yp-kpi-values--rank">
                <span className="yp-kpi-big">{evalCenterTeamRank}</span>
                <span className="yp-kpi-unit">위</span>
              </div>
              <p className="yp-kpi-rank-note">
                전체 {evalCenterTeamTotal}팀 중 · 팀 연간 선정 합{' '}
                <strong>{Number(evalCenterTeamSelectedYear).toLocaleString('ko-KR')}건</strong>
              </p>
              <p className="yp-kpi-rank-scope">설정 부서 범위 내 · {currentYear}년 기준</p>
            </>
          ) : evalCenterInScope ? (
            <p className="yp-kpi-rank-out">순위를 표시할 팀 데이터가 없습니다.</p>
          ) : (
            <p className="yp-kpi-rank-out">
              설정된 부서 범위에 속한 팀이 아니면 순위가 표시되지 않습니다.
            </p>
          )}
        </div>
      </div>

      <div className="yp-quick-row yp-quick-row--two yp-home-section--below-kpi">
        <div className="yp-quick-col-stack yp-quick-col-stack--primary">
          <Link className="yp-quick-tile yp-quick-tile--list yp-feature-tile" to="/member/cases">
            <div className="yp-quick-tile-body">
              <div className="yp-quick-tile-head">
                <span className="yp-quick-tile-ico-wrap" aria-hidden>
                  <ClipboardList size={20} strokeWidth={2} />
                </span>
                <div className="yp-quick-tile-head-text">
                  <span className="yp-feature-pill">주요</span>
                  <span className="yp-quick-title">내 사례 목록</span>
                  <span className="yp-quick-sub">접수·대기·선정 상태를 한곳에서 확인</span>
                </div>
              </div>
              <div className="yp-quick-inlay" aria-label={`${currentMonth} 접수 현황`}>
                <div className="yp-quick-inlay-cap">
                  <span className="yp-quick-inlay-cap-title">이번 달 접수</span>
                  <span className="yp-quick-inlay-cap-month">{currentMonth}</span>
                </div>
                <div className="yp-quick-strip" role="group">
                  <div className="yp-quick-strip-item yp-quick-strip-item--applied">
                    <span className="yp-quick-strip-label">신청</span>
                    <span className="yp-quick-strip-value">
                      {monthSubmissionPreview.applied}
                      <span className="yp-quick-strip-unit">건</span>
                    </span>
                  </div>
                  <div className="yp-quick-strip-item yp-quick-strip-item--selected">
                    <span className="yp-quick-strip-label">선정</span>
                    <span className="yp-quick-strip-value">
                      {monthSubmissionPreview.selected}
                      <span className="yp-quick-strip-unit">건</span>
                    </span>
                  </div>
                  <div className="yp-quick-strip-item yp-quick-strip-item--rejected">
                    <span className="yp-quick-strip-label">비선정</span>
                    <span className="yp-quick-strip-value">
                      {monthSubmissionPreview.rejected}
                      <span className="yp-quick-strip-unit">건</span>
                    </span>
                  </div>
                  <div className="yp-quick-strip-item yp-quick-strip-item--pending">
                    <span className="yp-quick-strip-label">대기</span>
                    <span className="yp-quick-strip-value">
                      {monthSubmissionPreview.pending}
                      <span className="yp-quick-strip-unit">건</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          <div className="yp-mini-chart-card" id="home-monthly-chart">
            <div className="yp-mini-chart-head">
              <h3 className="yp-mini-chart-title">월별 접수·선정 추이</h3>
              <p className="yp-mini-chart-sub">{currentYear}년 1~12월 · 나의 사례</p>
            </div>
            <div className="yp-mini-chart-wrap">
              <ResponsiveContainer width="100%" height={HOME_MONTHLY_CHART_PX} minWidth={0}>
                <ComposedChart
                  data={monthlyChartData}
                  barCategoryGap="14%"
                  margin={{ top: 2, right: 4, left: -14, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.05)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: '#78716c' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={28}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={22}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconSize={7}
                    wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                    formatter={(value) => (
                      <span style={{ fontSize: 10, color: 'var(--yp-ink)' }}>{value}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="submitted"
                    name="접수"
                    stroke="#0a7ea4"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#0a7ea4', strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                  <Bar
                    dataKey="selected"
                    name="선정"
                    fill="#0f766e"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="yp-annual-panel yp-annual-panel--quick yp-data-hero">
          <div className="yp-passbook">
            <div className="yp-passbook-top">
              <div className="yp-passbook-brand">
                <span className="yp-passbook-ico" aria-hidden>
                  <PiggyBank size={22} strokeWidth={2} />
                </span>
                <div className="yp-passbook-brand-text">
                  <h3 className="yp-passbook-title">연간 인센티브 적금</h3>
                  <p className="yp-passbook-tagline">
                    {currentYear}년 · 선정 1건 적립 · 연간 <strong>{annualLimit}건</strong>까지
                  </p>
                </div>
              </div>
            </div>

            <div className="yp-passbook-balance">
              <span className="yp-passbook-balance-label">누적 인센티브(참고)</span>
              <span className="yp-passbook-balance-num">
                ~{estimatedRewardWon.toLocaleString('ko-KR')}원
              </span>
            </div>

            <div className="yp-passbook-goal">
              <span className="yp-passbook-goal-label">목표 금액(연간 최대)</span>
              <span className="yp-passbook-goal-num">
                ~{maxAnnualRewardWon.toLocaleString('ko-KR')}원
              </span>
            </div>

            <div className="yp-passbook-progress">
              <div className="yp-passbook-progress-row">
                <span className="yp-passbook-progress-label">
                  선정 {myTotalSelected}/{annualLimit}건
                </span>
                <span className="yp-passbook-progress-pct">{annualPct.toFixed(0)}%</span>
              </div>
              <div className="yp-passbook-track" role="presentation">
                <div className="yp-passbook-fill" style={{ width: `${annualPct}%` }} />
              </div>
              <div className="yp-passbook-track-scale">
                <span>0건</span>
                <span>{annualLimit}건 만기</span>
              </div>
            </div>

            <dl className="yp-passbook-lines">
              {remainingCasesToAnnualCap > 0 ? (
                <>
                  <div className="yp-passbook-line">
                    <dt>다음 적립까지</dt>
                    <dd>
                      선정 <strong>1</strong>건
                    </dd>
                  </div>
                  <div className="yp-passbook-line">
                    <dt>목표까지 남은 선정</dt>
                    <dd>
                      <strong>{remainingCasesToAnnualCap}</strong>건
                    </dd>
                  </div>
                </>
              ) : (
                <div className="yp-passbook-line yp-passbook-line--done">
                  <dt>상태</dt>
                  <dd>연간 선정 상한 도달(만기)</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
