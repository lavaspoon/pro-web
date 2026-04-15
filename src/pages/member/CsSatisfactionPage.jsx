import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Sparkles,
  ThumbsUp,
  CalendarDays,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
  Lightbulb,
  TriangleAlert,
  CircleCheck,
  X,
  Loader2,
  MessageSquareText,
  Target,
  Star,
  ClipboardCheck,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import {
  fetchMemberSatisfaction,
  fetchMemberFocusTasks,
  fetchMemberUnsatisfiedDetails,
} from '../../api/memberApi';
import '../admin/DashboardPage.css';
import './CsSatisfactionPage.css';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

/* ── mock 데이터 ──────────────────────────────────────────── */
const MOCK_DATA = {
  target: 94.9,
  score: 99.2,
  achievementRate: 105.4,
  totalSamples: 47,
  satisfiedCount: 46,
  unsatisfiedCount: 1,
  cumulativeSamples: 47,
  weeklyTrend: [
    { day: '4/8',  score: 92 },
    { day: '4/9',  score: 95 },
    { day: '4/10', score: 94 },
    { day: '4/11', score: 97 },
    { day: '4/12', score: 96 },
    { day: '4/13', score: 98 },
    { day: '4/14', score: 99.2 },
  ],
  unsatisfiedCategories: [
    { label: '서비스 지식부족', dissatisfactionType: 1, count: 0 },
    { label: '성의 없는 태도', dissatisfactionType: 2, count: 0 },
    { label: '적절하지 않는 혜택 안내', dissatisfactionType: 3, count: 0 },
    { label: '알아듣기 어려운 설명', dissatisfactionType: 4, count: 0 },
    { label: '문의내용 이해 못함', dissatisfactionType: 5, count: 1 },
  ],
  /** API 미연동 시 상세 모달 예시 (유형 코드 → 레코드 배열) */
  unsatisfiedDetailSamples: {
    5: [
      {
        id: 9001,
        evalDate: '2026-04-10',
        consultTime: '143052',
        subsidiaryType: '자회사A',
        centerName: '서부',
        groupName: '고객응대',
        roomName: '1실',
        consultType1: '요금',
        consultType2: '변경',
        consultType3: '해지',
        skill: '일반',
        satisfiedYn: 'N',
        goodMent: null,
        badMent: '설명이 길어 처음 의도를 파악하지 못했습니다.',
        fiveMajorCitiesYn: 'N',
        gen5060Yn: 'Y',
        problemResolvedYn: 'Y',
      },
    ],
  },
  /* 고객 Good 멘트 — 추후 raw 데이터 연동 예정 */
  fiveMajorCitiesCount: 4,
  gen5060Count: 6,
  problemResolvedCount: 3,
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
  if (v == null) return '—';
  return Number(v).toFixed(decimals);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatCsEvalDate(iso) {
  if (iso == null) return '—';
  if (Array.isArray(iso) && iso.length >= 3) {
    const [y, m, d] = iso;
    return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
  }
  const s = typeof iso === 'string' ? iso.slice(0, 10) : String(iso);
  const parts = s.split('-');
  if (parts.length >= 3) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return s;
}

function ynLabel(yn) {
  if (yn == null || yn === '') return '—';
  const u = String(yn).trim().toUpperCase();
  if (u === 'Y') return 'Y';
  if (u === 'N') return 'N';
  return String(yn);
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="cs-sat-tooltip">
      <span className="cs-sat-tooltip-label">{label}</span>
      <span className="cs-sat-tooltip-val">{Number(payload[0]?.value).toFixed(1)}점</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   상단 4지표 — 게이지 없이 숫자·라벨 중심
   ════════════════════════════════════════════════════════════ */
function CsSatisfactionKpiRow({ data, year, month }) {
  const d = data ?? MOCK_DATA;
  const rate = Number(d.achievementRate);
  const achievementBand =
    rate >= 100 ? 'met' : rate >= 90 ? 'near' : 'below';
  const achievementCaption =
    rate >= 100 ? '목표 달성' : rate >= 90 ? '목표에 근접' : '목표 미달';

  return (
    <div className="cs-sat-kpi-tiles" aria-label="당월 핵심 지표">
      <div className="cs-sat-kpi-tile cs-sat-kpi-tile--target">
        <div className="cs-sat-kpi-tile-top">
          <span className="cs-sat-kpi-tile-label">
            {year}년 {month}월 목표
          </span>
          <Target size={17} strokeWidth={2} className="cs-sat-kpi-tile-ico" aria-hidden />
        </div>
        <p className="cs-sat-kpi-tile-value">
          {fmt(d.target)}
          <span className="cs-sat-kpi-tile-unit">%</span>
        </p>
      </div>

      <div className={`cs-sat-kpi-tile cs-sat-kpi-tile--rate cs-sat-kpi-tile--${achievementBand}`}>
        <div className="cs-sat-kpi-tile-top">
          <span className="cs-sat-kpi-tile-label">달성률</span>
          <TrendingUp size={17} strokeWidth={2} className="cs-sat-kpi-tile-ico" aria-hidden />
        </div>
        <p className="cs-sat-kpi-tile-value">
          {fmt(rate)}
          <span className="cs-sat-kpi-tile-unit">%</span>
        </p>
        <p className="cs-sat-kpi-tile-hint">{achievementCaption}</p>
      </div>

      <div className="cs-sat-kpi-tile cs-sat-kpi-tile--score">
        <div className="cs-sat-kpi-tile-top">
          <span className="cs-sat-kpi-tile-label">만족도 점수</span>
          <Star size={17} strokeWidth={2} className="cs-sat-kpi-tile-ico" aria-hidden />
        </div>
        <p className="cs-sat-kpi-tile-value">
          {fmt(d.score)}
          <span className="cs-sat-kpi-tile-unit">점</span>
        </p>
      </div>

      <div className="cs-sat-kpi-tile cs-sat-kpi-tile--focus">
        <div className="cs-sat-kpi-tile-top">
          <span className="cs-sat-kpi-tile-label">중점추진과제</span>
          <ClipboardCheck size={17} strokeWidth={2} className="cs-sat-kpi-tile-ico" aria-hidden />
        </div>
        <ul className="cs-sat-kpi-focus-list">
          <li>
            <span>5대도시</span>
            <strong>{Number(d.fiveMajorCitiesCount ?? 0)}</strong>
            <span className="cs-sat-kpi-focus-unit">건</span>
          </li>
          <li>
            <span>5060</span>
            <strong>{Number(d.gen5060Count ?? 0)}</strong>
            <span className="cs-sat-kpi-focus-unit">건</span>
          </li>
          <li>
            <span>문제해결</span>
            <strong>{Number(d.problemResolvedCount ?? 0)}</strong>
            <span className="cs-sat-kpi-focus-unit">건</span>
          </li>
        </ul>
        <p className="cs-sat-kpi-tile-micro">당월 해당 상담</p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   패널 A — 당월 누적 만족도 (좌측 메인) · 샘플·불만족·차트
   ════════════════════════════════════════════════════════════ */
function MonthlyAccumulatedPanel({ data, year, month, children }) {
  const d = data ?? MOCK_DATA;
  const goodList =
    Array.isArray(d.goodComments) && d.goodComments.length > 0
      ? d.goodComments
      : MOCK_DATA.goodComments;

  return (
    <div className="cs-sat-card csm-card cs-sat-card--good cs-sat-monthly-compact">

      {/* ── 헤더 ── */}
      <div className="cs-sat-card-header">
        <div className="section-header" style={{ marginBottom: 0 }}>
          <span className="section-title">당월 누적 만족도</span>
        </div>
        <span className="cs-sat-period-badge">{year}년 {month}월</span>
      </div>

      {/* ── 샘플 통계 인라인 ── */}
      <div className="csm-stat-strip">
        <div className="csm-stat-item">
          <span className="csm-stat-dot csm-stat-dot--total" />
          <span className="csm-stat-label">총 샘플</span>
          <span className="csm-stat-val">{d.totalSamples}<em>건</em></span>
        </div>
        <div className="csm-stat-sep" />
        <div className="csm-stat-item">
          <span className="csm-stat-dot csm-stat-dot--pos" />
          <span className="csm-stat-label">만족</span>
          <span className="csm-stat-val csm-stat-val--pos">{d.satisfiedCount}<em>건</em></span>
        </div>
        <div className="csm-stat-sep" />
        <div className="csm-stat-item">
          <span className="csm-stat-dot csm-stat-dot--neg" />
          <span className="csm-stat-label">불만족</span>
          <span className={`csm-stat-val${d.unsatisfiedCount > 0 ? ' csm-stat-val--neg' : ''}`}>
            {d.unsatisfiedCount}<em>건</em>
          </span>
        </div>
      </div>

      {children}

      {/* ── 미니 추이 차트 ── */}
      <div className="csm-chart-wrap">
        <div className="csm-chart-header">
          <span className="csm-chart-title">최근 7일 만족도 추이</span>
          <div className="cs-sat-chart-legend">
            <span className="cs-sat-legend-item">
              <span className="cs-sat-legend-line" />
              누적 {d.cumulativeSamples}건
            </span>
            <span className="cs-sat-legend-item">
              <span className="cs-sat-legend-dash" />
              목표선
            </span>
          </div>
        </div>
        <div className="csm-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.weeklyTrend} margin={{ top: 4, right: 6, bottom: 0, left: -22 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[85, 100]}
                tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<TrendTooltip />} />
              <ReferenceLine
                y={d.target}
                stroke="var(--warning)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--yp-accent-bright)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--yp-accent-bright)', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--yp-accent-bright)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Good 멘트 — 당월 누적 카드에 통합 */}
      <div className="cs-sat-monthly-good" aria-label="Good 멘트 사례">
        <div className="cs-sat-monthly-good-head">
          <span className="cs-sat-monthly-good-icon-wrap" aria-hidden>
            <ThumbsUp size={16} strokeWidth={2.2} />
          </span>
          <span className="cs-sat-monthly-good-title">Good 멘트 사례</span>
          <span className="cs-sat-monthly-good-badge">{goodList.length}건</span>
        </div>
        <p className="cs-sat-monthly-good-lead">
          <Sparkles size={12} strokeWidth={2} className="cs-sat-monthly-good-lead-ico" aria-hidden />
          고객이 남긴 긍정 평가 멘트입니다.
        </p>
        <ul className="cs-sat-monthly-good-list">
          {goodList.map((item, idx) => (
            <li key={item.id ?? idx} className="cs-sat-monthly-good-item">
              <span className="cs-sat-monthly-good-quote" aria-hidden>
                {'\u201c'}
              </span>
              <div className="cs-sat-monthly-good-body">
                <p className="cs-sat-monthly-good-text">{item.comment}</p>
                <span className="cs-sat-monthly-good-date">
                  <CalendarDays size={11} strokeWidth={2} aria-hidden />
                  {formatDate(item.date)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   패널 C — 불만족 원인 건수 (좌하단)
   ════════════════════════════════════════════════════════════ */
function UnsatisfiedCategoriesPanel({
  categories = [],
  year,
  month,
  skid,
  detailFallbackByType = MOCK_DATA.unsatisfiedDetailSamples,
  embedded = false,
}) {
  const list = categories.length > 0 ? categories : MOCK_DATA.unsatisfiedCategories;
  const total = list.reduce((s, c) => s + c.count, 0);
  const maxCount = Math.max(...list.map((c) => c.count), 1);
  const isAllClear = total === 0;

  const [selected, setSelected] = useState(null);

  const { data: detailRes, isLoading, isError } = useQuery({
    queryKey: ['member-unsat-detail', skid, year, month, selected?.dissatisfactionType],
    queryFn: () =>
      fetchMemberUnsatisfiedDetails({
        skid,
        year,
        month,
        dissatisfactionType: selected.dissatisfactionType,
      }),
    enabled: !!skid && !!selected,
    retry: false,
  });

  const detailRecords = useMemo(() => {
    if (!selected) return [];
    if (isError) {
      const fb = detailFallbackByType?.[selected.dissatisfactionType];
      return Array.isArray(fb) ? fb : [];
    }
    const fromApi = detailRes?.records;
    return Array.isArray(fromApi) ? fromApi : [];
  }, [detailRes, isError, selected, detailFallbackByType]);

  const showFallbackHint = Boolean(selected && isError && detailRecords.length > 0);
  const showLoadError = Boolean(selected && isError && detailRecords.length === 0 && !isLoading);

  useEffect(() => {
    if (!selected) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selected]);

  const headerBlock = embedded ? (
    <div className="cs-sat-ucat-embed-head">
      <span className="cs-sat-ucat-embed-title">불만족 원인 건수</span>
      <span className="cs-sat-ucat-embed-badge">{year}년 {month}월</span>
    </div>
  ) : (
    <div className="cs-sat-card-header">
      <div className="section-header" style={{ marginBottom: 0 }}>
        <span className="section-title">불만족 원인 건수</span>
      </div>
      <span className="cs-sat-period-badge">{year}년 {month}월</span>
    </div>
  );

  const body = (
    <>
      {headerBlock}

      {/* 요약 배너 */}
      {isAllClear ? (
        <div className="cs-sat-unsat-banner cs-sat-unsat-banner--clear">
          <CheckCircle2 size={16} strokeWidth={2.2} />
          <span>이번 달 불만족 원인 없음 — 모든 항목 클리어!</span>
        </div>
      ) : (
        <div className="cs-sat-unsat-banner cs-sat-unsat-banner--alert">
          <ShieldAlert size={16} strokeWidth={2.2} />
          <span>총 <strong>{total}건</strong>의 불만족 원인이 기록되었습니다.</span>
        </div>
      )}

      {/* 카테고리 리스트 */}
      <ul className="cs-sat-ucat-list">
        {list.map((cat, idx) => {
          const barWidth = cat.count === 0 ? 0 : Math.max((cat.count / maxCount) * 100, 8);
          const hasIssue = cat.count > 0;
          const dissType = cat.dissatisfactionType ?? idx + 1;
          return (
            <li
              key={cat.label}
              className={`cs-sat-ucat-item${hasIssue ? ' cs-sat-ucat-item--alert cs-sat-ucat-item--clickable' : ''}`}
            >
              <button
                type="button"
                className="cs-sat-ucat-row-btn"
                disabled={!hasIssue || !skid}
                onClick={() => {
                  if (!hasIssue || !skid) return;
                  setSelected({ dissatisfactionType: dissType, label: cat.label });
                }}
                aria-label={hasIssue ? `${cat.label} 상세 보기` : undefined}
              >
                <div className="cs-sat-ucat-left">
                  <span className={`cs-sat-ucat-rank${hasIssue ? ' cs-sat-ucat-rank--alert' : ''}`}>
                    {idx + 1}
                  </span>
                  <span className="cs-sat-ucat-label">{cat.label}</span>
                </div>
                <div className="cs-sat-ucat-right">
                  <div className="cs-sat-ucat-bar-track">
                    <div
                      className={`cs-sat-ucat-bar-fill${hasIssue ? ' cs-sat-ucat-bar-fill--alert' : ''}`}
                      style={{ width: hasIssue ? `${barWidth}%` : '0%' }}
                    />
                  </div>
                  <span className={`cs-sat-ucat-count${hasIssue ? ' cs-sat-ucat-count--alert' : ''}`}>
                    {hasIssue ? (
                      <>{cat.count}<em>건</em></>
                    ) : (
                      <CheckCircle2 size={14} strokeWidth={2.2} className="cs-sat-ucat-clear-icon" />
                    )}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="cs-sat-ucat-footnote">
        * 건수가 있는 항목을 누르면 해당 상담 상세를 볼 수 있습니다.
      </p>
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="cs-sat-ucat-embedded">{body}</div>
      ) : (
        <div className="cs-sat-card cs-sat-card--unsat">{body}</div>
      )}

      {selected && createPortal(
        <div
          className="cs-ucat-detail-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cs-ucat-detail-title"
          onClick={() => setSelected(null)}
        >
          <div
            className="cs-ucat-detail-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cs-ucat-detail-head">
              <div>
                <h2 id="cs-ucat-detail-title" className="cs-ucat-detail-title">
                  {selected.label}
                </h2>
                <p className="cs-ucat-detail-sub">
                  {year}년 {month}월 · 유형 코드 {selected.dissatisfactionType}
                </p>
              </div>
              <button
                type="button"
                className="cs-ucat-detail-close"
                onClick={() => setSelected(null)}
                aria-label="닫기"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            {showFallbackHint && (
              <p className="cs-ucat-detail-fallback-hint">API 연결 전 예시 데이터입니다.</p>
            )}

            {isLoading && (
              <div className="cs-ucat-detail-loading">
                <Loader2 className="cs-ucat-detail-spin" size={22} />
                <span>불러오는 중…</span>
              </div>
            )}

            {showLoadError && (
              <p className="cs-ucat-detail-empty cs-ucat-detail-empty--error">
                상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
              </p>
            )}

            {!isLoading && !showLoadError && detailRecords.length === 0 && (
              <p className="cs-ucat-detail-empty">해당 유형의 상세 상담 기록이 없습니다.</p>
            )}

            {!isLoading && !showLoadError && detailRecords.length > 0 && (
              <ul className="cs-ucat-detail-list">
                {detailRecords.map((rec, ridx) => (
                  <li key={rec.id != null ? String(rec.id) : `rec-${ridx}`} className="cs-ucat-detail-card">
                    <div className="cs-ucat-detail-card-head">
                      <span className="cs-ucat-detail-date">
                        <CalendarDays size={14} strokeWidth={2} aria-hidden />
                        {formatCsEvalDate(rec.evalDate)}
                        {rec.consultTime ? (
                          <span className="cs-ucat-detail-time"> · {rec.consultTime}</span>
                        ) : null}
                      </span>
                      <span
                        className={`cs-ucat-detail-sat-badge${
                          String(rec.satisfiedYn).toUpperCase() === 'N'
                            ? ' cs-ucat-detail-sat-badge--neg'
                            : ''
                        }`}
                      >
                        만족 {ynLabel(rec.satisfiedYn)}
                      </span>
                    </div>

                    <dl className="cs-ucat-detail-dl">
                      {rec.subsidiaryType && (
                        <>
                          <dt>자회사</dt>
                          <dd>{rec.subsidiaryType}</dd>
                        </>
                      )}
                      <dt>센터</dt>
                      <dd>{rec.centerName || '—'}</dd>
                      <dt>그룹</dt>
                      <dd>{rec.groupName || '—'}</dd>
                      <dt>실</dt>
                      <dd>{rec.roomName || '—'}</dd>
                      <dt>상담유형</dt>
                      <dd>
                        {[rec.consultType1, rec.consultType2, rec.consultType3]
                          .filter(Boolean)
                          .join(' › ') || '—'}
                      </dd>
                      <dt>스킬</dt>
                      <dd>{rec.skill || '—'}</dd>
                      <dt>중점과제</dt>
                      <dd className="cs-ucat-detail-yn-row">
                        <span>5대도시 {ynLabel(rec.fiveMajorCitiesYn)}</span>
                        <span>5060 {ynLabel(rec.gen5060Yn)}</span>
                        <span>문제해결 {ynLabel(rec.problemResolvedYn)}</span>
                      </dd>
                    </dl>

                    {(rec.goodMent || rec.badMent) && (
                      <div className="cs-ucat-detail-ments">
                        {rec.goodMent ? (
                          <div className="cs-ucat-detail-ment cs-ucat-detail-ment--pos">
                            <MessageSquareText size={14} strokeWidth={2} aria-hidden />
                            <div>
                              <span className="cs-ucat-detail-ment-label">긍정 코멘트</span>
                              <p>{rec.goodMent}</p>
                            </div>
                          </div>
                        ) : null}
                        {rec.badMent ? (
                          <div className="cs-ucat-detail-ment cs-ucat-detail-ment--neg">
                            <MessageSquareText size={14} strokeWidth={2} aria-hidden />
                            <div>
                              <span className="cs-ucat-detail-ment-label">부정 코멘트</span>
                              <p>{rec.badMent}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   AI Insight 데이터 헬퍼
   ════════════════════════════════════════════════════════════ */
const FEEDBACK_MAP = {
  '서비스 지식부족':         '최신 상품 정보를 주기적으로 학습하고 FAQ를 미리 숙지하세요.',
  '성의 없는 태도':          '공감 표현("잘 이해했습니다")을 적극 활용해 보세요.',
  '적절하지 않는 혜택 안내': '상담 전 고객 이용 내역을 확인 후 맞춤 옵션을 제안하세요.',
  '알아듣기 어려운 설명':    '전문 용어 대신 쉬운 표현으로 단계별 설명을 시도하세요.',
  '문의내용 이해 못함':      '"말씀하신 내용이 ~이 맞나요?" 재확인으로 오해를 예방하세요.',
};

function buildFeed(categories = [], score = 0, achievementRate = 0, totalSamples = 0) {
  const unsatTotal = categories.reduce((s, c) => s + c.count, 0);
  const issues     = categories.filter((c) => c.count > 0);
  const diffPp     = (achievementRate - 100).toFixed(1);
  const isOver     = achievementRate >= 100;

  return [
    /* 1. 달성 현황 */
    {
      type:  isOver ? 'success' : 'warning',
      tag:   isOver ? '달성 초과' : '목표 미달',
      body:  isOver
        ? `${totalSamples}건 중 ${score.toFixed(1)}점 · 목표 +${diffPp}%p 초과 달성`
        : `${score.toFixed(1)}점 · 목표 달성률 ${achievementRate.toFixed(1)}% (미달)`,
    },
    /* 2. 개선 포인트 */
    unsatTotal === 0
      ? { type: 'success', tag: '개선 포인트', body: '불만족 원인 0건 · 모든 항목 클리어' }
      : {
          type: 'warning',
          tag:  '개선 포인트',
          body: issues.map((c) => `"${c.label}" ${c.count}건 — ${FEEDBACK_MAP[c.label] ?? '상담 방식 검토 권장'}`).join(' / '),
        },
    /* 3. 품질 팁 */
    {
      type: 'tip',
      tag:  '품질 팁',
      body: '마무리 멘트("추가 도움이 필요하신가요?") 활용 시 만족도 +2~3점 향상',
    },
    /* 4. 추이 */
    {
      type: 'trend',
      tag:  '추이 분석',
      body: '최근 7일 꾸준한 상승세 · 현재 상담 방식 유지 권장',
    },
  ];
}

const FEED_STYLE = {
  success: { icon: CircleCheck },
  warning: { icon: TriangleAlert },
  tip:     { icon: Lightbulb },
  trend:   { icon: TrendingUp },
};

/* ════════════════════════════════════════════════════════════
   패널 B — 인사이트 (우상단)
   ════════════════════════════════════════════════════════════ */
function AiInsightPanel({ data }) {
  const d      = data ?? MOCK_DATA;
  const feed   = buildFeed(d.unsatisfiedCategories, d.score, d.achievementRate, d.totalSamples);
  const isOver = d.achievementRate >= 100;
  const delta  = Math.abs(d.achievementRate - 100).toFixed(1);
  const generatedAt = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

  return (
    <div className="cs-sat-card ai-card ai-card--hero">

      {/* ── 헤더 ── */}
      <div className="ai-hero-top">
        <div className="ai-hero-title-block">
          <span className="ai-hero-icon" aria-hidden>
            <Sparkles size={22} strokeWidth={1.85} />
          </span>
          <div>
            <div className="ai-hero-kicker">AI 인사이트</div>
            <h2 className="ai-hero-title">이번 달 상담 품질 요약</h2>
          </div>
        </div>
        <span className="ai-hero-meta">{generatedAt} 기준</span>
      </div>

      {/* ── 요약 하이라이트 ── */}
      <div className={`ai-hero-highlight${isOver ? ' ai-hero-highlight--over' : ' ai-hero-highlight--under'}`}>
        <div className="ai-hero-highlight-main">
          <span className="ai-hero-highlight-label">만족도 점수</span>
          <span className="ai-hero-highlight-score">
            {d.score.toFixed(1)}
            <em>점</em>
          </span>
        </div>
        <div className="ai-hero-highlight-side">
          <span className={`ai-hero-pill${isOver ? ' ai-hero-pill--pos' : ' ai-hero-pill--warn'}`}>
            {isOver ? '목표 초과' : '목표 미달'}
          </span>
          <span className="ai-hero-delta">
            목표 대비 <strong>{isOver ? '+' : '-'}{delta}%p</strong>
          </span>
          <span className="ai-hero-n">
            샘플 <strong>{d.totalSamples}</strong>건 분석
          </span>
        </div>
      </div>

      {/* ── Insight 카드 그리드 (우측 영역 메인) ── */}
      <ul className="ai-feed-list ai-feed-list--hero">
        {feed.map((item, idx) => {
          const s = FEED_STYLE[item.type] ?? FEED_STYLE.tip;
          const Icon = s.icon;
          return (
            <li key={idx} className="ai-feed-item ai-feed-item--hero">
              <div className="ai-feed-icon-chip ai-feed-icon-chip--hero" aria-hidden>
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className="ai-feed-content">
                <span className="ai-feed-label">{item.tag}</span>
                <p className="ai-feed-body">{item.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="ai-disclaimer ai-disclaimer--hero">AI 생성 요약이며 참고용입니다.</p>
    </div>
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
    const base = isError || !satRaw ? { ...MOCK_DATA } : satRaw;
    const f = focusRaw ?? {};
    return {
      ...base,
      fiveMajorCitiesCount: f.fiveMajorCitiesCount ?? base.fiveMajorCitiesCount ?? 0,
      gen5060Count: f.gen5060Count ?? base.gen5060Count ?? 0,
      problemResolvedCount: f.problemResolvedCount ?? base.problemResolvedCount ?? 0,
    };
  }, [satRaw, isError, focusRaw]);

  return (
    <div className="page-container cs-sat-page adm-dashboard--yp fade-in">

      <header className="adm-header adm-header--yp cs-sat-page-header">
        <div className="adm-header-text">
          <h1 className="adm-title">만족도</h1>
          <p className="adm-sub">나의 CS 만족도 현황과 추이를 한눈에 확인하세요.</p>
        </div>
      </header>

      <CsSatisfactionKpiRow data={satData} year={year} month={month} />

      <div className="cs-sat-hero-layout">
        <div className="cs-sat-hero-left">
          <MonthlyAccumulatedPanel data={satData} year={year} month={month}>
            <UnsatisfiedCategoriesPanel
              embedded
              categories={satData?.unsatisfiedCategories}
              year={year}
              month={month}
              skid={user?.skid}
              detailFallbackByType={MOCK_DATA.unsatisfiedDetailSamples}
            />
          </MonthlyAccumulatedPanel>
        </div>
        <div className="cs-sat-hero-ai">
          <AiInsightPanel data={satData} />
        </div>
      </div>
    </div>
  );
}
