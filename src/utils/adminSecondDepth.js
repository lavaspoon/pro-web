/**
 * 관리자 화면 2depth 센터 — API(filterMeta.secondDepthDepts)가 있으면 그 순서·ID·부서명을 그대로 사용.
 * API가 비어 있을 때만 폴백(로컬 개발용).
 */
export const DEFAULT_SECOND_DEPTH_DEPT_IDS = [5, 6, 7];

/**
 * @param {Array<{ id: number, name: string }>|undefined} apiOptions - GET dashboard filterMeta.secondDepthDepts
 * @returns {{ id: number, name: string }[]}
 */
export function mergeSecondDepthOptions(apiOptions) {
  const list = Array.isArray(apiOptions) ? apiOptions : [];
  if (list.length > 0) {
    return list.map((o) => {
      const id = Number(o.id);
      const raw = o.name != null ? String(o.name).trim() : '';
      const name = raw !== '' ? raw : `${id}번 부서`;
      return { id, name };
    });
  }
  return DEFAULT_SECOND_DEPTH_DEPT_IDS.map((id) => ({ id, name: `${id}번 부서` }));
}
