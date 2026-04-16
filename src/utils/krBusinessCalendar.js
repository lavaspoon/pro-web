/**
 * 2026년 대한민국 공휴일 (관리자 기준표와 동일하게 유지)
 * 다른 연도는 공휴일 이름 없이 주말(토·일)만 비영업일로 처리합니다.
 */
export const KR_PUBLIC_HOLIDAYS_2026 = {
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '삼일절 대체공휴일',
  '2026-05-01': '노동절',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '부처님오신날 대체공휴일',
  '2026-06-03': '전국동시지방선거일',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '광복절 대체공휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '개천절 대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',
};

function toIso(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getPublicHolidayName(year, month, day) {
  if (year !== 2026) return null;
  return KR_PUBLIC_HOLIDAYS_2026[toIso(year, month, day)] ?? null;
}

export function isWeekendDate(year, month, day) {
  const w = new Date(year, month - 1, day).getDay();
  return w === 0 || w === 6;
}

/** 주말 또는 (2026년) 공휴일이면 비영업일 */
export function isNonBusinessDay(year, month, day) {
  if (isWeekendDate(year, month, day)) return true;
  return Boolean(getPublicHolidayName(year, month, day));
}

const WD = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 해당 월의 영업일만 (월~금이면서 공휴일 아님)
 * @param {number} year
 * @param {number} month 1~12
 */
export function getBusinessDaysInMonth(year, month) {
  const last = new Date(year, month, 0).getDate();
  const out = [];
  for (let day = 1; day <= last; day += 1) {
    if (isNonBusinessDay(year, month, day)) continue;
    const d = new Date(year, month - 1, day);
    out.push({
      day,
      month,
      year,
      weekdayShort: WD[d.getDay()],
    });
  }
  return out;
}

/** 해당 월에 걸리는 공휴일(이름표) — 2026년만 */
export function getPublicHolidaysInMonth(year, month) {
  if (year !== 2026) return [];
  const last = new Date(year, month, 0).getDate();
  const out = [];
  for (let day = 1; day <= last; day += 1) {
    const name = getPublicHolidayName(year, month, day);
    if (name) out.push({ day, name });
  }
  return out;
}
