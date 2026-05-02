import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemberModalStore } from '../../store/memberModalStore';
import { Sparkles, ChevronRight, Medal, Zap, Trophy } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMemberHome, fetchMyCases } from '../../api/memberApi';
import Skeleton from '../../components/common/Skeleton';
import StatusBadge from '../../components/common/StatusBadge';
import '../admin/DashboardPage.css';
import './HomePage.css';

const now = new Date();
const currentMonthNum = now.getMonth() + 1;

/** 월별 반영 시점·조건 (백엔드 스케줄러와 동일 개념) */
const PAYOUT_POLICY_LINES = [
  <>매년 <strong>1~9월</strong> 프로그램 기간, <strong>다음 달 1일 18시</strong>에 전월 실적이 반영됩니다.</>,
  <>부서 스킬 <strong>만족도 목표 달성</strong> 월에만 그달 선정 건이 인증·누적되며, 반영 건이 <strong>1건 이상</strong>일 때만 해당 월 등급 단가가 지급됩니다.</>,
  <>만족도만 달성하고 선정이 없으면 그달 지급은 없고, 누적·등급은 그대로 유지됩니다.</>,
];

const TIERS = [
  { id: 'mangju', name: 'YOU 망주', range: '1건 이상', minCases: 1, rateWon: 30000 },
  { id: 'player', name: 'YOU 플레이어', range: '10건 이상', minCases: 10, rateWon: 50000 },
  { id: 'topia', name: 'YOU 토피아', range: '19건 이상', minCases: 19, rateWon: 70000 },
];

const TIER_ICONS = {
  mangju: Medal,
  player: Zap,
  topia: Trophy,
};

function getTierIdx(n) {
  if (n >= 19) return 2;
  if (n >= 10) return 1;
  if (n >= 1) return 0;
  return -1;
}

function formatPreviewDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatWon(won) {
  const n = Number(won);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ko-KR')}원`;
}

function TierSatBadge({ met, hasTarget }) {
  const base = 'hp-tier-sat-badge hp-tier-sat-badge--apple';
  if (!hasTarget) {
    return <span className={`${base} hp-tier-sat-badge--muted`}>목표 없음</span>;
  }
  if (met === true) {
    return <span className={`${base} hp-tier-sat-badge--met`}>달성</span>;
  }
  if (met === false) {
    return <span className={`${base} hp-tier-sat-badge--no`}>미달</span>;
  }
  return null;
}

function reflectCsDotClass(met) {
  if (met === true) return 'hp-reflect-dot hp-reflect-dot--met';
  if (met === false) return 'hp-reflect-dot hp-reflect-dot--no';
  return 'hp-reflect-dot hp-reflect-dot--na';
}

function reflectRawRowClass(raw) {
  if (raw == null) return 'hp-reflect-raw hp-reflect-raw--na';
  if (Number(raw) > 0) return 'hp-reflect-raw hp-reflect-raw--hit';
  return 'hp-reflect-raw hp-reflect-raw--zero';
}

function reflectPickSegText(raw) {
  if (raw == null) return '—';
  return String(Number(raw));
}

function reflectCsTitle(met) {
  if (met === true) return '만족도 달성';
  if (met === false) return '만족도 미달';
  return '반영 전';
}

function reflectPickTitle(raw) {
  if (raw == null) return '반영 전';
  return `선정 raw ${Number(raw)}건`;
}

function HomeSkeleton({ userName }) {
  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in yp-home hp-home">
      <header className="hp-header">
        <div className="hp-header-text">
          <h1 className="hp-header-title">나의 YOU PRO</h1>
          <p className="hp-header-sub">{userName ?? '구성원'}님</p>
        </div>
        <div className="hp-header-actions">
          <Skeleton width={96} height={34} radius={10} />
        </div>
      </header>

      <aside className="hp-program-note">
        <Skeleton variant="text" width={140} height={13} />
        <Skeleton variant="text" width="100%" height={36} />
      </aside>

      <section className="hp-hero">
        <div className="hp-month-block hp-month-block--main">
          <div className="hp-month-block-header">
            <div className="hp-month-block-title-wrap">
              <Skeleton variant="text" width={110} height={14} />
              <Skeleton width={88} height={22} radius={999} />
            </div>
            <Skeleton variant="text" width={56} height={12} />
          </div>
          <div className="hp-month-block-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="hp-month-block-item">
                <Skeleton variant="text" width={40} height={11} />
                <Skeleton variant="text" width={36} height={28} />
              </div>
            ))}
          </div>
          <div className="hp-month-preview hp-month-preview--loading">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={38} radius={8} />
            ))}
          </div>
        </div>
        <div className="hp-hero-compact">
          <Skeleton variant="text" width="100%" height={14} />
        </div>
      </section>

      <section className="hp-card hp-tier-dash hp-tier-dash--loading">
        <div className="hp-tier-dash-hd">
          <Skeleton variant="text" width={120} height={14} />
        </div>
        <div className="hp-tier-sheet hp-tier-sheet--loading">
          <div className="hp-tier-main-grid">
            <div className="hp-tier-main-col">
              <Skeleton height={88} radius={12} />
              <Skeleton height={56} radius={10} />
              <Skeleton height={80} radius={10} />
            </div>
            <Skeleton width={118} height={108} radius={10} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuthStore();
  const openSubmit = useMemberModalStore((s) => s.openSubmit);

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

  const { monthStats, monthPreviewCases } = useMemo(() => {
    const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let selected = 0;
    let pending = 0;
    let rejected = 0;
    const thisMonthCases = [];
    cases.forEach((c) => {
      const key = (c.month || c.submittedAt || '').slice(0, 7);
      if (key !== mk) return;
      thisMonthCases.push(c);
      if (c.status === 'selected') selected++;
      else if (c.status === 'pending') pending++;
      else if (c.status === 'rejected') rejected++;
    });
    thisMonthCases.sort((a, b) => {
      const ta = new Date(a.submittedAt || 0).getTime();
      const tb = new Date(b.submittedAt || 0).getTime();
      return tb - ta;
    });
    return {
      monthStats: { selected, pending, rejected },
      monthPreviewCases: thisMonthCases.slice(0, 3),
    };
  }, [cases]);

  if (isLoading || !data) return <HomeSkeleton userName={user?.name} />;
  if (isError) return <div className="hp-error">오류: {error?.message}</div>;

  const {
    totalReflectedWon = 0,
    currentMonthCsTargetMet = null,
    csSkillTargetPercent = null,
    yearReflectCumulativeCount = 0,
    reflectMonthsJanSep = [],
  } = data;

  const csHasTarget =
    csSkillTargetPercent != null && Number(csSkillTargetPercent) > 0;

  const cumulative = yearReflectCumulativeCount;
  const tierIdx = getTierIdx(cumulative);

  const reflectRows =
    reflectMonthsJanSep.length >= 9
      ? reflectMonthsJanSep
      : Array.from({ length: 9 }, (_, i) => {
          const m = i + 1;
          const hit = reflectMonthsJanSep.find((r) => r.month === m);
          return hit ?? { month: m, csTargetMet: null, selectedCountRaw: null };
        });

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp fade-in yp-home hp-home">

      <header className="hp-header">
        <div className="hp-header-text">
          <h1 className="hp-header-title">나의 YOU PRO</h1>
          <p className="hp-header-sub">{user?.name ?? '구성원'}님</p>
        </div>
        <div className="hp-header-actions">
          <button type="button" className="hp-btn hp-btn--primary" onClick={openSubmit}>
            <Sparkles size={15} strokeWidth={2.25} />
            사례 접수
          </button>
        </div>
      </header>

      <aside className="hp-program-note" aria-label="인센티브 반영 안내">
        <p className="hp-program-note-title">인센티브 반영 안내</p>
        <ul className="hp-program-note-list">
          {PAYOUT_POLICY_LINES.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </aside>

      <section className="hp-hero">
        <div className="hp-month-block hp-month-block--main">
          <div className="hp-month-block-header">
            <div className="hp-month-block-title-wrap">
              <span className="hp-month-block-title">{currentMonthNum}월 접수 현황</span>
              {currentMonthCsTargetMet === true && (
                <span className="hp-month-cs hp-month-cs--met">만족도 달성 완료</span>
              )}
              {currentMonthCsTargetMet === false && (
                <span className="hp-month-cs hp-month-cs--no">만족도 달성 필요</span>
              )}
            </div>
            <Link to="/member/cases" className="hp-month-block-link">
              전체보기 <ChevronRight size={12} strokeWidth={2.5} />
            </Link>
          </div>
          <div className="hp-month-block-grid">
            <div className="hp-month-block-item hp-month-block-item--selected">
              <span className="hp-month-block-item-label-top">선정</span>
              <div className="hp-month-block-num-row">
                <span className="hp-month-block-val">{monthStats.selected}</span>
                <span className="hp-month-block-unit">건</span>
              </div>
            </div>
            <div className="hp-month-block-item hp-month-block-item--pending">
              <span className="hp-month-block-item-label-top">심사 중</span>
              <div className="hp-month-block-num-row">
                <span className="hp-month-block-val">{monthStats.pending}</span>
                <span className="hp-month-block-unit">건</span>
              </div>
            </div>
            <div className="hp-month-block-item hp-month-block-item--rejected">
              <span className="hp-month-block-item-label-top">비선정</span>
              <div className="hp-month-block-num-row">
                <span className="hp-month-block-val">{monthStats.rejected}</span>
                <span className="hp-month-block-unit">건</span>
              </div>
            </div>
          </div>

          <div className="hp-month-preview">
            <div className="hp-month-preview-head">
              <span className="hp-month-preview-label">이달 접수 미리보기</span>
              <span className="hp-month-preview-hint">최신순 최대 3건</span>
            </div>
            {monthPreviewCases.length === 0 ? (
              <p className="hp-month-preview-empty">이번 달 접수 내역이 없습니다.</p>
            ) : (
              <ul className="hp-month-preview-list">
                {monthPreviewCases.map((c) => (
                  <li key={c.id}>
                    <Link to="/member/cases" className="hp-month-preview-row" aria-label={`${c.title || '사례'} 상세 목록으로 이동`}>
                      <span className="hp-month-preview-date">{formatPreviewDate(c.submittedAt)}</span>
                      <span className="hp-month-preview-title" title={c.title || ''}>
                        {c.title?.trim() ? c.title : '제목 없음'}
                      </span>
                      <ChevronRight size={14} strokeWidth={2.25} className="hp-month-preview-chev" aria-hidden />
                      <span className="hp-month-preview-badge">
                        <StatusBadge status={c.status} size="sm" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="hp-card hp-tier-dash" aria-label="등급과 인센티브">
        <header className="hp-tier-dash-hd">
          <h2 className="hp-tier-dash-title">등급 · 인센티브</h2>
        </header>

        <div className="hp-tier-sheet">
          <div className="hp-tier-main-grid">
            <div className="hp-tier-main-col">
              <div className="hp-tier-kpis">
                <div className="hp-tier-kpi hp-tier-kpi--combined">
                  <span className="hp-tier-kpi-label">현재 누적 금액</span>
                  <span className="hp-tier-kpi-value">{formatWon(totalReflectedWon)}</span>
                  <span className="hp-tier-kpi-sub">
                    반영 누적{' '}
                    <span className="hp-tier-kpi-sub-num">{cumulative}</span>
                    건
                  </span>
                </div>
                <div className="hp-tier-kpi">
                  <span className="hp-tier-kpi-label">{currentMonthNum}월 만족도</span>
                  <span className="hp-tier-kpi-value hp-tier-kpi-value--badge">
                    <TierSatBadge met={currentMonthCsTargetMet} hasTarget={csHasTarget} />
                  </span>
                </div>
              </div>

              <p className="hp-tier-policy" role="note">
                만족도 목표에 <strong>미달</strong>한 달의 선정 건수는 인센티브 반영 기준으로{' '}
                <strong>무효</strong> 처리되어 누적 실적·지급에 포함되지 않습니다.
              </p>

              <div className="hp-tier-month" role="group" aria-label="1월부터 9월 반영">
                <div className="hp-tier-month-hd">
                  <span className="hp-tier-month-title">1–9월</span>
                  <span className="hp-tier-month-legend">
                    <span className="hp-tier-month-legend-i">
                      <span className="hp-reflect-dot hp-reflect-dot--met" />달성
                    </span>
                    <span className="hp-tier-month-legend-i">
                      <span className="hp-reflect-dot hp-reflect-dot--no" />미달
                    </span>
                    <span className="hp-tier-month-legend-i">
                      <span className="hp-reflect-dot hp-reflect-dot--na" />대기
                    </span>
                    <span className="hp-tier-month-legend-sep">·</span>
                    <span>숫자 = raw</span>
                    <span className="hp-tier-month-legend-sep">·</span>
                    <span className="hp-tier-month-legend-note">미달 시 선정 무효</span>
                  </span>
                </div>

                <div className="hp-reflect-rail-scroll">
                  <div className="hp-reflect-rail hp-reflect-rail--inset">
                    {reflectRows.map((row) => (
                      <div
                        key={row.month}
                        className="hp-reflect-node"
                        title={`${row.month}월 · ${reflectCsTitle(row.csTargetMet)} · ${reflectPickTitle(row.selectedCountRaw)}`}
                      >
                        <span className="hp-reflect-node-month">{row.month}</span>
                        <span className={reflectCsDotClass(row.csTargetMet)} />
                        <span className={reflectRawRowClass(row.selectedCountRaw)}>
                          {reflectPickSegText(row.selectedCountRaw)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <aside className="hp-tier-rank-aside" aria-label="등급표">
              <span className="hp-tier-rank-aside-title">등급</span>
              <ul className="hp-tier-rank-list">
                {TIERS.map((tier, i) => {
                  const TierIcon = TIER_ICONS[tier.id];
                  return (
                    <li
                      key={tier.id}
                      className={`hp-tier-rank-row hp-tier-rank-row--${tier.id}${i === tierIdx ? ' is-current' : ''}`}
                    >
                      <span className="hp-tier-rank-icon-wrap" aria-hidden>
                        <TierIcon className="hp-tier-rank-icon" size={15} strokeWidth={2.25} />
                      </span>
                      <div className="hp-tier-rank-body">
                        <span className="hp-tier-rank-name">{tier.name.replace('YOU ', '')}</span>
                        <span className="hp-tier-rank-line">
                          <span className="hp-tier-rank-range">{tier.range.replace(' 이상', '')}</span>
                          <span className="hp-tier-rank-sep">·</span>
                          <span className="hp-tier-rank-won">{tier.rateWon / 10000}만</span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </aside>
          </div>

          <p className="hp-tier-footnote">
            금액은 반영된 지급 합계이며, 건수는 최근 반영 월{' '}
            <code className="hp-tier-code">cumulative_count</code>입니다. 월별은 반영 후{' '}
            <code className="hp-tier-code">cs_target_met</code> ·{' '}
            <code className="hp-tier-code">selected_count_raw</code>. 미달 월은 선정이 반영되지 않습니다.
          </p>
        </div>
      </section>

    </div>
  );
}
