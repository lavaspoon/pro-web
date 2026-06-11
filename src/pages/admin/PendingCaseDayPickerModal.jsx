import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { fmtPct } from '../../utils/csSatisfactionModalDayStats';
import './PendingCaseDayPickerModal.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function currentDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildCalendarCells(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return [];
  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
}

function formatModalTitle(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return `${y}년 ${m}월`;
}

function buildDayAriaLabel(dayKey, stats, fallbackCount) {
  const day = Number(dayKey.slice(8, 10));
  if (stats?.evalCount > 0) {
    return `${day}일, 평가모수 ${stats.evalCount}건, 만족모수 ${stats.satisfiedCount}건, 만족도 ${fmtPct(stats.satisfactionRate)}`;
  }
  if (fallbackCount > 0) {
    return `${day}일, 접수 ${fallbackCount}건`;
  }
  return `${day}일`;
}

export default function PendingCaseDayPickerModal({
  open,
  monthKey,
  selectedDayKey,
  caseCountByDay,
  dayStatsByDay,
  onClose,
  onSelectDay,
}) {
  const todayKey = currentDayKey();
  const cells = useMemo(() => buildCalendarCells(monthKey), [monthKey]);
  const showSatisfactionPreview = dayStatsByDay instanceof Map;

  if (!open) return null;

  return createPortal(
    <div className="pending-daypicker-backdrop" onClick={onClose} role="presentation">
      <div
        className={`pending-daypicker-modal${showSatisfactionPreview ? ' pending-daypicker-modal--satisfaction' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-daypicker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pending-daypicker-head">
          <h2 id="pending-daypicker-title" className="pending-daypicker-title">
            일자 선택
          </h2>
          <button type="button" className="pending-daypicker-close" onClick={onClose} aria-label="닫기">
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className="pending-daypicker-desc">
          {formatModalTitle(monthKey)} 접수 일자를 선택하세요.
          {showSatisfactionPreview ? ' 각 일자에 평가모수·만족모수·만족도가 표시됩니다.' : null}
        </p>

        {showSatisfactionPreview ? (
          <div className="pending-daypicker-legend" aria-hidden>
            <span className="pending-daypicker-badge pending-daypicker-badge--eval">평가모수</span>
            <span className="pending-daypicker-badge pending-daypicker-badge--sat">만족모수</span>
            <span className="pending-daypicker-badge pending-daypicker-badge--rate">만족도</span>
          </div>
        ) : null}

        <button
          type="button"
          className={`pending-daypicker-all${selectedDayKey == null ? ' is-active' : ''}`}
          onClick={() => onSelectDay(null)}
          aria-pressed={selectedDayKey == null}
        >
          날짜 선택
        </button>

        <div className="pending-daypicker-calendar" role="grid" aria-label={`${formatModalTitle(monthKey)} 달력`}>
          <div className="pending-daypicker-weekdays" role="row">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pending-daypicker-weekday" role="columnheader">
                {w}
              </span>
            ))}
          </div>
          <div className="pending-daypicker-grid">
            {cells.map((dayKey, idx) => {
              if (!dayKey) {
                return <span key={`empty-${idx}`} className="pending-daypicker-cell pending-daypicker-cell--empty" />;
              }
              const isFuture = dayKey > todayKey;
              const isSelected = selectedDayKey === dayKey;
              const isToday = dayKey === todayKey;
              const stats = dayStatsByDay?.get(dayKey);
              const fallbackCount = caseCountByDay?.get(dayKey) ?? 0;
              const evalCount = stats?.evalCount ?? 0;
              const hasPreview = showSatisfactionPreview && evalCount > 0;
              const hasCases = hasPreview || fallbackCount > 0;

              return (
                <button
                  key={dayKey}
                  type="button"
                  role="gridcell"
                  disabled={isFuture}
                  className={[
                    'pending-daypicker-cell',
                    showSatisfactionPreview ? 'pending-daypicker-cell--rich' : '',
                    isSelected ? 'is-selected' : '',
                    isToday ? 'is-today' : '',
                    hasCases ? 'has-cases' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelectDay(dayKey)}
                  aria-pressed={isSelected}
                  aria-label={buildDayAriaLabel(dayKey, stats, fallbackCount)}
                >
                  <span className="pending-daypicker-cell-day">{Number(dayKey.slice(8, 10))}</span>
                  {hasPreview ? (
                    <span className="pending-daypicker-cell-badges">
                      <span className="pending-daypicker-badge pending-daypicker-badge--eval">
                        평가모수 {evalCount}
                      </span>
                      <span className="pending-daypicker-badge pending-daypicker-badge--sat">
                        만족모수 {stats.satisfiedCount}
                      </span>
                      <span className="pending-daypicker-badge pending-daypicker-badge--rate">
                        {fmtPct(stats.satisfactionRate)}
                      </span>
                    </span>
                  ) : fallbackCount > 0 ? (
                    <span className="pending-daypicker-cell-count">{fallbackCount}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
