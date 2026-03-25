/**
 * TB_YOUPRO_CASE.call_date / 접수 시 저장한 통화 일시 표시용
 * (예: "2026-03-05 09:30:00")
 */
export function formatCaseCallDateTime(value) {
  if (value == null || String(value).trim() === '') return '—';
  const s = String(value).trim();
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
