import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutList } from 'lucide-react';
import AdminMemberCasesModal from './AdminMemberCasesModal';
import './TeamDetailPage.css';

/**
 * 실(팀) 상세 — 구성원 카드 클릭 시 사례 목록 모달
 * TeamDetailPage · Dashboard 공통
 *
 * @param {object} props.teamContext — CS 만족도 구성원 상세와 동일: { centerName, groupName, skill }
 */
export default function AdminMemberDetailCard({ member, teamContext }) {
  const [casesModalOpen, setCasesModalOpen] = useState(false);
  const totalSubmitted = Number(member.totalSubmitted ?? 0);
  const monthlySubmitted = Number(member.monthlySubmitted ?? 0);
  const annualCertified = Number(
    member.annualCertifiedCount ?? member.totalSelected ?? 0
  );
  const monthlyCertified = Number(
    member.monthlyCertifiedCount ?? member.monthlySelected ?? 0
  );
  const monthlySat =
    member.monthlySatisfactionPct != null && !Number.isNaN(Number(member.monthlySatisfactionPct))
      ? Number(member.monthlySatisfactionPct)
      : null;
  const tierName = member.tierName?.trim() ? member.tierName.trim() : null;
  const cumulativeRewardWon = Number(member.cumulativeRewardWon ?? 0);

  const displayName = member.name?.trim() || member.id || member.skid || '—';
  const skid = member.id ?? member.skid ?? '';
  const centerName = teamContext?.centerName ?? member.centerName;
  const groupName = teamContext?.groupName ?? member.groupName;
  const skill = teamContext?.skill ?? member.skill;

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
          <div className="member-avatar-lg">{displayName.charAt(0)}</div>
          <div>
            <div className="member-card-name">{displayName}</div>
            <div className="member-card-pos">
              {teamContext != null || member.centerName != null || member.skill != null ? (
                <>
                  {skid || '—'} · {(centerName && String(centerName).trim()) || '—'} /{' '}
                  {(groupName && String(groupName).trim()) || '—'} /{' '}
                  {(skill && String(skill).trim()) || '—'}
                </>
              ) : (
                <>
                  {skid ? `${skid} · ` : ''}
                  {member.position?.trim() ? member.position : '—'}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="member-card-stats member-card-stats--metrics adm-member-metrics-grid adm-member-metrics-grid--cols-4">
          <div className="mcs-item mcs-item--panel mcs-item--annual mcs-item--case-combo">
            <span className="mcs-label">연간 접수 · 인증</span>
            <div className="mcs-case-combo-body">
              <span className="mcs-case-combo-line">
                <span className="mcs-case-combo-k">접수</span>
                <span className="mcs-case-combo-v">{totalSubmitted}건</span>
              </span>
              <span className="mcs-case-combo-line">
                <span className="mcs-case-combo-k">인증</span>
                <span className="mcs-case-combo-v">{annualCertified}건</span>
              </span>
            </div>
          </div>
          <div className="mcs-item mcs-item--panel mcs-item--monthly mcs-item--case-combo">
            <span className="mcs-label">이달 접수 · 인증</span>
            <div className="mcs-case-combo-body">
              <span className="mcs-case-combo-line">
                <span className="mcs-case-combo-k">접수</span>
                <span className="mcs-case-combo-v">{monthlySubmitted}건</span>
              </span>
              <span className="mcs-case-combo-line">
                <span className="mcs-case-combo-k">인증</span>
                <span className="mcs-case-combo-v">{monthlyCertified}건</span>
              </span>
            </div>
          </div>
          <div className="mcs-item mcs-item--panel mcs-item--cs-monthly">
            <span className="mcs-label">당월 만족도</span>
            <span className="mcs-value">
              {monthlySat != null ? `${monthlySat.toFixed(1)}%` : '—'}
            </span>
          </div>
          <div className="mcs-item mcs-item--panel mcs-item--reward-tier">
            <span className="mcs-label">등급 · Reward</span>
            <div className="mcs-reward-tier-body">
              <span className="mcs-reward-tier-grade">{tierName ?? '등급 없음'}</span>
              <span className="mcs-reward-tier-won">
                누적 {cumulativeRewardWon.toLocaleString('ko-KR')}원
              </span>
            </div>
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
