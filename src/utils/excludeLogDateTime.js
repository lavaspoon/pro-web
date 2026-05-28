const KST = 'Asia/Seoul';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * API 일시(문자열·배열·객체) → { y, mo, d, h, mi } — 타임존 변환 없이 표기값 그대로 사용
 */
export function parseExcludeDateTimeParts(value) {
  if (value == null || value === '') return null;

  if (Array.isArray(value)) {
    const [y, mo, d, h = 0, mi = 0] = value;
    if (!y || !mo || !d) return null;
    return { y: Number(y), mo: Number(mo), d: Number(d), h: Number(h), mi: Number(mi) };
  }

  if (typeof value === 'object') {
    const y = value.year ?? value.y;
    const mo = value.monthValue ?? value.month ?? value.m;
    const d = value.dayOfMonth ?? value.day ?? value.d;
    if (y != null && mo != null && d != null) {
      return {
        y: Number(y),
        mo: Number(mo),
        d: Number(d),
        h: Number(value.hour ?? 0),
        mi: Number(value.minute ?? 0),
      };
    }
  }

  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?/);
  if (!m) return null;
  return {
    y: Number(m[1]),
    mo: Number(m[2]),
    d: Number(m[3]),
    h: Number(m[4] ?? 0),
    mi: Number(m[5] ?? 0),
  };
}

export function dayKeyFromParts(parts) {
  if (!parts) return '';
  return `${parts.y}-${pad2(parts.mo)}-${pad2(parts.d)}`;
}

export function entryStartAt(entry) {
  return entry?.startAt ?? entry?.start_at;
}

export function entryEndAt(entry) {
  return entry?.endAt ?? entry?.end_at;
}

function addOneDayKey(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
}

/** start_at ~ end_at 구간에 포함되는 yyyy-MM-dd 목록 (대부분 1일) */
export function excludeRangeDayKeys(entry) {
  const startKey = dayKeyFromParts(parseExcludeDateTimeParts(entryStartAt(entry)));
  const endKey = dayKeyFromParts(parseExcludeDateTimeParts(entryEndAt(entry)));
  if (!startKey || !endKey) return [];
  if (startKey > endKey) return [];

  const keys = [];
  let cur = startKey;
  for (let i = 0; i < 62 && cur <= endKey; i += 1) {
    keys.push(cur);
    if (cur === endKey) break;
    cur = addOneDayKey(cur);
  }
  return keys;
}

/** 선택 일자가 제외 구간 [start_at, end_at]에 포함되는지 */
export function excludeEntryCoversDay(entry, dayKey) {
  if (!dayKey) return false;
  const startKey = dayKeyFromParts(parseExcludeDateTimeParts(entryStartAt(entry)));
  const endKey = dayKeyFromParts(parseExcludeDateTimeParts(entryEndAt(entry)));
  if (!startKey || !endKey) return false;
  return dayKey >= startKey && dayKey <= endKey;
}

export function allExcludeRangeDayKeys(entries) {
  const set = new Set();
  for (const e of entries ?? []) {
    for (const d of excludeRangeDayKeys(e)) set.add(d);
  }
  return [...set].sort();
}

export function excludeRangeDayKeysInMonth(entries, monthKey) {
  const prefix = `${monthKey}-`;
  return allExcludeRangeDayKeys(entries).filter((d) => d.startsWith(prefix));
}

export function entryTouchesMonth(entry, monthKey) {
  return excludeRangeDayKeys(entry).some((d) => d.startsWith(`${monthKey}-`));
}

export function currentDayKeyKst() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: KST }).format(new Date());
}

export function currentMonthKeyKst() {
  return currentDayKeyKst().slice(0, 7);
}

/** mm-dd hh:mm (연도 생략) */
export function formatExcludeRangeCompact(dt) {
  const p = parseExcludeDateTimeParts(dt);
  if (!p) return '—';
  return `${pad2(p.mo)}-${pad2(p.d)} ${pad2(p.h)}:${pad2(p.mi)}`;
}

export function formatExcludeRangeSpan(startAt, endAt) {
  return `${formatExcludeRangeCompact(startAt)} ~ ${formatExcludeRangeCompact(endAt)}`;
}

export function rangeStartSortKey(entry) {
  const p = parseExcludeDateTimeParts(entryStartAt(entry));
  if (!p) return '';
  return `${p.y}-${pad2(p.mo)}-${pad2(p.d)}T${pad2(p.h)}:${pad2(p.mi)}`;
}
