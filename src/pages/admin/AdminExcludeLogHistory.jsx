import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  allExcludeRangeDayKeys,
  currentDayKeyKst,
  currentMonthKeyKst,
  entryTouchesMonth,
  excludeEntryCoversDay,
  excludeRangeDayKeys,
  excludeRangeDayKeysInMonth,
  formatExcludeRangeSpan,
  rangeStartSortKey,
} from '../../utils/excludeLogDateTime';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthKeyFromParts(y, m) {
  return `${y}-${pad2(m)}`;
}

function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const date = new Date(y, m - 1 + delta, 1);
  return monthKeyFromParts(date.getFullYear(), date.getMonth() + 1);
}

function buildCalendarCells(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return [];
  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${y}-${pad2(m)}-${pad2(d)}`);
  }
  return cells;
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return `${y}년 ${m}월`;
}

function latestEntryMonthKey(entries) {
  const days = allExcludeRangeDayKeys(entries);
  if (!days.length) return currentMonthKeyKst();
  return days[days.length - 1].slice(0, 7);
}

function latestDayInMonth(entries, monthKey) {
  const days = excludeRangeDayKeysInMonth(entries, monthKey);
  return days.length ? days[days.length - 1] : null;
}

export { formatExcludeRangeSpan } from '../../utils/excludeLogDateTime';

export default function AdminExcludeLogHistory({
  entries = [],
  isLoading,
  isError,
  onCancel,
  cancelPendingId,
}) {
  const todayKey = currentDayKeyKst();
  const [monthKey, setMonthKey] = useState(() => latestEntryMonthKey(entries));
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  /** 일자별 제외 적용 건수 — start_at ~ end_at 구간 기준 */
  const rangeCountByDay = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      for (const day of excludeRangeDayKeys(e)) {
        map.set(day, (map.get(day) ?? 0) + 1);
      }
    }
    return map;
  }, [entries]);

  const cells = useMemo(() => buildCalendarCells(monthKey), [monthKey]);

  const entriesForDay = useMemo(() => {
    if (!selectedDayKey) return [];
    return entries
      .filter((e) => excludeEntryCoversDay(e, selectedDayKey))
      .sort((a, b) => rangeStartSortKey(b).localeCompare(rangeStartSortKey(a), 'ko'));
  }, [entries, selectedDayKey]);

  useEffect(() => {
    if (isLoading) return;
    setMonthKey((prev) => {
      if (!entries.length) return currentMonthKeyKst();
      const latest = latestEntryMonthKey(entries);
      const hasInPrev = entries.some((e) => entryTouchesMonth(e, prev));
      return hasInPrev ? prev : latest;
    });
  }, [entries, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const dayInMonth = latestDayInMonth(entries, monthKey);
    setSelectedDayKey((prev) => {
      if (prev && prev.startsWith(`${monthKey}-`) && rangeCountByDay.has(prev)) return prev;
      return dayInMonth;
    });
  }, [entries, monthKey, isLoading, rangeCountByDay]);

  const selectedDayLabel = selectedDayKey
    ? `${Number(selectedDayKey.slice(5, 7))}월 ${Number(selectedDayKey.slice(8, 10))}일`
    : null;

  if (isLoading) {
    return <p className="adm-sat-exclude-history-empty">불러오는 중…</p>;
  }
  if (isError) {
    return <p className="adm-sat-exclude-history-empty">이력을 불러오지 못했습니다.</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="adm-sat-exclude-history-empty">
        저장된 이력이 없습니다. 제외를 적용하면 스킬·구간·건수가 기록됩니다.
      </p>
    );
  }

  return (
    <div className="adm-sat-exclude-history-panel">
      <aside className="adm-sat-exclude-cal" aria-label="평가 제외 이력 달력">
        <div className="adm-sat-exclude-cal-nav">
          <button
            type="button"
            className="btn btn-secondary btn-sm adm-sat-exclude-cal-nav-btn"
            onClick={() => setMonthKey((k) => addMonths(k, -1))}
            aria-label="이전 달"
          >
            <ChevronLeft size={14} aria-hidden />
          </button>
          <span className="adm-sat-exclude-cal-month">{formatMonthLabel(monthKey)}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm adm-sat-exclude-cal-nav-btn"
            onClick={() => setMonthKey((k) => addMonths(k, 1))}
            aria-label="다음 달"
          >
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
        <div className="adm-sat-exclude-cal-grid-wrap" role="grid" aria-label={`${formatMonthLabel(monthKey)} 달력`}>
          <div className="adm-sat-exclude-cal-weekdays" role="row">
            {WEEKDAYS.map((w) => (
              <span key={w} className="adm-sat-exclude-cal-weekday" role="columnheader">
                {w}
              </span>
            ))}
          </div>
          <div className="adm-sat-exclude-cal-grid">
            {cells.map((dayKey, idx) => {
              if (!dayKey) {
                return (
                  <span
                    key={`empty-${idx}`}
                    className="adm-sat-exclude-cal-cell adm-sat-exclude-cal-cell--empty"
                  />
                );
              }
              const savedCount = rangeCountByDay.get(dayKey) ?? 0;
              const hasEntries = savedCount > 0;
              const isFuture = dayKey > todayKey;
              const isSelected = selectedDayKey === dayKey;
              const isToday = dayKey === todayKey;
              const dayNum = Number(dayKey.slice(8, 10));

              return (
                <button
                  key={dayKey}
                  type="button"
                  role="gridcell"
                  disabled={!hasEntries}
                  className={[
                    'adm-sat-exclude-cal-cell',
                    hasEntries ? 'has-entries' : '',
                    isSelected ? 'is-selected' : '',
                    isToday ? 'is-today' : '',
                    isFuture ? 'is-future' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelectedDayKey(dayKey)}
                  aria-pressed={isSelected}
                  aria-label={
                    hasEntries
                      ? `${dayNum}일, 제외 ${savedCount}건`
                      : `${dayNum}일`
                  }
                >
                  <span className="adm-sat-exclude-cal-day">{dayNum}</span>
                  <span
                    className={`adm-sat-exclude-cal-count ${
                      hasEntries ? '' : 'adm-sat-exclude-cal-count--empty'
                    }`}
                  >
                    {hasEntries ? `${savedCount}건` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="adm-sat-exclude-day-list" aria-label="선택 일자 평가 제외 이력">
        {selectedDayKey && selectedDayLabel ? (
          <p className="adm-sat-exclude-day-list-title">
            {selectedDayLabel}
            <span className="adm-sat-exclude-day-list-sub">
              적용 {entriesForDay.length}건 · 제외{' '}
              {entriesForDay
                .reduce((s, e) => s + Number(e.updatedRowCount ?? 0), 0)
                .toLocaleString('ko-KR')}
              건
            </span>
          </p>
        ) : (
          <p className="adm-sat-exclude-day-list-title">일자를 선택해 주세요</p>
        )}

        {!selectedDayKey || entriesForDay.length === 0 ? (
          <p className="adm-sat-exclude-history-empty">
            {selectedDayKey ? '이 날짜에 해당하는 평가 제외 이력이 없습니다.' : '달력에서 일자를 선택하세요.'}
          </p>
        ) : (
          <ul className="adm-sat-exclude-day-items">
            {entriesForDay.map((e) => {
              const pending = cancelPendingId === e.id;
              return (
                <li key={e.id} className="adm-sat-exclude-day-item">
                  <p
                    className="adm-sat-exclude-day-item-line"
                    title={`${e.skill} · ${formatExcludeRangeSpan(e.startAt, e.endAt)}`}
                  >
                    <span className="adm-sat-exclude-day-item-skill">{e.skill}</span>
                    <span className="adm-sat-exclude-day-item-sep" aria-hidden>
                      ·
                    </span>
                    <span className="adm-sat-exclude-day-item-range">
                      {formatExcludeRangeSpan(e.startAt, e.endAt)}
                    </span>
                    <span className="adm-sat-exclude-day-item-sep" aria-hidden>
                      ·
                    </span>
                    <span className="adm-sat-exclude-day-item-count">
                      {Number(e.updatedRowCount ?? 0).toLocaleString('ko-KR')}건 제외
                    </span>
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm adm-sat-exclude-cancel-btn"
                    disabled={pending || cancelPendingId != null}
                    onClick={() => onCancel(e)}
                  >
                    {pending ? '취소 중…' : '제외 취소'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
