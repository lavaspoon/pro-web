import { create } from 'zustand';

/**
 * 관리자·CE실장이 특정 구성원 화면을 대리 조회할 때 사용하는 임시 스토어.
 * 페이지 새로고침 시 초기화됩니다 (persist 미사용).
 */
const useViewAsStore = create((set) => ({
  viewAsSkid: null,
  setViewAs: (skid) => set({ viewAsSkid: String(skid).trim() }),
  clearViewAs: () => set({ viewAsSkid: null }),
}));

export default useViewAsStore;
