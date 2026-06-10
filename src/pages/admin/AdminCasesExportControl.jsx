import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { downloadAdminCasesExport } from '../../api/adminApi';
import './AdminCasesExportControl.css';

const EXPORT_MONTH_OPTIONS = [
  { value: '', label: '전체' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}월`,
  })),
];

export default function AdminCasesExportControl({
  year,
  adminSkid,
  buttonLabel = '엑셀 다운로드',
  buttonClassName = 'btn btn-secondary btn-sm adm-cases-export-btn',
}) {
  const rootRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportPending, setExportPending] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleExportExcel = useCallback(
    async (monthValue) => {
      if (!adminSkid || exportPending) return;
      setMenuOpen(false);
      setExportPending(true);
      try {
        const month = monthValue ? Number(monthValue) : null;
        await downloadAdminCasesExport(year, adminSkid, month);
      } catch (err) {
        window.alert(err.message || '엑셀 다운로드에 실패했습니다.');
      } finally {
        setExportPending(false);
      }
    },
    [adminSkid, exportPending, year],
  );

  const toggleMenu = useCallback(() => {
    if (exportPending) return;
    setMenuOpen((open) => !open);
  }, [exportPending]);

  return (
    <div
      ref={rootRef}
      className={`adm-cases-export${menuOpen ? ' is-open' : ''}`}
    >
      <button
        type="button"
        className={buttonClassName}
        onClick={toggleMenu}
        disabled={exportPending}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={`${year}년 접수 raw 엑셀 다운로드 — 월 선택`}
      >
        <Download size={14} aria-hidden />
        {exportPending ? '다운로드 중…' : buttonLabel}
        <ChevronDown size={14} className="adm-cases-export-btn__chev" aria-hidden />
      </button>

      {menuOpen ? (
        <div className="adm-cases-export-menu" role="menu" aria-label="다운로드 월 선택">
          {EXPORT_MONTH_OPTIONS.map((o) => (
            <button
              key={o.value || 'all'}
              type="button"
              role="menuitem"
              className="adm-cases-export-menu__item"
              onClick={() => handleExportExcel(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
