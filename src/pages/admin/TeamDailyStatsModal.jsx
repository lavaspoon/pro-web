import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchTeamDailyStats } from '../../api/adminApi';
import './TeamDailyStatsModal.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function currentDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(monthKey) {
  const [y, m] = (monthKey ?? '').split('-').map(Number);
  return { year: y || 0, month: m || 0 };
}

function formatMonthLabel(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  if (!year || !month) return monthKey ?? '';
  return `${year}년 ${month}월`;
}

function shiftMonth(monthKey, delta) {
  const { year, month } = parseMonthKey(monthKey);
  if (!year || !month) return monthKey;
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildCalendarCells(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  if (!year || !month) return [];
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
}

export default function TeamDailyStatsModal({
  open,
  team,
  monthKey,
  onClose,
  onMonthChange,
}) {
  const todayKey = useMemo(() => currentDayKey(), []);
  const maxMonthKey = useMemo(() => currentMonthKey(), []);
  const safeMonthKey = monthKey ?? maxMonthKey;

  const { year, month } = parseMonthKey(safeMonthKey);
  const cells = useMemo(() => buildCalendarCells(safeMonthKey), [safeMonthKey]);

  const { data, isLoading } = useQuery({
    queryKey: ['team-daily-stats', team?.id, year, month],
    queryFn: () => fetchTeamDailyStats(team.id, year, month),
    enabled: open && team != null && year > 0 && month > 0,
  });

  const statsByDay = useMemo(() => {
    const map = new Map();
    for (const s of data?.dailyStats ?? []) {
      if (s.date) {
        map.set(s.date, {
          submitted: Number(s.submitted ?? 0),
          certified: Number(s.certified ?? s.selected ?? 0),
        });
      }
    }
    return map;
  }, [data?.dailyStats]);

  const monthTotals = useMemo(() => {
    let sub = 0;
    let cert = 0;
    statsByDay.forEach(({ submitted, certified }) => {
      sub += submitted;
      cert += certified;
    });
    return { submitted: sub, certified: cert };
  }, [statsByDay]);

  if (!open) return null;

  const canNext = safeMonthKey < maxMonthKey;

  return createPortal(
    <div className="tdm-backdrop" onClick={onClose} role="presentation">
      <div
        className="tdm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tdm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tdm-head">
          <div className="tdm-head-left">
            <h2 id="tdm-title" className="tdm-title">
              {team?.name ?? ''}&nbsp;일별 접수·인증
            </h2>
            {!isLoading && (
              <p className="tdm-subtitle">
                {formatMonthLabel(safeMonthKey)}&nbsp;·&nbsp;접수{' '}
                <strong>{monthTotals.submitted}건</strong>&nbsp;/&nbsp;인증{' '}
                <strong>{monthTotals.certified}건</strong>
              </p>
            )}
          </div>
          <button
            type="button"
            className="tdm-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="tdm-month-nav" role="group" aria-label="월 이동">
          <button
            type="button"
            className="tdm-month-btn"
            onClick={() => onMonthChange(shiftMonth(safeMonthKey, -1))}
            aria-label="이전 달"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <span className="tdm-month-label">{formatMonthLabel(safeMonthKey)}</span>
          <button
            type="button"
            className="tdm-month-btn"
            disabled={!canNext}
            onClick={() => onMonthChange(shiftMonth(safeMonthKey, 1))}
            aria-label="다음 달"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>

        <div className="tdm-legend" aria-hidden>
          <span className="tdm-badge tdm-badge--sub">접수</span>
          <span className="tdm-badge tdm-badge--cert">인증</span>
        </div>

        {isLoading ? (
          <div className="tdm-loading">
            <div className="spinner" />
            <p>데이터를 불러오는 중…</p>
          </div>
        ) : (
          <div
            className="tdm-calendar"
            role="grid"
            aria-label={`${formatMonthLabel(safeMonthKey)} 달력`}
          >
            <div className="tdm-weekdays" role="row">
              {WEEKDAYS.map((w) => (
                <span key={w} className="tdm-weekday" role="columnheader">
                  {w}
                </span>
              ))}
            </div>
            <div className="tdm-grid">
              {cells.map((dayKey, idx) => {
                if (!dayKey) {
                  return (
                    <span
                      key={`empty-${idx}`}
                      className="tdm-cell tdm-cell--empty"
                      aria-hidden
                    />
                  );
                }
                const isFuture = dayKey > todayKey;
                const isToday = dayKey === todayKey;
                const stats = statsByDay.get(dayKey);
                const submitted = stats?.submitted ?? 0;
                const certified = stats?.certified ?? 0;
                const hasData = submitted > 0 || certified > 0;

                return (
                  <div
                    key={dayKey}
                    role="gridcell"
                    className={[
                      'tdm-cell',
                      isFuture ? 'tdm-cell--future' : '',
                      isToday ? 'tdm-cell--today' : '',
                      hasData ? 'tdm-cell--has-data' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={`${Number(dayKey.slice(8, 10))}일${
                      hasData
                        ? `, 접수 ${submitted}건, 인증 ${certified}건`
                        : ''
                    }`}
                  >
                    <span className="tdm-cell-day">
                      {Number(dayKey.slice(8, 10))}
                    </span>
                    {hasData ? (
                      <span className="tdm-cell-badges">
                        <span className="tdm-badge tdm-badge--sub">
                          접수 {submitted}
                        </span>
                        <span className="tdm-badge tdm-badge--cert">
                          인증 {certified}
                        </span>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
