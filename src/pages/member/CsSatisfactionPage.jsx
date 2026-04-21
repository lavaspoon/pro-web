import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ThumbsUp,
  CheckCircle2,
  ShieldAlert,
  MapPinned,
  UserCircle2,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMemberSatisfaction, fetchMemberFocusTasks } from '../../api/memberApi';
import Skeleton from '../../components/common/Skeleton';
import '../admin/DashboardPage.css';
import './HomePage.css';
import './CsSatisfactionPage.css';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

/** Good 멘트 티커 — 한 줄씩 자동 순환 */
const GOOD_TICKER_INTERVAL_MS = 4500;

function fmt(v, decimals = 1) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(decimals);
}

function toNum(v, fallback = null) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function computeActualPct(d) {
  const served = d.monthlyActualPct;
  if (served != null && Number.isFinite(Number(served))) return Number(served);
  const recv = toNum(d.receivedCount ?? d.totalSamples, 0);
  const sat = toNum(d.satisfiedCount, 0);
  if (!recv || recv <= 0) return null;
  return (sat / recv) * 100;
}

function computeAchievementPct(d) {
  const served = d.monthlyAchievementRate;
  if (served != null && Number.isFinite(Number(served))) return Number(served);
  const actual = computeActualPct(d);
  const target = toNum(d.monthlyTargetPct ?? d.target);
  if (actual == null || target == null || target <= 0) return null;
  return (actual / target) * 100;
}

function computeMet(d) {
  if (d.monthlyTargetMet === true) return true;
  if (d.monthlyTargetMet === false) return false;
  const ach = computeAchievementPct(d);
  if (ach == null) return null;
  return ach >= 100;
}

/* ════════════════════════════════════════════════════════════
   Good 멘트 티커
   ════════════════════════════════════════════════════════════ */
function GoodTicker({ comments }) {
  const list = Array.isArray(comments) ? comments : [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return undefined;
    const t = setInterval(() => {
      setIdx((prev) => (prev + 1) % list.length);
    }, GOOD_TICKER_INTERVAL_MS);
    return () => clearInterval(t);
  }, [list.length]);

  if (list.length === 0) {
    return (
      <div className="csx-ticker csx-ticker--empty">
        <span className="csx-ticker-icon csx-ticker-icon--muted" aria-hidden>
          <ThumbsUp size={13} strokeWidth={2.3} />
        </span>
        <span className="csx-ticker-tag csx-ticker-tag--muted">Good 멘트</span>
        <p className="csx-ticker-text csx-ticker-text--muted">
          아직 기록된 긍정 멘트가 없어요.
        </p>
      </div>
    );
  }

  const current = list[idx] ?? list[0];
  const text = current?.comment ?? current?.goodMent ?? '';

  return (
    <div className="csx-ticker" role="status" aria-live="polite">
      <span className="csx-ticker-icon" aria-hidden>
        <ThumbsUp size={13} strokeWidth={2.3} />
      </span>
      <span className="csx-ticker-tag">Good 멘트</span>
      <p key={current.id ?? idx} className="csx-ticker-text">
        <span className="csx-ticker-quote" aria-hidden>{'“'}</span>
        {text}
        <span className="csx-ticker-quote" aria-hidden>{'”'}</span>
      </p>
      {list.length > 1 ? (
        <span className="csx-ticker-count" aria-label={`${idx + 1} / ${list.length}`}>
          {idx + 1}/{list.length}
        </span>
      ) : null}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   히어로 스켈레톤
   ════════════════════════════════════════════════════════════ */
function HeroSkeleton() {
  return (
    <section className="csx-hero">
      <div className="csx-hero-top">
        <div className="csx-hero-identity">
          <Skeleton variant="text" width={56} height={10} />
          <div className="csx-hero-identity-row" style={{ marginTop: 6 }}>
            <Skeleton width={72} height={26} radius={8} />
            <Skeleton variant="text" width={160} height={12} />
          </div>
        </div>
        <Skeleton width={86} height={24} radius={999} />
      </div>
      <div className="csx-hero-main" style={{ gap: 8 }}>
        <Skeleton variant="text" width={120} height={12} />
        <Skeleton width={180} height={44} radius={10} />
        <Skeleton variant="text" width={200} height={12} />
      </div>
      <div className="csx-breakdown">
        {[0, 1, 2].map((i) => (
          <div key={i} className="csx-breakdown-row">
            <Skeleton variant="text" width={56} height={12} />
            <Skeleton variant="text" width={40} height={12} />
          </div>
        ))}
        <div className="csx-breakdown-divider" />
        <div className="csx-breakdown-row csx-breakdown-row--total">
          <Skeleton variant="text" width={100} height={13} />
          <Skeleton variant="text" width={54} height={14} />
        </div>
      </div>
      <Skeleton height={42} radius={12} />
    </section>
  );
}

function FocusSkeleton() {
  return (
    <section className="csx-focus">
      <div className="csx-section-head">
        <Skeleton variant="text" width={110} height={16} />
        <Skeleton variant="text" width={180} height={11} />
      </div>
      <div className="csx-focus-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="csx-focus-card">
            <div className="csx-focus-card-head">
              <Skeleton width={26} height={26} radius={8} />
              <Skeleton variant="text" width={60} height={12} />
            </div>
            <Skeleton variant="text" width={50} height={26} />
            <Skeleton variant="text" width={80} height={11} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   ① 히어로
   ════════════════════════════════════════════════════════════ */
function HeroPanel({ data, user, year, month }) {
  const d = data ?? {};
  const actualPct = computeActualPct(d);
  const target = toNum(d.monthlyTargetPct ?? d.target);
  const achievementPct = computeAchievementPct(d);
  const met = computeMet(d);
  const gapToTarget =
    actualPct != null && target != null && target > 0
      ? Math.round((target - actualPct) * 10) / 10
      : null;

  const received = toNum(d.receivedCount ?? d.totalSamples, 0) ?? 0;
  const satisfied = toNum(d.satisfiedCount, 0) ?? 0;
  const unsatisfied = toNum(d.unsatisfiedCount, 0) ?? 0;

  const skillText = (d.skill ?? user?.skill ?? '').toString().trim();
  const affiliation = [d.centerName ?? user?.centerName, d.groupName ?? user?.groupName, d.roomName ?? user?.roomName]
    .map((s) => (s == null ? '' : String(s).trim()))
    .filter(Boolean)
    .join(' · ');

  const hasAnySatisfactionData = received > 0 || satisfied > 0 || unsatisfied > 0 || target != null;

  const badgeClass =
    met === true ? 'csx-hero-badge--met' : met === false ? 'csx-hero-badge--no' : 'csx-hero-badge--none';
  const badgeText = met === true ? '목표 달성' : met === false ? '목표 미달성' : '집계 전';

  return (
    <section className="csx-hero">
      <div className="csx-hero-top">
        <div className="csx-hero-identity">
          <span className="csx-hero-identity-kicker">{user?.name ?? '구성원'}님</span>
          <div className="csx-hero-identity-row">
            {skillText ? (
              <span className="csx-hero-identity-skill">{skillText}</span>
            ) : (
              <span className="csx-hero-identity-skill csx-hero-identity-skill--muted">스킬 미지정</span>
            )}
            {affiliation ? <span className="csx-hero-identity-aff">{affiliation}</span> : null}
          </div>
        </div>
        <span className={`csx-hero-badge ${badgeClass}`} aria-label={badgeText}>
          {met === true ? (
            <CheckCircle2 size={14} strokeWidth={2.4} />
          ) : met === false ? (
            <ShieldAlert size={14} strokeWidth={2.4} />
          ) : (
            <AlertCircle size={14} strokeWidth={2.4} />
          )}
          {badgeText}
        </span>
      </div>

      <div className="csx-hero-main">
        <p className="csx-hero-label">{year}년 {month}월 만족도</p>
        <div className="csx-hero-amount">
          <span className={`csx-hero-num ${met === true ? 'csx-hero-num--met' : ''}`}>
            {actualPct != null ? fmt(actualPct) : '—'}
          </span>
          <span className="csx-hero-unit">%</span>
        </div>
        <p className="csx-hero-sub">
          {!hasAnySatisfactionData ? (
            '이달 집계된 접수가 없습니다'
          ) : actualPct == null ? (
            target != null ? (
              <>목표 <strong>{fmt(target)}%</strong> · 이달 접수 데이터 없음</>
            ) : (
              '이달 접수 데이터가 없습니다'
            )
          ) : target == null ? (
            '목표가 아직 설정되지 않았어요'
          ) : met ? (
            <>
              목표 <strong>{fmt(target)}%</strong> 초과 달성 ·{' '}
              <span className="csx-hero-sub-accent">+{fmt(actualPct - target)}%p</span>
            </>
          ) : (
            <>
              목표 <strong>{fmt(target)}%</strong>까지{' '}
              <span className="csx-hero-sub-accent">{gapToTarget != null ? `${gapToTarget}%p` : '—'}</span>
            </>
          )}
        </p>
      </div>

      <div className="csx-breakdown">
        <div className="csx-breakdown-row">
          <span className="csx-breakdown-label">접수</span>
          <span className="csx-breakdown-value">
            <strong>{received}</strong>건
          </span>
        </div>
        <div className="csx-breakdown-row">
          <span className="csx-breakdown-label">만족</span>
          <span className="csx-breakdown-value csx-breakdown-value--pos">
            <strong>{satisfied}</strong>건
          </span>
        </div>
        <div className="csx-breakdown-row">
          <span className="csx-breakdown-label">불만족</span>
          <span className={`csx-breakdown-value${unsatisfied > 0 ? ' csx-breakdown-value--neg' : ''}`}>
            <strong>{unsatisfied}</strong>건
          </span>
        </div>
        <div className="csx-breakdown-divider" />
        <div className="csx-breakdown-row csx-breakdown-row--total">
          <span className="csx-breakdown-label">목표 대비 달성률</span>
          <span className="csx-breakdown-value">
            <strong>{achievementPct != null ? fmt(achievementPct) : '—'}</strong>%
          </span>
        </div>
      </div>

      <GoodTicker comments={d.goodComments} />
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   ② 중점추진과제 3카드
   ════════════════════════════════════════════════════════════ */
function FocusAchievementCards({ data, focusPending, focusError }) {
  const items = [
    {
      key: 'five',
      title: '5대 도시',
      icon: MapPinned,
      count: toNum(data?.fiveMajorCitiesCount),
      target: toNum(data?.fiveMajorCitiesTargetPct),
    },
    {
      key: 'gen',
      title: '5060',
      icon: UserCircle2,
      count: toNum(data?.gen5060Count),
      target: toNum(data?.gen5060TargetPct),
    },
    {
      key: 'solve',
      title: '문제해결',
      icon: CheckCircle2,
      count: toNum(data?.problemResolvedCount),
      target: toNum(data?.problemResolvedTargetPct),
    },
  ];

  const total = items.reduce((s, it) => s + (it.count ?? 0), 0);

  return (
    <section className="csx-focus">
      <div className="csx-section-head">
        <span className="csx-section-title">중점추진과제</span>
        <span className="csx-section-hint">
          {focusError
            ? '데이터를 불러오지 못했습니다'
            : focusPending
              ? '불러오는 중…'
              : (
                <>
                  만족(Y)이면서 해당 중점지표도 Y인 건수 · 총 <strong>{total}건</strong>
                </>
              )}
        </span>
      </div>
      <div className="csx-focus-grid">
        {items.map((it) => {
          const Icon = it.icon;
          const hasCount = it.count != null;
          const hasTarget = it.target != null && it.target > 0;
          return (
            <div key={it.key} className="csx-focus-card">
              <div className="csx-focus-card-head">
                <span className="csx-focus-card-icon" aria-hidden>
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <span className="csx-focus-card-title">{it.title}</span>
              </div>
              <div className="csx-focus-card-body">
                <span className="csx-focus-card-num">{hasCount ? it.count : '—'}</span>
                <span className="csx-focus-card-unit">건</span>
              </div>
              <div className="csx-focus-card-foot">
                {hasTarget ? (
                  <>목표 <strong>{fmt(it.target)}%</strong></>
                ) : (
                  <span className="csx-focus-card-foot--muted">개인 목표 미설정</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   메인 페이지
   ════════════════════════════════════════════════════════════ */
export default function CsSatisfactionPage() {
  const { user } = useAuthStore();
  const [year] = useState(currentYear);
  const [month] = useState(currentMonth);

  const satQuery = useQuery({
    queryKey: ['member-satisfaction', user?.skid, year, month],
    queryFn: () => fetchMemberSatisfaction({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const focusQuery = useQuery({
    queryKey: ['member-focus-tasks', user?.skid, year, month],
    queryFn: () => fetchMemberFocusTasks({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const satData = useMemo(() => {
    const base = satQuery.data ?? null;
    const f = focusQuery.data ?? null;
    if (!base && !f) return null;
    return {
      ...(base ?? {}),
      fiveMajorCitiesCount: f?.fiveMajorCitiesCount ?? base?.fiveMajorCitiesCount,
      gen5060Count: f?.gen5060Count ?? base?.gen5060Count,
      problemResolvedCount: f?.problemResolvedCount ?? base?.problemResolvedCount,
      fiveMajorCitiesTargetPct: base?.fiveMajorCitiesTargetPct,
      gen5060TargetPct: base?.gen5060TargetPct,
      problemResolvedTargetPct: base?.problemResolvedTargetPct,
    };
  }, [satQuery.data, focusQuery.data]);

  const isLoading = satQuery.isPending;
  const isError = satQuery.isError;

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp cs-sat-page yp-home fade-in csx-page">
      <header className="csx-page-header">
        <div className="csx-page-header-text">
          <h1 className="csx-page-title">나의 CS 만족도</h1>
          <p className="csx-page-sub">현황을 한눈에 확인하세요.</p>
        </div>
      </header>

      {isLoading ? (
        <>
          <HeroSkeleton />
          <FocusSkeleton />
        </>
      ) : isError ? (
        <div className="csx-error">
          <AlertCircle size={20} strokeWidth={2.2} />
          <div>
            <p className="csx-error-title">데이터를 불러오지 못했습니다</p>
            <p className="csx-error-sub">
              {satQuery.error?.message ?? '잠시 후 다시 시도해 주세요.'}
            </p>
          </div>
        </div>
      ) : !satData ? (
        <div className="csx-empty">
          <Inbox size={22} strokeWidth={2.1} />
          <p className="csx-empty-title">아직 집계된 데이터가 없어요</p>
          <p className="csx-empty-sub">{year}년 {month}월 기준으로 표시할 만족도 기록이 없습니다.</p>
        </div>
      ) : (
        <>
          <HeroPanel data={satData} user={user} year={year} month={month} />
          <FocusAchievementCards
            data={satData}
            focusPending={focusQuery.isPending}
            focusError={focusQuery.isError}
          />
        </>
      )}
    </div>
  );
}
