/**
 * leaf 팀 — 2depth 센터 · 중간 그룹 · 실(팀) 계층 표기
 */

/** 2depth 센터 UI 표시 — '부산유선고객센터' → '부산유선' */
export function formatCenterDisplayName(name) {
  const s = String(name ?? '').trim();
  if (!s) return '';
  if (s === '종합') return '종합';
  if (s.endsWith('유선고객센터')) {
    return s.replace(/고객센터$/, '');
  }
  return s;
}

export function buildTeamHierarchyPath({ centerName, groupName, teamName, name, rawCenter = false } = {}) {
  const leaf = (teamName ?? name ?? '').toString().trim();
  const center = rawCenter
    ? (centerName ?? '').toString().trim()
    : formatCenterDisplayName(centerName);
  const group = (groupName ?? '').toString().trim();
  const parts = [center, group, leaf].filter(Boolean);
  if (parts.length === 0) return '—';
  return parts.join(' · ');
}

/** 사이드바 상단 경로(센터·그룹) — leaf 이름은 별도 표시 */
export function buildTeamHierarchyMeta({ centerName, groupName, rawCenter = false } = {}) {
  const center = rawCenter
    ? (centerName ?? '').toString().trim()
    : formatCenterDisplayName(centerName);
  const group = (groupName ?? '').toString().trim();
  if (center && group) return `${center} · ${group}`;
  return center || group || '';
}

export function compareTeamHierarchy(a, b) {
  const ca = (a.centerName ?? '').localeCompare(b.centerName ?? '', 'ko');
  if (ca !== 0) return ca;
  const ga = (a.groupName ?? '').localeCompare(b.groupName ?? '', 'ko');
  if (ga !== 0) return ga;
  return (a.teamName ?? a.name ?? '').localeCompare(b.teamName ?? b.name ?? '', 'ko');
}
