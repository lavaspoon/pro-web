import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutList } from 'lucide-react';
import AdminMemberCasesModal from './AdminMemberCasesModal';
import './TeamDetailPage.css';

/**
 * 실(팀) 상세 — 구성원 카드 클릭 시 사례 목록 모달
 * TeamDetailPage · Dashboard 공통
 */
export default function AdminMemberDetailCard({ member }) {
  const [casesModalOpen, setCasesModalOpen] = useState(false);
  const totalSubmitted = Number(member.totalSubmitted ?? 0);
  const monthlySubmitted = Number(member.monthlySubmitted ?? 0);
  const monthlySelected = Number(member.monthlySelected ?? 0);
  const reflectCumulative = Number(member.reflectCumulativeCount ?? 0);

  return (
    <div className="member-detail-card member-detail-card--metrics">
      <div
        className="member-card-header"
        onClick={() => setCasesModalOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCasesModalOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${member.name} 사례 목록 열기`}
      >
        <div className="member-card-left">
          <div className="member-avatar-lg">{member.name[0]}</div>
          <div>
            <div className="member-card-name">{member.name}</div>
            <div className="member-card-pos">{member.position}</div>
          </div>
        </div>

        <div className="member-card-stats member-card-stats--metrics">
          <div className="mcs-item mcs-item--panel">
            <span className="mcs-label">연간 접수 건수</span>
            <span className="mcs-value">{totalSubmitted}건</span>
          </div>
          <div className="mcs-item mcs-item--panel">
            <span className="mcs-label">연간 선정 건수</span>
            <span className="mcs-value">{Number(member.totalSelected ?? 0)}건</span>
          </div>
          <div className="mcs-item mcs-item--panel">
            <span className="mcs-label">이달 접수 건수</span>
            <span className="mcs-value">{monthlySubmitted}건</span>
          </div>
          <div className="mcs-item mcs-item--panel">
            <span className="mcs-label">이달 선정 건수</span>
            <span className="mcs-value">{monthlySelected}건</span>
          </div>
          <div className="mcs-item mcs-item--panel mcs-item--reflect">
            <span className="mcs-label mcs-label--reflect">누적 인증 건수</span>
            <span className="mcs-value mcs-value--reflect">{reflectCumulative}건</span>
          </div>
        </div>

        <span className="expand-btn expand-btn--static" aria-hidden>
          <LayoutList size={18} strokeWidth={2} />
        </span>
      </div>

      {casesModalOpen &&
        createPortal(
          <AdminMemberCasesModal
            open={casesModalOpen}
            member={member}
            onClose={() => setCasesModalOpen(false)}
          />,
          document.body
        )}
    </div>
  );
}
