import { create } from 'zustand';

/**
 * 구성원 홈에서 우수사례 접수 / 내 사례 목록 / 사례 상세 모달
 */
export const useMemberModalStore = create((set) => ({
  submitOpen: false,
  caseListOpen: false,
  /** 목록 모달 진입 시 적용할 초기 상태 필터 ('전체' | '대기중' | '선정' | '비선정') */
  caseListInitialFilter: '전체',
  /** 목록 모달 진입 시 적용할 초기 월 (YYYY-MM). null이면 이번 달 */
  caseListInitialMonth: null,
  /** 열려 있을 때 사례 ID (문자열) */
  caseDetailId: null,
  openSubmit: () => set({ submitOpen: true }),
  closeSubmit: () => set({ submitOpen: false }),
  openCaseList: (initialFilter = '전체', initialMonth = null) =>
    set({
      caseListOpen: true,
      caseListInitialFilter: initialFilter,
      caseListInitialMonth: initialMonth,
    }),
  closeCaseList: () => set({ caseListOpen: false }),
  openCaseDetail: (id) => set({ caseDetailId: id != null ? String(id) : null }),
  closeCaseDetail: () => set({ caseDetailId: null }),
}));
