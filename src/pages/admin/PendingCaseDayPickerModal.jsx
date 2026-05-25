import React, { useMemo } from 'react';
import { X } from 'lucide-react';
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

export default function PendingCaseDayPickerModal({
  open,
  monthKey,
  selectedDayKey,
  caseCountByDay,
  onClose,
  onSelectDay,
}) {
  const todayKey = currentDayKey();
  const cells = useMemo(() => buildCalendarCells(monthKey), [monthKey]);

  if (!open) return null;

  return (
    <div className="pending-daypicker-backdrop" onClick={onClose} role="presentation">
      <div
        className="pending-daypicker-modal"
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
        <p className="pending-daypicker-desc">{formatModalTitle(monthKey)} 접수 일자를 선택하세요.</p>

        <button
          type="button"
          className={`pending-daypicker-all${selectedDayKey == null ? ' is-active' : ''}`}
          onClick={() => onSelectDay(null)}
          aria-pressed={selectedDayKey == null}
        >
          전체
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
              const count = caseCountByDay?.get(dayKey) ?? 0;
              return (
                <button
                  key={dayKey}
                  type="button"
                  role="gridcell"
                  disabled={isFuture}
                  className={[
                    'pending-daypicker-cell',
                    isSelected ? 'is-selected' : '',
                    isToday ? 'is-today' : '',
                    count > 0 ? 'has-cases' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelectDay(dayKey)}
                  aria-pressed={isSelected}
                  aria-label={`${Number(dayKey.slice(8, 10))}일${count > 0 ? `, 접수 ${count}건` : ''}`}
                >
                  <span className="pending-daypicker-cell-day">{Number(dayKey.slice(8, 10))}</span>
                  {count > 0 ? <span className="pending-daypicker-cell-count">{count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
