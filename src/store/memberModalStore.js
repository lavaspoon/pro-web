import { create } from 'zustand';

/**
 * 구성원 홈에서 우수사례 접수 / 내 사례 목록 / 사례 상세 모달
 */
export const useMemberModalStore = create((set) => ({
  submitOpen: false,
  caseListOpen: false,
  /** 열려 있을 때 사례 ID (문자열) */
  caseDetailId: null,
  openSubmit: () => set({ submitOpen: true }),
  closeSubmit: () => set({ submitOpen: false }),
  openCaseList: () => set({ caseListOpen: true }),
  closeCaseList: () => set({ caseListOpen: false }),
  openCaseDetail: (id) => set({ caseDetailId: id != null ? String(id) : null }),
  closeCaseDetail: () => set({ caseDetailId: null }),
}));
