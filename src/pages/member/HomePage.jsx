import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemberModalStore } from '../../store/memberModalStore';
import {
  Sparkles,
  ClipboardList,
  ChevronRight,
  Flame,
  Zap,
  Crown,
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
const currentMonthNum = now.getMonth() + 1; // 1-12

const HOME_MONTHLY_CHART_PX = 200;

/** 프로그램 운영 기간: 매년 1월~9월, 9월 말 최종 정산 */
const PROGRAM_END_MONTH = 9;

/**
 * 등급 구간별 건당 단가.
 * 등급 달성 시 해당 기간의 전체 선정 건에 해당 단가가 적용됩니다.
 */
const TIERS = [
  { id: 'mangju', name: 'YOU 망주',    range: '1~9건',   minCases: 1,  maxCases: 9,       rateWon: 30000, Icon: Flame  },
  { id: 'player', name: 'YOU 플레이어', range: '10~18건', minCases: 10, maxCases: 18,      rateWon: 50000, Icon: Zap    },
  { id: 'topia',  name: 'YOU 토피아',  range: '19건~',   minCases: 19, maxCases: Infinity, rateWon: 70000, Icon: Crown  },
];

function getTierIdx(count) {
  if (count >= 19) return 2;
  if (count >= 10) return 1;
  if (count >= 1)  return 0;
  return -1;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="yp-chart-tooltip">
      <p className="yp-chart-tooltip-label">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="yp-chart-tooltip-item">
          <span
            className="yp-chart-tooltip-dot"
            style={{ background: entry.fill || entry.color || entry.stroke }}
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
      months.push({ monthKey, label: `${m}월`, selected: row.selected, submitted });
    }
    return months;
  }, [cases]);

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

  const monthSubmissionPreview = useMemo(() => {
    const d = new Date();
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let selected = 0, pending = 0, rejected = 0;
    cases.forEach((c) => {
      const key = (c.month || c.submittedAt || '').slice(0, 7);
      if (key !== mk) return;
      if (c.status === 'selected') selected += 1;
      else if (c.status === 'pending') pending += 1;
      else if (c.status === 'rejected') rejected += 1;
    });
    return { applied: selected + pending + rejected, selected, rejected, pending };
  }, [cases]);

  if (isLoading || !data) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }
  if (isError) return <div className="home-error">오류: {error?.message}</div>;

  const {
    myTotalSelected = 0,
    monthlySelected = 0,
    monthlyLimit = 3,
    evalCenterInScope = false,
    evalCenterTeamRank,
    evalCenterTeamTotal = 0,
    evalCenterTeamSelectedYear = 0,
    myIndividualRank,
    individualRankTotal = 0,
  } = data;

  /* ── 인센티브 등급 계산 ─────────────────────────────── */
  const isInProgramPeriod = currentMonthNum >= 1 && currentMonthNum <= PROGRAM_END_MONTH;
  const fullMonthsAfterCurrent = isInProgramPeriod
    ? Math.max(0, PROGRAM_END_MONTH - currentMonthNum)
    : 0;
  const remainingThisMonth = isInProgramPeriod
    ? Math.max(0, monthlyLimit - monthlySelected)
    : 0;
  const maxAdditionalCases = fullMonthsAfterCurrent * monthlyLimit + remainingThisMonth;

  const currentTierIdx = getTierIdx(myTotalSelected);
  const currentTier    = currentTierIdx >= 0 ? TIERS[currentTierIdx] : null;
  const nextTierIdx    = currentTierIdx < TIERS.length - 1 ? currentTierIdx + 1 : -1;
  const nextTier       = nextTierIdx >= 0 ? TIERS[nextTierIdx] : null;

  const estimatedIncentiveWon  = currentTier ? myTotalSelected * currentTier.rateWon : 0;
  const casesToNextTier        = nextTier ? nextTier.minCases - myTotalSelected : 0;
  // 다음 등급 진입 즉시(= nextTier.minCases 건 달성 시) 예상 인센티브
  const incentiveAtNextEntry   = nextTier ? nextTier.minCases * nextTier.rateWon : 0;
  const incentiveBoost         = Math.max(0, incentiveAtNextEntry - estimatedIncentiveWon);
  const isNextTierAchievable   = nextTier !== null && casesToNextTier <= maxAdditionalCases;

  // 현재 등급 내 진행 %
  const tierProgressPct = currentTier
    ? currentTier.maxCases === Infinity
      ? 100
      : (myTotalSelected / currentTier.maxCases) * 100
    : 0;

  const monthlyPct = Math.min((monthlySelected / monthlyLimit) * 100, 100);

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in yp-home">
      <header className="adm-header adm-header--yp">
        <div className="adm-header-row">
          <div className="adm-header-text">
            <h1 className="adm-title">나의 YOU PRO</h1>
            <p className="adm-sub">
              {user?.name ?? '구성원'}님 · 선정 건수에 따라 등급이 오르고 인센티브 단가가 높아집니다.
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

      {/* ① INCENTIVE ─────────────────────────────────────────── */}
      <div className="yp-inca">

        {/* 헤더 */}
        <div className="yp-inca-header">
          <div className="yp-inca-header-left">
            <span className="yp-inca-title">연간 인센티브</span>
            <span className="yp-inca-chip">9월 지급 예정</span>
            {isInProgramPeriod && fullMonthsAfterCurrent > 0 && (
              <span className="yp-inca-chip yp-inca-chip--blue">{fullMonthsAfterCurrent}개월 남음</span>
            )}
            {isInProgramPeriod && fullMonthsAfterCurrent === 0 && (
              <span className="yp-inca-chip yp-inca-chip--amber">이번 달 마감</span>
            )}
          </div>
        </div>

        {/* 바디 */}
        <div className="yp-inca-body">

          {/* 왼쪽: 금액 */}
          <div className="yp-inca-left">
            <div className="yp-inca-amount-block">
              <span className="yp-inca-amount-label">올해 예상 인센티브 적립금</span>
              <div className="yp-inca-amount-row">
                <span className="yp-inca-count-prefix">총</span>
                <span className="yp-inca-amount">
                  {estimatedIncentiveWon > 0 ? estimatedIncentiveWon.toLocaleString('ko-KR') : '—'}
                </span>
                {estimatedIncentiveWon > 0 && <span className="yp-inca-won">원</span>}
              </div>
              <span className="yp-inca-formula">
                {currentTier
                  ? `선정 ${myTotalSelected}건 × ${currentTier.rateWon.toLocaleString('ko-KR')}원/건`
                  : '선정 1건부터 인센티브 시작'}
              </span>
            </div>
            <div className="yp-inca-count-row">
              <span className="yp-inca-count-prefix">연간</span>
              <span className="yp-inca-count-num">{myTotalSelected}</span>
              <span className="yp-inca-count-unit">건 선정</span>
            </div>
          </div>

          <div className="yp-inca-sep" aria-hidden />

          {/* 오른쪽: 등급표 + 다음 등급 */}
          <div className="yp-inca-right">
            <div className="yp-inca-tiers">
              <div className="yp-inca-tier-head">
                <span />
                <span>등급</span>
                <span>선정 기준</span>
                <span>건당 금액</span>
              </div>
              {TIERS.map((tier, i) => {
                const isActive = i === currentTierIdx;
                const isDone   = i < currentTierIdx;
                return (
                  <div
                    key={tier.id}
                    className={`yp-inca-tier-row yp-inca-tier-row--${tier.id}${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
                  >
                    <span className={`yp-inca-tier-icon yp-inca-tier-icon--${tier.id}`} aria-hidden>
                      <tier.Icon size={14} strokeWidth={2.25} />
                    </span>
                    <span className="yp-inca-tier-name">{tier.name}</span>
                    <span className="yp-inca-tier-range">{tier.range}</span>
                    <span className="yp-inca-tier-rate">
                      {tier.rateWon.toLocaleString('ko-KR')}원<span className="yp-inca-tier-per">/건</span>
                    </span>
                    {isActive && <span className="yp-inca-tier-here">현재</span>}
                  </div>
                );
              })}
            </div>

            {isInProgramPeriod && nextTier && (
              <div className="yp-inca-msg">
                <span className="yp-inca-msg-ico" aria-hidden>
                  <Sparkles size={13} strokeWidth={2} />
                </span>
                <div className="yp-inca-msg-body">
                  <p className="yp-inca-msg-primary">
                    <strong className="yp-inca-msg-highlight">+{incentiveBoost.toLocaleString('ko-KR')}원</strong>을 더 받고 싶으시다면{' '}
                    <strong>{casesToNextTier}건</strong>을 추가 달성하여{' '}
                    <strong>{nextTier.name}</strong>이 되세요.
                  </p>
                </div>
              </div>
            )}
            {isInProgramPeriod && !nextTier && currentTier && (
              <div className="yp-inca-msg yp-inca-msg--max">
                <span className="yp-inca-msg-ico yp-inca-msg-ico--green" aria-hidden>🏆</span>
                <div className="yp-inca-msg-body">
                  <p className="yp-inca-msg-primary yp-inca-msg-primary--green">
                    최고 등급 <strong>YOU 토피아</strong>를 달성하셨습니다!
                  </p>
                  <p className="yp-inca-msg-secondary">
                    건당 70,000원이 적용 중입니다. 계속 달성해 보세요.
                  </p>
                </div>
              </div>
            )}
            {!isInProgramPeriod && (
              <div className="yp-inca-msg yp-inca-msg--ended">
                <div className="yp-inca-msg-body">
                  <p className="yp-inca-msg-primary">{currentYear}년 프로그램이 종료되었습니다.</p>
                  <p className="yp-inca-msg-secondary">9월 말 최종 정산이 완료되었습니다.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ② 하단: 내 사례 목록(통합) + 월별 추이 차트 ────────── */}
      <div className="yp-bottom-row">

        {/* 내 사례 목록 + 연간 링 진행 + 이번달 현황 */}
        <Link className="yp-casesm" to="/member/cases">
          <div className="yp-casesm-header">
            <div className="yp-casesm-header-left">
              <span className="yp-casesm-ico" aria-hidden>
                <ClipboardList size={18} strokeWidth={2} />
              </span>
              <div>
                <span className="yp-casesm-title">내 사례 목록</span>
                <span className="yp-casesm-sub">접수·대기·선정 상태를 한곳에서</span>
              </div>
            </div>
            <ChevronRight size={16} className="yp-casesm-arrow" aria-hidden />
          </div>

          <div className="yp-casesm-content">
            {/* 연간 링 차트 */}
            {(() => {
              const annualMax = PROGRAM_END_MONTH * monthlyLimit;
              const progress = annualMax > 0 ? Math.min(myTotalSelected / annualMax, 1) : 0;
              const R = 38;
              const circ = 2 * Math.PI * R;
              const offset = circ * (1 - progress);
              const ringColor = currentTierIdx === 2 ? '#34d399' : currentTierIdx === 1 ? '#60a5fa' : currentTierIdx === 0 ? '#fbbf24' : '#0071e3';
              return (
                <div className="yp-casesm-ring-col">
                  <svg viewBox="0 0 100 100" className="yp-casesm-ring-svg" aria-hidden>
                    <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="9" />
                    <circle
                      cx="50" cy="50" r={R} fill="none"
                      stroke={ringColor} strokeWidth="9"
                      strokeDasharray={circ} strokeDashoffset={offset}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                      style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                  </svg>
                  <div className="yp-casesm-ring-center">
                    <div className="yp-casesm-ring-num">
                      <span className="yp-casesm-ring-val">{myTotalSelected}</span>
                      <span className="yp-casesm-ring-slash">/</span>
                      <span className="yp-casesm-ring-max-inline">{annualMax}</span>
                    </div>
                  </div>
                  <span className="yp-casesm-ring-desc">연간 선정 한도</span>
                </div>
              );
            })()}

            {/* 이번 달 현황 */}
            <div className="yp-casesm-side">
              <span className="yp-casesm-month-chip">{currentMonth} 접수현황</span>
              <div className="yp-casesm-chips">
                <div className="yp-casesm-chip yp-casesm-chip--selected">
                  <span className="yp-casesm-chip-val">{monthSubmissionPreview.selected}</span>
                  <span className="yp-casesm-chip-label">선정</span>
                </div>
                <div className="yp-casesm-chip yp-casesm-chip--pending">
                  <span className="yp-casesm-chip-val">{monthSubmissionPreview.pending}</span>
                  <span className="yp-casesm-chip-label">대기</span>
                </div>
                <div className="yp-casesm-chip yp-casesm-chip--rejected">
                  <span className="yp-casesm-chip-val">{monthSubmissionPreview.rejected}</span>
                  <span className="yp-casesm-chip-label">비선정</span>
                </div>
              </div>
              <div className="yp-casesm-limit-row">
                <span>이번 달 한도</span>
                <span className="yp-casesm-limit-count">{monthlySelected} / {monthlyLimit}건</span>
              </div>
              <div className="yp-casesm-track">
                <div className="yp-casesm-fill" style={{ width: `${monthlyPct}%` }} />
              </div>
            </div>
          </div>

          {/* 최근 접수 3건 */}
          {(() => {
            const recent = [...cases]
              .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
              .slice(0, 3);
            if (recent.length === 0) return null;
            const statusMeta = {
              selected: { label: '선정', cls: 'selected' },
              pending:  { label: '대기', cls: 'pending' },
              rejected: { label: '비선정', cls: 'rejected' },
            };
            return (
              <div className="yp-casesm-recent">
                <span className="yp-casesm-recent-label">최근 접수</span>
                <ul className="yp-casesm-recent-list">
                  {recent.map((c) => {
                    const meta = statusMeta[c.status] ?? { label: c.status, cls: 'pending' };
                    const dateStr = (c.submittedAt || '').slice(0, 10);
                    return (
                      <li key={c.caseId} className="yp-casesm-recent-item">
                        <span className={`yp-casesm-recent-badge yp-casesm-recent-badge--${meta.cls}`}>{meta.label}</span>
                        <span className="yp-casesm-recent-title">{c.title || '(제목 없음)'}</span>
                        <span className="yp-casesm-recent-date">{dateStr}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}
        </Link>

        <div className="yp-mini-chart-card" id="home-monthly-chart">
          <div className="yp-mini-chart-head">
            <h3 className="yp-mini-chart-title">월별 접수·선정 추이</h3>
            <p className="yp-mini-chart-sub">{currentYear}년 1~9월 · 나의 사례</p>
          </div>

          <div className="yp-mini-chart-stats">
            {myIndividualRank != null && individualRankTotal > 0 && (
              <>
                <div className="yp-mini-stat">
                  <span className="yp-mini-stat-label">전체 랭킹</span>
                  <div className="yp-mini-stat-val-row">
                    <span className="yp-mini-stat-num yp-mini-stat-num--rank">{myIndividualRank}</span>
                    <span className="yp-mini-stat-unit yp-mini-stat-unit--rank">위</span>
                  </div>
                  <span className="yp-mini-stat-sub">전체 {individualRankTotal}명 중</span>
                </div>
                <div className="yp-mini-stat-div" />
              </>
            )}
            <div className="yp-mini-stat">
              <span className="yp-mini-stat-label">연간 인증률</span>
              <div className="yp-mini-stat-val-row">
                <span className="yp-mini-stat-num">{myYearCertRate.ratePct.toFixed(0)}</span>
                <span className="yp-mini-stat-unit">%</span>
              </div>
              <span className="yp-mini-stat-sub">{myYearCertRate.certified}/{myYearCertRate.submitted}건</span>
            </div>
          </div>

          <div className="yp-mini-chart-wrap">
            <ResponsiveContainer width="100%" height={HOME_MONTHLY_CHART_PX} minWidth={0}>
              <ComposedChart
                data={monthlyChartData}
                barCategoryGap="14%"
                margin={{ top: 2, right: 4, left: -14, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#aeaeb2', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={28}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#aeaeb2', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={22}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: '#6e6e73', fontWeight: 500 }}>{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="submitted"
                  name="접수"
                  stroke="#0071e3"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#0071e3', strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
                <Bar
                  dataKey="selected"
                  name="선정"
                  fill="#30d158"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
