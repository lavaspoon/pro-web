import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ThumbsUp,
  CheckCircle2,
  ShieldAlert,
  MapPinned,
  UserCircle2,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMemberSatisfaction, fetchMemberFocusTasks } from '../../api/memberApi';
import '../admin/DashboardPage.css';
import './HomePage.css';
import './CsSatisfactionPage.css';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

/** Good 멘트 티커 — 한 줄씩 자동 순환 */
const GOOD_TICKER_INTERVAL_MS = 4500;

const MOCK_DATA = {
  skill: '일반',
  centerName: '서부',
  groupName: '고객응대',
  roomName: '1실',
  monthlyTargetPct: 94.9,
  target: 94.9,
  receivedCount: 47,
  totalSamples: 47,
  satisfiedCount: 46,
  unsatisfiedCount: 1,
  fiveMajorCitiesCount: 4,
  gen5060Count: 6,
  problemResolvedCount: 3,
  fiveMajorCitiesTargetPct: 30,
  gen5060TargetPct: 40,
  problemResolvedTargetPct: 25,
  goodComments: [
    {
      id: 1,
      date: '2026-04-12',
      comment: '친절하고 꼼꼼하게 안내해 주셔서 궁금한 점이 모두 해결됐어요. 정말 감사합니다!',
    },
    {
      id: 2,
      date: '2026-04-10',
      comment: '빠르게 처리해 주셨고 설명도 이해하기 쉬웠습니다. 덕분에 바로 해결됐어요.',
    },
    {
      id: 3,
      date: '2026-04-07',
      comment: '처음 문의했는데 끝까지 친절하게 도와주셨어요. 최고입니다!',
    },
  ],
};

function fmt(v, decimals = 1) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(decimals);
}

function computeMonthlyActualPct(d) {
  const recv = Number(d.receivedCount ?? d.totalSamples ?? 0);
  const sat = Number(d.satisfiedCount ?? 0);
  if (!Number.isFinite(recv) || recv <= 0) return null;
  return (sat / recv) * 100;
}

function computeAchievementVsTargetPct(actual, target) {
  const t = Number(target ?? 0);
  if (!Number.isFinite(t) || t <= 0 || actual == null) return null;
  return (actual / t) * 100;
}

/* ════════════════════════════════════════════════════════════
   Good 멘트 티커 — 한 줄씩 자동 순환
   ════════════════════════════════════════════════════════════ */
function GoodTicker({ comments }) {
  const list = Array.isArray(comments) && comments.length > 0 ? comments : [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return undefined;
    const t = setInterval(() => {
      setIdx((prev) => (prev + 1) % list.length);
    }, GOOD_TICKER_INTERVAL_MS);
    return () => clearInterval(t);
  }, [list.length]);

  if (list.length === 0) return null;
  const current = list[idx] ?? list[0];

  return (
    <div className="csx-ticker" role="status" aria-live="polite">
      <span className="csx-ticker-icon" aria-hidden>
        <ThumbsUp size={13} strokeWidth={2.3} />
      </span>
      <span className="csx-ticker-tag">Good 멘트</span>
      <p key={current.id ?? idx} className="csx-ticker-text">
        <span className="csx-ticker-quote" aria-hidden>{'“'}</span>
        {current.comment}
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
   ① 히어로 — 스킬·소속 + 당월 만족도 % + 달성 뱃지 + 영수증 + Good 티커
   ════════════════════════════════════════════════════════════ */
function HeroPanel({ data, user, year, month }) {
  const d = data;
  const actualPct = computeMonthlyActualPct(d);
  const target = Number(d.monthlyTargetPct ?? d.target ?? 0);
  const achievementPct = computeAchievementVsTargetPct(actualPct, target);
  const met = achievementPct != null && achievementPct >= 100;
  const gapToTarget =
    actualPct != null && Number.isFinite(target) && target > 0
      ? Math.round((target - actualPct) * 10) / 10
      : null;

  const skillText = d.skill?.trim() || '—';
  const affiliation = [d.centerName, d.groupName, d.roomName]
    .map((s) => (s == null ? '' : String(s).trim()))
    .filter(Boolean)
    .join(' · ');

  const goodList =
    Array.isArray(d.goodComments) && d.goodComments.length > 0
      ? d.goodComments
      : MOCK_DATA.goodComments;

  return (
    <section className="csx-hero">
      <div className="csx-hero-top">
        <div className="csx-hero-identity">
          <span className="csx-hero-identity-kicker">{user?.name ?? '구성원'}님</span>
          <div className="csx-hero-identity-row">
            <span className="csx-hero-identity-skill">{skillText}</span>
            {affiliation ? <span className="csx-hero-identity-aff">{affiliation}</span> : null}
          </div>
        </div>
        <span
          className={`csx-hero-badge ${met ? 'csx-hero-badge--met' : 'csx-hero-badge--no'}`}
          aria-label={met ? '이달 목표 달성' : '이달 목표 미달성'}
        >
          {met ? <CheckCircle2 size={14} strokeWidth={2.4} /> : <ShieldAlert size={14} strokeWidth={2.4} />}
          {met ? '목표 달성' : '목표 미달성'}
        </span>
      </div>

      <div className="csx-hero-main">
        <p className="csx-hero-label">{year}년 {month}월 만족도</p>
        <div className="csx-hero-amount">
          <span className={`csx-hero-num ${met ? 'csx-hero-num--met' : ''}`}>
            {actualPct != null ? fmt(actualPct) : '—'}
          </span>
          <span className="csx-hero-unit">%</span>
        </div>
        <p className="csx-hero-sub">
          {actualPct == null ? (
            '이달 집계된 접수가 없습니다'
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
            <strong>{Number(d.receivedCount ?? d.totalSamples ?? 0)}</strong>건
          </span>
        </div>
        <div className="csx-breakdown-row">
          <span className="csx-breakdown-label">만족</span>
          <span className="csx-breakdown-value csx-breakdown-value--pos">
            <strong>{Number(d.satisfiedCount ?? 0)}</strong>건
          </span>
        </div>
        <div className="csx-breakdown-row">
          <span className="csx-breakdown-label">불만족</span>
          <span
            className={`csx-breakdown-value${
              Number(d.unsatisfiedCount ?? 0) > 0 ? ' csx-breakdown-value--neg' : ''
            }`}
          >
            <strong>{Number(d.unsatisfiedCount ?? 0)}</strong>건
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

      <GoodTicker comments={goodList} />
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   ② 중점추진과제 3카드
   ════════════════════════════════════════════════════════════ */
function FocusAchievementCards({ data }) {
  const items = [
    {
      key: 'five',
      title: '5대 도시',
      icon: MapPinned,
      count: Number(data.fiveMajorCitiesCount ?? 0),
      target: data.fiveMajorCitiesTargetPct,
    },
    {
      key: 'gen',
      title: '5060',
      icon: UserCircle2,
      count: Number(data.gen5060Count ?? 0),
      target: data.gen5060TargetPct,
    },
    {
      key: 'solve',
      title: '문제해결',
      icon: CheckCircle2,
      count: Number(data.problemResolvedCount ?? 0),
      target: data.problemResolvedTargetPct,
    },
  ];

  const total = items.reduce((s, it) => s + it.count, 0);

  return (
    <section className="csx-focus">
      <div className="csx-section-head">
        <span className="csx-section-title">중점추진과제</span>
        <span className="csx-section-hint">
          만족(Y)이면서 해당 중점지표도 Y인 건수 · 총 <strong>{total}건</strong>
        </span>
      </div>
      <div className="csx-focus-grid">
        {items.map((it) => {
          const Icon = it.icon;
          const hasTarget = Number.isFinite(Number(it.target)) && Number(it.target) > 0;
          return (
            <div key={it.key} className="csx-focus-card">
              <div className="csx-focus-card-head">
                <span className="csx-focus-card-icon" aria-hidden>
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <span className="csx-focus-card-title">{it.title}</span>
              </div>
              <div className="csx-focus-card-body">
                <span className="csx-focus-card-num">{it.count}</span>
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

  const { data: satRaw, isError } = useQuery({
    queryKey: ['member-satisfaction', user?.skid, year, month],
    queryFn: () => fetchMemberSatisfaction({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const { data: focusRaw } = useQuery({
    queryKey: ['member-focus-tasks', user?.skid, year, month],
    queryFn: () => fetchMemberFocusTasks({ skid: user.skid, year, month }),
    enabled: !!user?.skid,
    retry: false,
  });

  const satData = useMemo(() => {
    const isMock = isError || !satRaw;
    const base = isMock ? { ...MOCK_DATA } : satRaw;
    const f = focusRaw ?? {};
    return {
      ...base,
      skill: base.skill ?? MOCK_DATA.skill,
      centerName: base.centerName ?? MOCK_DATA.centerName,
      groupName: base.groupName ?? MOCK_DATA.groupName,
      roomName: base.roomName ?? MOCK_DATA.roomName,
      fiveMajorCitiesCount: f.fiveMajorCitiesCount ?? base.fiveMajorCitiesCount ?? 0,
      gen5060Count: f.gen5060Count ?? base.gen5060Count ?? 0,
      problemResolvedCount: f.problemResolvedCount ?? base.problemResolvedCount ?? 0,
      fiveMajorCitiesTargetPct:
        f.fiveMajorCitiesTargetPct ?? base.fiveMajorCitiesTargetPct ?? MOCK_DATA.fiveMajorCitiesTargetPct,
      gen5060TargetPct: f.gen5060TargetPct ?? base.gen5060TargetPct ?? MOCK_DATA.gen5060TargetPct,
      problemResolvedTargetPct:
        f.problemResolvedTargetPct ?? base.problemResolvedTargetPct ?? MOCK_DATA.problemResolvedTargetPct,
      monthlyTargetPct: base.monthlyTargetPct ?? base.target,
      receivedCount: base.receivedCount ?? base.totalSamples,
      goodComments:
        Array.isArray(base.goodComments) && base.goodComments.length > 0
          ? base.goodComments
          : MOCK_DATA.goodComments,
    };
  }, [satRaw, isError, focusRaw]);

  return (
    <div className="page-container adm-dashboard adm-dashboard--yp cs-sat-page yp-home fade-in csx-page">
      <header className="csx-page-header">
        <div className="csx-page-header-text">
          <h1 className="csx-page-title">나의 CS 만족도</h1>
          <p className="csx-page-sub">현황을 한눈에 확인하세요.</p>
        </div>
      </header>

      <HeroPanel data={satData} user={user} year={year} month={month} />

      <FocusAchievementCards data={satData} />
    </div>
  );
}
