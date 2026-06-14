import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  fetchCsSatisfactionEvalCountDaily,
  fetchCsSatisfactionEvalCountDayDetail,
} from '../../api/adminApi';
import './AdminCsEvalCountDailyModal.css';
import './PendingCaseDayPickerModal.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const PAGE_SIZE = 10;

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return `${y}년 ${m}월`;
}

function formatDayLabel(dayKey) {
  if (!dayKey || dayKey.length < 10) return dayKey ?? '—';
  const y = dayKey.slice(0, 4);
  const m = Number(dayKey.slice(5, 7));
  const d = Number(dayKey.slice(8, 10));
  return `${y}년 ${m}월 ${d}일`;
}

function formatDateTime(dt) {
  if (!dt) return '—';
  return String(dt).replace('T', ' ');
}

function num(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('ko-KR');
}

function monthPartsFromKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return { year: y, month: m };
}

function memberLabel(m) {
  const name = m?.mbName?.trim();
  const skid = m?.skid?.trim();
  if (name && skid) return `${name} (${skid})`;
  return name || skid || '—';
}

function compareValues(a, b, dir) {
  const av = a ?? '';
  const bv = b ?? '';
  if (typeof a === 'number' && typeof b === 'number') {
    return dir === 'asc' ? a - b : b - a;
  }
  const cmp = String(av).localeCompare(String(bv), 'ko');
  return dir === 'asc' ? cmp : -cmp;
}

function usePagedSort(items, defaultSortKey, getValue, resetKey, options = {}) {
  const { defaultSortDir = 'desc', secondarySort = [], defaultDirForKey } = options;
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    setSortKey(defaultSortKey);
    setSortDir(defaultSortDir);
  }, [resetKey, defaultSortKey, defaultSortDir]);

  const sorted = useMemo(() => {
    const list = [...(items ?? [])];
    list.sort((a, b) => {
      let cmp = compareValues(getValue(a, sortKey), getValue(b, sortKey), sortDir);
      if (cmp !== 0) return cmp;
      for (const { key, dir } of secondarySort) {
        if (key === sortKey) continue;
        cmp = compareValues(getValue(a, key), getValue(b, key), dir);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
    return list;
  }, [items, sortKey, sortDir, getValue, secondarySort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const toggleSort = useCallback((key) => {
    setPage(1);
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      const dir = defaultDirForKey?.(key)
        ?? (key === 'evalCount' || key === 'recordId' ? 'desc' : 'asc');
      setSortDir(dir);
      return key;
    });
  }, [defaultDirForKey]);

  return { paged, sorted, page, totalPages, setPage, sortKey, sortDir, toggleSort };
}

function SortableTh({ label, sortKey, activeKey, sortDir, onSort, className }) {
  const active = activeKey === sortKey;
  return (
    <th scope="col" className={className}>
      <button
        type="button"
        className={`adm-cs-evalcount-sort-btn${active ? ' is-active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span className="adm-cs-evalcount-sort-icon" aria-hidden>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

function TablePagination({ page, totalPages, totalCount, onPrev, onNext }) {
  if (totalCount === 0) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalCount);
  return (
    <div className="adm-cs-evalcount-pagination">
      <span className="adm-cs-evalcount-pagination-info">
        {num(start)}–{num(end)} / {num(totalCount)}건 · {page} / {totalPages}페이지
      </span>
      <div className="adm-cs-evalcount-pagination-actions">
        <button type="button" className="adm-cs-evalcount-page-btn" onClick={onPrev} disabled={page <= 1}>
          이전
        </button>
        <button
          type="button"
          className="adm-cs-evalcount-page-btn"
          onClick={onNext}
          disabled={page >= totalPages}
        >
          다음
        </button>
      </div>
    </div>
  );
}

function CalendarStep({
  monthKey,
  setMonthKey,
  countByDate,
  monthTotal,
  monthQuery,
  onSelectDay,
}) {
  const todayKey = currentDayKey();
  const maxMonthKey = currentMonthKey();
  const cells = useMemo(() => buildCalendarCells(monthKey), [monthKey]);
  const canPrevMonth = true;
  const canNextMonth = monthKey < maxMonthKey;

  if (monthQuery.isLoading) {
    return (
      <div className="adm-cs-evalcount-step-fill adm-team-detail-loading adm-cs-evalcount-loading">
        <div className="spinner" />
        <p>일별 평가모수를 불러오는 중…</p>
      </div>
    );
  }

  if (monthQuery.isError) {
    return (
      <p className="adm-sat-query-err">
        {monthQuery.error?.message ?? '일별 평가모수를 불러오지 못했습니다.'}
      </p>
    );
  }

  return (
    <div className="adm-cs-evalcount-step-fill adm-cs-evalcount-step--calendar">
      <div className="adm-cs-evalcount-toolbar" role="group" aria-label="조회 월 이동">
        <button
          type="button"
          className="adm-cs-evalcount-nav-btn"
          disabled={!canPrevMonth}
          onClick={() => setMonthKey((k) => addMonths(k, -1))}
          aria-label="이전 달"
        >
          <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
        </button>
        <strong className="adm-cs-evalcount-month-label">{formatMonthLabel(monthKey)}</strong>
        <button
          type="button"
          className="adm-cs-evalcount-nav-btn"
          disabled={!canNextMonth}
          onClick={() => setMonthKey((k) => addMonths(k, 1))}
          aria-label="다음 달"
        >
          <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      <p className="adm-cs-evalcount-total">
        {formatMonthLabel(monthKey)} 합계 <strong>{num(monthTotal)}</strong>건
        <span className="adm-cs-evalcount-total-hint"> · 일자를 클릭하면 구성원별 건수를 확인할 수 있습니다</span>
      </p>

      <div className="pending-daypicker-legend" aria-hidden>
        <span className="pending-daypicker-badge pending-daypicker-badge--eval">평가모수</span>
      </div>

      <div className="adm-cs-evalcount-calendar-scroll">
        <div
          className="pending-daypicker-calendar adm-cs-evalcount-calendar"
          role="grid"
          aria-label={`${formatMonthLabel(monthKey)} 달력`}
        >
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
                return (
                  <span
                    key={`empty-${idx}`}
                    className="pending-daypicker-cell pending-daypicker-cell--empty"
                  />
                );
              }
              const isFuture = dayKey > todayKey;
              const isToday = dayKey === todayKey;
              const evalCount = countByDate.get(dayKey) ?? 0;
              const hasCount = evalCount > 0;

              return (
                <button
                  key={dayKey}
                  type="button"
                  role="gridcell"
                  disabled={isFuture}
                  className={[
                    'pending-daypicker-cell',
                    'pending-daypicker-cell--rich',
                    'adm-cs-evalcount-cell',
                    isToday ? 'is-today' : '',
                    hasCount ? 'has-cases' : '',
                    isFuture ? 'adm-cs-evalcount-cell--future' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={`${Number(dayKey.slice(8, 10))}일, 평가모수 ${evalCount}건`}
                  onClick={() => onSelectDay(dayKey)}
                >
                  <span className="pending-daypicker-cell-day">{Number(dayKey.slice(8, 10))}</span>
                  {!isFuture ? (
                    <span className="pending-daypicker-cell-badges">
                      <span className="pending-daypicker-badge pending-daypicker-badge--eval">
                        {num(evalCount)}건
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const memberSortValue = (row, key) => {
  if (key === 'evalCount') return Number(row.evalCount) || 0;
  return row[key] ?? '';
};

const rawSortValue = (row, key) => {
  if (key === 'recordId') return Number(row.recordId) || 0;
  if (key === 'consultDateTime') return row.consultDateTime ?? '';
  return row[key] ?? '';
};

function MembersStep({ dayKey, dayDetailQuery, onSelectMember }) {
  const members = dayDetailQuery.data?.memberSummaries ?? [];
  const [skidSearch, setSkidSearch] = useState('');

  useEffect(() => {
    setSkidSearch('');
  }, [dayKey]);

  const filteredMembers = useMemo(() => {
    const q = skidSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => String(m.skid ?? '').toLowerCase().includes(q));
  }, [members, skidSearch]);

  const {
    paged,
    sorted,
    page,
    totalPages,
    setPage,
    sortKey,
    sortDir,
    toggleSort,
  } = usePagedSort(filteredMembers, 'deptName', memberSortValue, `${dayKey}:${skidSearch}`, {
    defaultSortDir: 'asc',
    secondarySort: [{ key: 'evalCount', dir: 'asc' }],
    defaultDirForKey: () => 'asc',
  });

  const isSearching = skidSearch.trim().length > 0;

  if (dayDetailQuery.isLoading) {
    return (
      <div className="adm-cs-evalcount-step-fill adm-team-detail-loading adm-cs-evalcount-detail-loading">
        <div className="spinner" />
        <p>구성원별 건수를 불러오는 중…</p>
      </div>
    );
  }

  if (dayDetailQuery.isError) {
    return (
      <p className="adm-sat-query-err">
        {dayDetailQuery.error?.message ?? '구성원별 건수를 불러오지 못했습니다.'}
      </p>
    );
  }

  return (
    <div className="adm-cs-evalcount-step-fill adm-cs-evalcount-step--table">
      <p className="adm-cs-evalcount-step-desc">
        {formatDayLabel(dayKey)} · 총 <strong>{num(dayDetailQuery.data?.totalCount)}</strong>건
        {isSearching ? (
          <>
            {' '}
            · 구성원 <strong>{num(sorted.length)}</strong>명
            <span className="adm-cs-evalcount-total-hint"> (전체 {num(members.length)}명)</span>
          </>
        ) : null}
        <span className="adm-cs-evalcount-total-hint"> · 행을 클릭하면 raw 데이터를 확인할 수 있습니다</span>
      </p>

      <div className="adm-cs-evalcount-member-toolbar">
        <label className="adm-cs-evalcount-skid-search">
          <span className="adm-cs-evalcount-skid-search-label">사번 검색</span>
          <input
            type="text"
            className="adm-cs-evalcount-skid-search-input"
            value={skidSearch}
            onChange={(e) => setSkidSearch(e.target.value)}
            placeholder="사번 입력"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {isSearching ? (
          <button
            type="button"
            className="adm-cs-evalcount-skid-search-clear"
            onClick={() => setSkidSearch('')}
          >
            초기화
          </button>
        ) : null}
      </div>

      <div className="adm-cs-evalcount-table-panel">
        <div className="adm-cs-evalcount-table-scroll">
          <table className="adm-cs-evalcount-data-table adm-cs-evalcount-member-table">
            <thead>
              <tr>
                <SortableTh label="부서명" sortKey="deptName" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="사번" sortKey="skid" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="이름" sortKey="mbName" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="스킬" sortKey="skill" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="평가대상자" sortKey="csYn" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh
                  label="건수"
                  sortKey="evalCount"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="adm-cs-evalcount-col-num"
                />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="adm-cs-evalcount-empty">
                    {isSearching ? '검색 결과 없음' : '해당 일자 데이터 없음'}
                  </td>
                </tr>
              ) : (
                paged.map((m) => (
                  <tr
                    key={m.skid ?? m.mbName}
                    className="adm-cs-evalcount-click-row"
                    onClick={() => onSelectMember(m)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectMember(m);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    <td className="adm-cs-evalcount-col-dept">{m.deptName?.trim() ? m.deptName : '—'}</td>
                    <td>{m.skid ?? '—'}</td>
                    <td>{m.mbName ?? '—'}</td>
                    <td>{m.skill?.trim() ? m.skill : '—'}</td>
                    <td>
                      <span className="adm-cs-evalcount-yn">{m.csYn ?? '—'}</span>
                    </td>
                    <td className="adm-cs-evalcount-col-num">{num(m.evalCount)}건</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalCount={sorted.length}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>
    </div>
  );
}

function RawStep({ dayKey, member, rows, resetKey }) {
  const {
    paged,
    sorted,
    page,
    totalPages,
    setPage,
    sortKey,
    sortDir,
    toggleSort,
  } = usePagedSort(rows, 'consultDateTime', rawSortValue, resetKey);

  return (
    <div className="adm-cs-evalcount-step-fill adm-cs-evalcount-step--table">
      <p className="adm-cs-evalcount-step-desc">
        {formatDayLabel(dayKey)} · {memberLabel(member)} · <strong>{num(rows.length)}</strong>건
      </p>

      <div className="adm-cs-evalcount-table-panel">
        <div className="adm-cs-evalcount-table-scroll">
          <table className="adm-cs-evalcount-data-table adm-cs-evalcount-raw-table">
            <thead>
              <tr>
                <SortableTh label="ID" sortKey="recordId" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh
                  label="상담일시"
                  sortKey="consultDateTime"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh label="사번" sortKey="skid" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="이름" sortKey="mbName" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="평가대상자" sortKey="csYn" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="스킬" sortKey="skill" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh
                  label="만족여부"
                  sortKey="satisfiedYn"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="평가여부"
                  sortKey="evalYn"
                  activeKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="adm-cs-evalcount-empty">
                    raw 데이터 없음
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr key={row.recordId ?? `${row.consultDateTime}-${row.skid}`}>
                    <td className="adm-cs-evalcount-col-id">{row.recordId ?? '—'}</td>
                    <td className="adm-cs-evalcount-col-dt">{formatDateTime(row.consultDateTime)}</td>
                    <td>{row.skid ?? '—'}</td>
                    <td>{row.mbName ?? '—'}</td>
                    <td>
                      <span className="adm-cs-evalcount-yn">{row.csYn ?? '—'}</span>
                    </td>
                    <td>{row.skill ?? '—'}</td>
                    <td>
                      <span
                        className={`adm-cs-evalcount-yn adm-cs-evalcount-yn--${String(row.satisfiedYn ?? '').trim().toUpperCase()}`}
                      >
                        {row.satisfiedYn ?? '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`adm-cs-evalcount-yn adm-cs-evalcount-yn--${String(row.evalYn ?? '').trim().toUpperCase()}`}
                      >
                        {row.evalYn ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalCount={sorted.length}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>
    </div>
  );
}

export default function AdminCsEvalCountDailyModal({ open, onClose, initialMonthKey }) {
  const maxMonthKey = currentMonthKey();

  const [monthKey, setMonthKey] = useState(() => initialMonthKey || maxMonthKey);
  const [step, setStep] = useState('calendar');
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    if (!open) return;
    setMonthKey(initialMonthKey || maxMonthKey);
    setStep('calendar');
    setSelectedDayKey(null);
    setSelectedMember(null);
  }, [open, initialMonthKey, maxMonthKey]);

  useEffect(() => {
    setStep('calendar');
    setSelectedDayKey(null);
    setSelectedMember(null);
  }, [monthKey]);

  const { year, month } = monthPartsFromKey(monthKey);

  const monthQuery = useQuery({
    queryKey: ['cs-satisfaction-eval-count-daily', year, month],
    queryFn: () => fetchCsSatisfactionEvalCountDaily({ year, month, rollingThroughYesterday: false }),
    enabled: open && step === 'calendar' && Boolean(year && month),
    staleTime: 30_000,
  });

  const dayDetailQuery = useQuery({
    queryKey: ['cs-satisfaction-eval-count-day-detail', selectedDayKey],
    queryFn: () => fetchCsSatisfactionEvalCountDayDetail(selectedDayKey),
    enabled: open && Boolean(selectedDayKey) && step !== 'calendar',
    staleTime: 15_000,
  });

  const countByDate = useMemo(() => {
    const map = new Map();
    for (const row of monthQuery.data?.days ?? []) {
      if (row?.date) map.set(row.date, Number(row.evalCount) || 0);
    }
    return map;
  }, [monthQuery.data]);

  const monthTotal = useMemo(() => {
    const days = monthQuery.data?.days ?? [];
    if (days.length > 0) {
      return days.reduce((sum, d) => sum + (Number(d.evalCount) || 0), 0);
    }
    return [...countByDate.values()].reduce((sum, n) => sum + n, 0);
  }, [monthQuery.data, countByDate]);

  const memberRawRows = useMemo(() => {
    if (!selectedMember) return [];
    const skid = selectedMember.skid ?? '';
    return (dayDetailQuery.data?.rows ?? []).filter((row) => {
      if (skid) return row.skid === skid;
      return row.mbName === selectedMember.mbName;
    });
  }, [dayDetailQuery.data, selectedMember]);

  const rawResetKey = `${selectedDayKey ?? ''}:${selectedMember?.skid ?? selectedMember?.mbName ?? ''}`;

  const handleSelectDay = (dayKey) => {
    if (!dayKey || dayKey > currentDayKey()) return;
    setSelectedDayKey(dayKey);
    setSelectedMember(null);
    setStep('members');
  };

  const handleSelectMember = (member) => {
    setSelectedMember(member);
    setStep('raw');
  };

  const handleBack = () => {
    if (step === 'raw') {
      setSelectedMember(null);
      setStep('members');
      return;
    }
    if (step === 'members') {
      setSelectedDayKey(null);
      setSelectedMember(null);
      setStep('calendar');
    }
  };

  const stepTitle = useMemo(() => {
    if (step === 'members') return '구성원별 건수';
    if (step === 'raw') return 'Raw 데이터';
    return '일별 평가모수';
  }, [step]);

  if (!open) return null;

  return createPortal(
    <div className="adm-cs-evalcount-backdrop" onClick={onClose} role="presentation">
      <section
        className="adm-cs-evalcount-modal pending-daypicker-modal pending-daypicker-modal--satisfaction"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adm-cs-evalcount-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="adm-cs-evalcount-head pending-daypicker-head">
          <div className="adm-cs-evalcount-head-main">
            {step !== 'calendar' ? (
              <button
                type="button"
                className="adm-cs-evalcount-back-btn"
                onClick={handleBack}
                aria-label="이전"
              >
                <ChevronLeft size={20} strokeWidth={2.25} aria-hidden />
              </button>
            ) : null}
            <div>
              <h3 id="adm-cs-evalcount-title" className="pending-daypicker-title">
                {stepTitle}
              </h3>
              {step === 'members' && selectedDayKey ? (
                <p className="adm-cs-evalcount-head-sub">{formatDayLabel(selectedDayKey)}</p>
              ) : null}
              {step === 'raw' && selectedMember ? (
                <p className="adm-cs-evalcount-head-sub">{memberLabel(selectedMember)}</p>
              ) : null}
            </div>
          </div>
          <button type="button" className="pending-daypicker-close" onClick={onClose} aria-label="닫기">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="adm-cs-evalcount-body">
          {step === 'calendar' ? (
            <CalendarStep
              monthKey={monthKey}
              setMonthKey={setMonthKey}
              countByDate={countByDate}
              monthTotal={monthTotal}
              monthQuery={monthQuery}
              onSelectDay={handleSelectDay}
            />
          ) : null}

          {step === 'members' && selectedDayKey ? (
            <MembersStep
              dayKey={selectedDayKey}
              dayDetailQuery={dayDetailQuery}
              onSelectMember={handleSelectMember}
            />
          ) : null}

          {step === 'raw' && selectedDayKey && selectedMember ? (
            <RawStep
              dayKey={selectedDayKey}
              member={selectedMember}
              rows={memberRawRows}
              resetKey={rawResetKey}
            />
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}
