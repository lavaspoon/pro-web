/**
 * 관리자 화면 2depth 센터 선택 — 백엔드 설정과 동일한 기본 ID.
 * API(filterMeta)가 비어 있거나 일부만 올 때도 셀렉트에 항상 노출한다.
 */
export const DEFAULT_SECOND_DEPTH_DEPT_IDS = [5, 6, 7];

/**
 * @param {Array<{ id: number, name: string }>|undefined} apiOptions - GET dashboard filterMeta.secondDepthDepts
 * @returns {{ id: number, name: string }[]}
 */
export function mergeSecondDepthOptions(apiOptions) {
  const list = Array.isArray(apiOptions) ? apiOptions : [];
  const byId = new Map(list.map((o) => [Number(o.id), o]));
  return DEFAULT_SECOND_DEPTH_DEPT_IDS.map((id) => {
    const o = byId.get(id);
    return o ?? { id, name: `${id}번 부서` };
  });
}
