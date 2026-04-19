import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  FileText,
  ChevronRight,
  ChevronLeft,
  PlusCircle,
  Filter,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { fetchMyCases } from '../../api/memberApi';
import StatusBadge from '../common/StatusBadge';
import { useMemberModalStore } from '../../store/memberModalStore';
import MemberCaseDetailPanel from './MemberCaseDetailPanel';
import '../../pages/member/CaseListPage.css';
import './MemberSubmitModal.css';
import './MemberCaseListModal.css';

const STATUS_FILTER = ['전체', '대기중', '선정', '비선정'];
const STATUS_MAP = { 대기중: 'pending', 선정: 'selected', 비선정: 'rejected' };

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function caseMonthKey(c) {
  const raw = c.month || c.submittedAt || '';
  if (typeof raw === 'string' && raw.length >= 7) return raw.slice(0, 7);
  return '';
}

function formatMonthBarLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${y}년 ${m}월`;
}

export default function MemberCaseListModal() {
  const { user } = useAuthStore();
  const open = useMemberModalStore((s) => s.caseListOpen);
  const caseDetailId = useMemberModalStore((s) => s.caseDetailId);
  const closeCaseList = useMemberModalStore((s) => s.closeCaseList);
  const closeCaseDetail = useMemberModalStore((s) => s.closeCaseDetail);
  const openSubmit = useMemberModalStore((s) => s.openSubmit);
  const openCaseDetail = useMemberModalStore((s) => s.openCaseDetail);
  const [activeFilter, setActiveFilter] = useState('전체');
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['my-cases', user?.skid],
    queryFn: () => fetchMyCases(user.skid),
    enabled: !!user?.skid && open,
  });

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (caseDetailId) closeCaseDetail();
        else closeCaseList();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeCaseList, closeCaseDetail, caseDetailId]);

  useEffect(() => {
    if (open) setMonthKey(currentMonthKey());
  }, [open]);

  const { minMonthKey, maxMonthKey } = useMemo(() => {
    const max = currentMonthKey();
    const keys = cases.map(caseMonthKey).filter(Boolean);
    const earliest = keys.length ? [...keys].sort()[0] : max;
    const minWindow = addMonths(max, -36);
    const min = earliest < minWindow ? earliest : minWindow;
    return { minMonthKey: min, maxMonthKey: max };
  }, [cases]);

  const canPrevMonth = monthKey > minMonthKey;
  const canNextMonth = monthKey < maxMonthKey;

  const casesInMonth = useMemo(
    () => cases.filter((c) => caseMonthKey(c) === monthKey),
    [cases, monthKey],
  );

  const filtered =
    activeFilter === '전체'
      ? casesInMonth
      : casesInMonth.filter((c) => c.status === STATUS_MAP[activeFilter]);

  const goDetail = (id) => {
    openCaseDetail(id);
  };

  const goSubmit = () => {
    closeCaseList();
    openSubmit();
  };

  if (!open) return null;

  return (
    <div
      className="member-modal-root member-case-list-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby={caseDetailId ? 'member-case-detail-title' : 'member-case-list-title'}
    >
      <button
        type="button"
        className="member-modal-backdrop member-modal-backdrop--list"
        aria-label={caseDetailId ? '뒤로' : '모달 닫기'}
        onClick={() => (caseDetailId ? closeCaseDetail() : closeCaseList())}
      />
      <div
        className={
          caseDetailId
            ? 'member-modal-panel member-case-detail-panel member-case-detail-panel--embedded'
            : 'member-modal-panel member-case-list-modal'
        }
      >
        {caseDetailId ? (
          <MemberCaseDetailPanel embedded />
        ) : (
          <>
        <div className="member-case-list-head">
          <div className="member-case-list-head-main">
            <h2 id="member-case-list-title" className="member-case-list-title">
              내 사례 목록
            </h2>
            <p className="member-case-list-lede">접수한 사례를 월·상태별로 확인합니다</p>
          </div>
          <button
            type="button"
            className="member-case-list-close"
            onClick={closeCaseList}
            aria-label="내 사례 목록 닫기"
          >
            <span className="member-case-list-close__ring" aria-hidden />
            <X className="member-case-list-close__icon" size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="member-case-month-bar">
          <button
            type="button"
            className="member-case-month-btn"
            disabled={!canPrevMonth}
            onClick={() => setMonthKey((k) => addMonths(k, -1))}
            aria-label="이전 달"
          >
            <ChevronLeft size={20} strokeWidth={2.25} />
          </button>
          <span className="member-case-month-label">{formatMonthBarLabel(monthKey)}</span>
          <button
            type="button"
            className="member-case-month-btn"
            disabled={!canNextMonth}
            onClick={() => setMonthKey((k) => addMonths(k, 1))}
            aria-label="다음 달"
          >
            <ChevronRight size={20} strokeWidth={2.25} />
          </button>
        </div>

        <div className="member-case-list-meta">
          해당 월 접수 <strong>{casesInMonth.length}</strong>건 · 전체 누적 <strong>{cases.length}</strong>건
        </div>

        {isLoading ? (
          <div className="member-case-list-body member-case-list-body--loading">
            <div className="member-case-list-loading">
              <div className="spinner" />
              <p>사례를 불러오는 중...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="filter-tabs member-case-filter-tabs">
              <Filter size={14} className="filter-icon" />
              {STATUS_FILTER.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`filter-tab ${activeFilter === f ? 'active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                  <span className="filter-count">
                    {f === '전체'
                      ? casesInMonth.length
                      : casesInMonth.filter((c) => c.status === STATUS_MAP[f]).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="member-case-list-body">
              {filtered.length === 0 ? (
                <div className="empty-state member-case-empty member-case-empty--fixed-slot">
                  <FileText size={40} className="empty-icon" />
                  <h3>{cases.length === 0 ? '접수된 사례가 없습니다' : `${formatMonthBarLabel(monthKey)} 접수 건이 없습니다`}</h3>
                  <p>
                    {cases.length === 0
                      ? '우수 응대 사례를 접수해 보세요'
                      : '다른 월을 선택하거나 새로 접수해 보세요'}
                  </p>
                  <button type="button" className="btn btn-primary" onClick={goSubmit}>
                    <PlusCircle size={16} />
                    우수사례 접수
                  </button>
                </div>
              ) : (
                <div className="member-case-table-wrap member-case-list-scroll">
                  <table className="member-case-table">
                    <thead>
                      <tr>
                        <th className="mct-col-no">#</th>
                        <th className="mct-col-status">상태</th>
                        <th className="mct-col-title">사례 제목</th>
                        <th className="mct-col-date">접수일</th>
                        <th className="mct-col-action" aria-hidden />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c, i) => (
                        <tr
                          key={c.id}
                          className="mct-row fade-in-up"
                          style={{ animationDelay: `${i * 0.04}s` }}
                          onClick={() => goDetail(c.id)}
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && goDetail(c.id)}
                        >
                          <td className="mct-no">{i + 1}</td>
                          <td className="mct-status">
                            <StatusBadge status={c.status} size="sm" />
                          </td>
                          <td className="mct-title">{c.title}</td>
                          <td className="mct-date">{formatDate(c.submittedAt)}</td>
                          <td className="mct-action" aria-hidden>
                            <ChevronRight size={14} strokeWidth={2} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
