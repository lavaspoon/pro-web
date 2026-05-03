import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemberModalStore } from '../../store/memberModalStore';
import { Plus, ChevronRight, Medal, Zap, Trophy, Check, X, BadgeCheck, ShieldAlert } from 'lucide-react';
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

function getReflectState(row) {
  if (row.csTargetMet == null) return 'na';
  return row.csTargetMet === true ? 'met' : 'no';
}

function ReflectTimeline({ rows, cumulative, onPickMonth }) {
  const items = rows.map((row) => {
    const baseState = getReflectState(row);
    const raw = row.selectedCountRaw == null ? 0 : Number(row.selectedCountRaw);
    const certified = baseState === 'met' ? (raw > 0 ? raw : 0) : 0;
    const isPast = row.month < currentMonthNum;
    const state = baseState === 'na' && isPast ? 'done' : baseState;
    return { month: row.month, raw, certified, state };
  });

  return (
    <section className="hp-rfx" role="group" aria-label="1월부터 9월 반영 타임라인">
      <header className="hp-rfx-hd">
        <h3 className="hp-rfx-title">월별 반영 현황</h3>
        <span className="hp-rfx-sub">1월 – 9월</span>
      </header>

      <ol className="hp-rfx-track">
        {items.map((it) => (
          <li key={it.month} className={`hp-rfx-cell hp-rfx-cell--${it.state}`}>
            <button
              type="button"
              className="hp-rfx-cell-btn"
              onClick={() => onPickMonth?.(it.month)}
              aria-label={`${it.month}월 사례 보기`}
            >
              <div className="hp-rfx-cell-head">
                <span className="hp-rfx-cell-month">{it.month}월</span>
                <span className="hp-rfx-cell-glyph" aria-hidden>
                  {it.state === 'met' && <Check size={9} strokeWidth={3.5} />}
                  {it.state === 'no' && <X size={9} strokeWidth={3.5} />}
                </span>
              </div>
              <div className="hp-r성fx-cell-body">
                <span className="hp-rfx-cell-num">{it.raw}건</span>
                <span className="hp-rfx-cell-cap">
                  {it.state === 'met' && `인증 완료`}
                  {it.state === 'no' && '만족도 미달성'}
                  {it.state === 'done' && '종료'}
                  {it.state === 'na' && '대기'}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ol>

      <footer className="hp-rfx-ft">
        <div className="hp-rfx-ft-l">
          <span className="hp-rfx-ft-label">올해 인증 누적</span>
          <span className="hp-rfx-ft-val">
            <strong>{cumulative}</strong>
            <span className="hp-rfx-ft-unit">건</span>
          </span>
        </div>
        <p className="hp-rfx-ft-help">
          만족도 달성한 달의 선정 건수만 인증으로 누적됩니다
        </p>
      </footer>
    </section>
  );
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

      <section className="hp-tier-block hp-tier-block--loading">
        <div className="hp-tier-block-header">
          <Skeleton variant="text" width={120} height={14} />
        </div>
        <div className="hp-tier-main">
          <div className="hp-tier-main-left">
            <Skeleton height={220} radius={12} />
          </div>
          <aside className="hp-tier-rank-aside-v2">
            <div className="hp-tier-rank-rows">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={56} radius={10} />
              ))}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuthStore();
  const openSubmit = useMemberModalStore((s) => s.openSubmit);
  const openCaseList = useMemberModalStore((s) => s.openCaseList);

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
          <button type="button" className="hp-btn hp-btn--submit" onClick={openSubmit}>
            <Plus size={15} strokeWidth={2.5} />
            사례 접수
          </button>
        </div>
      </header>

      <section className="hp-hero">
        <span className="hp-corner-tr" aria-hidden />
        <span className="hp-corner-bl" aria-hidden />
        <div className="hp-month-block hp-month-block--main">
          <div className="hp-month-block-header">
            <div className="hp-month-block-title-wrap">
              <span className="hp-month-block-title">{currentMonthNum}월 접수 현황</span>
              {currentMonthCsTargetMet === true && (
                <span className="hp-month-cs hp-month-cs--met hp-month-cs--seal">
                  <BadgeCheck size={13} strokeWidth={2.5} aria-hidden />
                  만족도 달성 완료
                </span>
              )}
              {currentMonthCsTargetMet === false && (
                <span className="hp-month-cs hp-month-cs--no hp-month-cs--seal">
                  <ShieldAlert size={13} strokeWidth={2.5} aria-hidden />
                  만족도 달성 필요
                </span>
              )}
            </div>
            <Link to="/member/cases" className="hp-month-block-link">
              접수이력 <ChevronRight size={12} strokeWidth={2.5} />
            </Link>
          </div>
          <div className="hp-month-block-grid">
            <button
              type="button"
              className="hp-month-block-item hp-month-block-item--selected hp-month-block-item--btn"
              onClick={() => openCaseList('선정')}
              aria-label="선정 사례만 보기"
            >
              <span className="hp-month-block-item-label-top">선정</span>
              <div className="hp-month-block-num-row">
                <span className="hp-month-block-val">{monthStats.selected}</span>
                <span className="hp-month-block-unit">건</span>
              </div>
            </button>
            <button
              type="button"
              className="hp-month-block-item hp-month-block-item--pending hp-month-block-item--btn"
              onClick={() => openCaseList('대기중')}
              aria-label="대기 중 사례만 보기"
            >
              <span className="hp-month-block-item-label-top">대기 중</span>
              <div className="hp-month-block-num-row">
                <span className="hp-month-block-val">{monthStats.pending}</span>
                <span className="hp-month-block-unit">건</span>
              </div>
            </button>
            <button
              type="button"
              className="hp-month-block-item hp-month-block-item--rejected hp-month-block-item--btn"
              onClick={() => openCaseList('비선정')}
              aria-label="비선정 사례만 보기"
            >
              <span className="hp-month-block-item-label-top">비선정</span>
              <div className="hp-month-block-num-row">
                <span className="hp-month-block-val">{monthStats.rejected}</span>
                <span className="hp-month-block-unit">건</span>
              </div>
            </button>
          </div>

          <div className="hp-month-preview">
            <div className="hp-month-preview-head">
              <span className="hp-month-preview-label">최근 접수 이력</span>
            </div>
            {monthPreviewCases.length === 0 ? (
              <p className="hp-month-preview-empty">이번 달 접수 내역이 없습니다.</p>
            ) : (
              <ul className="hp-month-preview-list">
                {monthPreviewCases.map((c) => (
                  <li key={c.id}>
                    <Link to="/member/cases" className="hp-month-preview-row" aria-label={`${c.title || '사례'} 상세 목록으로 이동`}>
                      <span className="hp-month-preview-badge">
                        <StatusBadge status={c.status} size="sm" />
                      </span>
                      <span className="hp-month-preview-title" title={c.title || ''}>
                        {c.title?.trim() ? c.title : '제목 없음'}
                      </span>
                      <span className="hp-month-preview-date">{formatPreviewDate(c.submittedAt)}</span>
                      <ChevronRight size={14} strokeWidth={2.25} className="hp-month-preview-chev" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="hp-tier-block" aria-label="등급과 인센티브">
        <span className="hp-corner-tr" aria-hidden />
        <span className="hp-corner-bl" aria-hidden />
        <div className="hp-tier-block-header">
          <span className="hp-tier-block-title">등급 · 인센티브</span>
          {currentMonthCsTargetMet === true && csHasTarget && (
            <span className="hp-month-cs hp-month-cs--met">{currentMonthNum}월 만족도 달성</span>
          )}
          {!csHasTarget && (
            <span className="hp-month-cs hp-month-cs--muted">만족도 목표 없음</span>
          )}
        </div>

        <div className="hp-tier-main">
          <div className="hp-tier-main-left">
            <div className="hp-tier-amount-card">
              <span className="hp-tier-amount-label">현재 누적 금액</span>
              <span className="hp-tier-amount-val">{formatWon(totalReflectedWon)}</span>

              <ReflectTimeline
                rows={reflectRows}
                cumulative={cumulative}
                onPickMonth={(m) =>
                  openCaseList('선정', `${now.getFullYear()}-${String(m).padStart(2, '0')}`)
                }
              />
            </div>
          </div>

          <aside className="hp-tier-rank-aside-v2" aria-label="등급표">
            <div className="hp-tier-rank-rows">
              {TIERS.map((tier, i) => {
                const TierIcon = TIER_ICONS[tier.id];
                const isCurrent = i === tierIdx;
                return (
                  <div
                    key={tier.id}
                    className={`hp-tier-rank-card hp-tier-rank-card--${tier.id}${isCurrent ? ' is-current' : ''}`}
                  >
                    <span className="hp-tier-rank-card-icon" aria-hidden>
                      <TierIcon size={14} strokeWidth={2.5} />
                    </span>
                    <div className="hp-tier-rank-card-body">
                      <span className="hp-tier-rank-card-name">{tier.name}</span>
                      <span className="hp-tier-rank-card-range">{tier.range}</span>
                    </div>
                    <span className="hp-tier-rank-card-rate">
                      {tier.rateWon / 10000}만원
                      {isCurrent && <span className="hp-tier-rank-card-now">현재</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

    </div>
  );
}
