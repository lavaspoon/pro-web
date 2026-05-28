import React from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CsSatisfactionModalPeriodToolbar({
  monthLabel,
  dayLabel,
  dayPickerOpen = false,
  dayFilterActive = false,
  canPrevMonth = false,
  canNextMonth = false,
  onPrevMonth,
  onNextMonth,
  onOpenDayPicker,
}) {
  return (
    <div
      className="pending-table-toolbar-period csx-modal-period-toolbar"
      role="group"
      aria-label="접수 기간 선택"
    >
      <div className="pending-table-toolbar-month" role="group" aria-label="접수 월 이동">
        <button
          type="button"
          className="pending-month-nav-btn"
          disabled={!canPrevMonth}
          onClick={onPrevMonth}
          aria-label="이전 달"
        >
          <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
        </button>
        <span className="pending-month-nav-label">{monthLabel}</span>
        <button
          type="button"
          className="pending-month-nav-btn"
          disabled={!canNextMonth}
          onClick={onNextMonth}
          aria-label="다음 달"
        >
          <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <button
        type="button"
        className={`pending-day-picker-btn${dayFilterActive ? ' is-active' : ''}`}
        onClick={onOpenDayPicker}
        aria-haspopup="dialog"
        aria-expanded={dayPickerOpen}
        title="일자 선택"
      >
        <Calendar size={14} aria-hidden />
        <span>{dayLabel}</span>
        <ChevronDown size={14} className="pending-day-picker-btn__chev" aria-hidden />
      </button>
    </div>
  );
}
