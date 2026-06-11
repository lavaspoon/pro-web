import { DEFAULT_CERTIFICATION_MIN_TOTAL } from './caseEvaluation';

function parseToLocalDate(value) {
  if (value == null || String(value).trim() === '') return null;
  const s = String(value).trim();
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 접수일 — 목록용 mm-dd */
export function formatSubmittedDateMmDd(value) {
  const d = parseToLocalDate(value);
  if (!d) return '—';
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${mo}-${day}`;
}

/** 접수일 — 목록용 yy.mm.dd HH:mm (24시간) */
export function formatSubmittedDateYyMmDdHm(value) {
  const d = parseToLocalDate(value);
  if (!d) return '—';
  const yy = String(d.getFullYear()).slice(-2);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yy}.${mo}.${day} ${h}:${min}`;
}

/** 접수 목록 — STT 조회용 스윙 ID (TB_LMS_MEMBER.b_id) */
export function formatCaseListSwingId(value) {
  const s = String(value ?? '').trim();
  return s || '—';
}

/** 접수 목록 — 상담시간 강조 표시 (날짜·시간 2줄 + STT searchKey) */
export function formatCaseListCallTimeForStt(value) {
  const parts = parseCaseCallDateTime(value);
  if (!parts) {
    return { primary: '—', hint: null, title: null };
  }
  return {
    primary: parts.fullDisplay,
    hint: parts.searchKey,
    title: parts.searchKey ? `STT 조회: ${parts.searchKey}` : parts.fullDisplay,
  };
}

/** 목록용 mm월dd일 HH:mm (24시간) — 접수·상담 일시 공통 */
export function formatCaseListDateMmDdHm(value) {
  const d = parseToLocalDate(value);
  if (!d) return '—';
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mo}월${day}일 ${h}:${min}`;
}

/** 목록용 총점 — 있으면 n점, 없으면 '-' */
export function formatCaseListScoreDisplay(caseItem) {
  const raw = caseItem?.totalScore;
  if (raw != null && Number.isFinite(Number(raw))) {
    return `${Number(raw)}점`;
  }
  return '-';
}

/** 목록용 총점 뱃지 톤 — empty | default | pass(80점 이상) */
export function resolveCaseListScoreBadgeTone(caseItem) {
  const raw = caseItem?.totalScore;
  if (raw == null || !Number.isFinite(Number(raw))) return 'empty';
  return Number(raw) >= 80 ? 'pass' : 'default';
}

/**
 * 접수 목록 — 인증여부 (2차 완료: 최종 판정, 1차 완료: 총점·인증 기준점 예상)
 * @returns {'인증'|'미인증'|'—'}
 */
export function formatCaseListCertLabel(caseItem) {
  const st = String(caseItem?.status ?? '').toLowerCase();
  if (st === 'selected') return '인증';
  if (st === 'rejected') return '미인증';
  if (st === 'returned') return '반려';
  const raw = caseItem?.totalScore;
  if (raw == null || !Number.isFinite(Number(raw))) return '—';
  const min =
    caseItem?.certificationMinTotalScore != null &&
    Number.isFinite(Number(caseItem.certificationMinTotalScore))
      ? Number(caseItem.certificationMinTotalScore)
      : DEFAULT_CERTIFICATION_MIN_TOTAL;
  return Number(raw) >= min ? '인증' : '미인증';
}

/** 목록용 인증여부 뱃지 톤 — empty | cert | uncert */
export function resolveCaseListCertBadgeTone(caseItem) {
  const label = formatCaseListCertLabel(caseItem);
  if (label === '인증') return 'cert';
  if (label === '미인증') return 'uncert';
  if (label === '반려') return 'returned';
  return 'empty';
}

/** 문제해결 부정비율 — Y만 표시, N·빈값은 '-' */
export function problemResolvedNegRateText(value) {
  const s = String(value ?? '').trim().toUpperCase();
  return s === 'Y' ? 'Y' : '-';
}

/** 문제해결 부정비율 셀 톤 — Y: 빨간 뱃지, N·빈값: 회색 '-' 뱃지 */
export function problemResolvedNegRateClass(value) {
  const s = String(value ?? '').trim().toUpperCase();
  return s === 'Y' ? 'adm-sat-yn-chip is-no' : 'adm-sat-yn-chip is-empty';
}

/** 상담일시 — 목록용 mm-dd HH:mm (24시간) */
export function formatCaseCallDateMmDdHm(value) {
  const d = parseToLocalDate(value);
  if (!d) return '—';
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mo}-${day} ${h}:${min}`;
}

/**
 * TB_YOU_PRO_CASE.call_date / 접수 시 저장한 통화 일시 표시용
 * (예: "2026-03-05 09:30:00")
 */
export function formatCaseCallDateTime(value) {
  const parts = parseCaseCallDateTime(value);
  if (!parts) return '—';
  return parts.fullDisplay;
}

function formatKoreanTime12(d) {
  const hours24 = d.getHours();
  const period = hours24 < 12 ? '오전' : '오후';
  const hours12 = hours24 % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return {
    period,
    timeLabel: `${period} ${hours12}:${min}`,
  };
}

/** yy.mm.dd 오전/오후 h:mm */
export function formatCaseDateTimeYyMmKorean(value) {
  const d = parseToLocalDate(value);
  if (!d) return '—';
  const yy = String(d.getFullYear()).slice(-2);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const { timeLabel } = formatKoreanTime12(d);
  return `${yy}.${mo}.${day} ${timeLabel}`;
}

/** 목록용 mm월 dd일 오전/오후 hh:mm */
export function formatCaseDateTimeMmDdKorean(value) {
  const d = parseToLocalDate(value);
  if (!d) return '—';
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours24 = d.getHours();
  const period = hours24 < 12 ? '오전' : '오후';
  const hours12 = String(hours24 % 12 || 12).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mo}월 ${day}일 ${period} ${hours12}:${min}`;
}

/** 통화 일시를 분 단위 비교 키 "YYYY-MM-DD HH:mm" 로 정규화 */
export function toCallDateMinuteKey(value) {
  if (value == null || String(value).trim() === '') return '';
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return '';
  return `${m[1]} ${m[2]}:${m[3]}`;
}

/**
 * 상담시간 파싱 — 헤더·STT 조회용 (날짜/시간 분리, searchKey = API 저장 형식)
 * @returns {{ dateLabel: string, timeLabel: string, period: string, fullDisplay: string, searchKey: string, iso: string } | null}
 */
export function parseCaseCallDateTime(value) {
  if (value == null || String(value).trim() === '') return null;
  const s = String(value).trim();
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) {
    return {
      dateLabel: s,
      timeLabel: '',
      period: '',
      fullDisplay: s,
      searchKey: s,
      iso: '',
    };
  }
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const h24 = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  const moPad = String(mo).padStart(2, '0');
  const dayPad = String(day).padStart(2, '0');
  const { period, timeLabel } = formatKoreanTime12(d);
  return {
    dateLabel: `${y}. ${mo}. ${day}.`,
    timeLabel,
    period,
    fullDisplay: `${y}. ${mo}. ${day}. ${timeLabel}`,
    searchKey: `${y}-${moPad}-${dayPad} ${h24}:${min}:${sec}`,
    iso: d.toISOString(),
  };
}
