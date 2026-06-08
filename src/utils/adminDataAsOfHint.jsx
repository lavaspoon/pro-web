import React from 'react';

/** yyyy-MM-dd → { month, day } 또는 null */
export function parseDataAsOfDateParts(latestDataDate) {
  const s = String(latestDataDate ?? '').trim();
  if (s.length < 10) return null;
  const month = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));
  if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || day < 1) {
    return null;
  }
  return { month, day };
}

/** 전체 센터 현황 힌트 — API 기준일(yyyy-MM-dd) */
export function LatestDataAsOfHint({ latestDataDate }) {
  const parts = parseDataAsOfDateParts(latestDataDate);
  if (!parts) return '데이터 없음';
  const { month, day } = parts;
  return (
    <>
      최근{' '}
      <strong className="adm-data-as-of-date">
        {month}월 {day}일
      </strong>{' '}
      기준의 데이터
    </>
  );
}
