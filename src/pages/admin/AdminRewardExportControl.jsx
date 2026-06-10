import React, { useCallback, useState } from 'react';
import { Download } from 'lucide-react';
import { downloadAdminRewardExport } from '../../api/adminApi';

export default function AdminRewardExportControl({
  year,
  adminSkid,
  buttonClassName = 'btn btn-secondary btn-sm pending-export-btn',
}) {
  const [exportPending, setExportPending] = useState(false);

  const handleExport = useCallback(async () => {
    if (!adminSkid || exportPending) return;
    setExportPending(true);
    try {
      await downloadAdminRewardExport(year, adminSkid);
    } catch (err) {
      window.alert(err.message || '리워드 내역 추출에 실패했습니다.');
    } finally {
      setExportPending(false);
    }
  }, [adminSkid, exportPending, year]);

  return (
    <button
      type="button"
      className={buttonClassName}
      onClick={handleExport}
      disabled={exportPending}
      title={`${year}년 리워드 내역 통계 엑셀 다운로드`}
    >
      <Download size={14} aria-hidden />
      {exportPending ? '추출 중…' : '리워드 내역 추출'}
    </button>
  );
}
