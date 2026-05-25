import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutList } from 'lucide-react';
import AdminMemberCasesModal from './AdminMemberCasesModal';
import {
  resolveTargetMet,
  satisfactionAchievementFromTarget,
} from '../../utils/csSatisfactionModalDayStats';
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
  const monthlyTargetPercent =
    member.monthlyTargetPercent != null && !Number.isNaN(Number(member.monthlyTargetPercent))
      ? Number(member.monthlyTargetPercent)
      : null;
  const monthlyTargetMet =
    typeof member.monthlyTargetMet === 'boolean'
      ? member.monthlyTargetMet
      : resolveTargetMet({
        actualPct: monthlySat,
        targetPct: monthlyTargetPercent,
        achievementRate: satisfactionAchievementFromTarget(monthlySat, monthlyTargetPercent),
      });
  const tierName = member.tierName?.trim() ? member.tierName.trim() : null;
  const cumulativeRewardWon = Number(member.cumulativeRewardWon ?? 0);

  const displayName = member.name?.trim() || member.id || member.skid || '—';
  const skid = member.id ?? member.skid ?? '';
  const centerName = teamContext?.centerName ?? member.centerName;
  const groupName = teamContext?.groupName ?? member.groupName;
  const skill = teamContext?.skill ?? member.skill;

  const satDisplay = monthlySat != null ? `${monthlySat.toFixed(1)}%` : '—';
  const satBadgeTone =
    monthlySat == null
      ? 'muted'
      : monthlyTargetMet === true
        ? 'ok'
        : monthlyTargetMet === false
          ? 'no'
          : 'muted';
  const satStatusLabel =
    monthlySat == null
      ? '데이터 없음'
      : monthlyTargetMet === true
        ? '목표 달성'
        : monthlyTargetMet === false
          ? '목표 미달'
          : '목표 없음';
  const rewardWonDisplay = `${cumulativeRewardWon.toLocaleString('ko-KR')}원`;

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
        aria-label={`${displayName} 사례 목록 열기`}
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

        <div
          className="adm-member-metrics-grid"
          role="group"
          aria-label={`${displayName} 실적: 연간 접수 ${totalSubmitted}건 인증 ${annualCertified}건, 당월 접수 ${monthlySubmitted}건 인증 ${monthlyCertified}건, 당월 만족도 ${satDisplay} ${satStatusLabel}, ${tierName ?? '등급 없음'} 누적 ${rewardWonDisplay}`}
        >
          <span className="adm-mmg-h adm-mmg-h--corner" aria-hidden />
          <span className="adm-mmg-h adm-mmg-h--annual">연간</span>
          <span className="adm-mmg-h adm-mmg-h--monthly">당월</span>
          <span className="adm-mmg-h adm-mmg-h--sat">당월 만족도</span>
          <span className="adm-mmg-h adm-mmg-h--reward">Reward</span>

          <span className="adm-mmg-metric adm-mmg-metric--sub">접수</span>
          <span className="adm-mmg-v adm-mmg-v--sub adm-mmg-v--annual">{totalSubmitted}건</span>
          <span className="adm-mmg-v adm-mmg-v--sub adm-mmg-v--monthly">{monthlySubmitted}건</span>
          <span className={`adm-mmg-sat-badge adm-mmg-sat-badge--${satBadgeTone}`}>
            {satDisplay}
          </span>
          <span className="adm-mmg-stack adm-mmg-stack--reward">
            <span className="adm-mmg-reward-tier">{tierName ?? '등급 없음'}</span>
            <span className="adm-mmg-reward-won">{rewardWonDisplay}</span>
          </span>

          <span className="adm-mmg-metric adm-mmg-metric--cert">인증</span>
          <span className="adm-mmg-v adm-mmg-v--cert adm-mmg-v--annual">{annualCertified}건</span>
          <span className="adm-mmg-v adm-mmg-v--cert adm-mmg-v--monthly">{monthlyCertified}건</span>
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
