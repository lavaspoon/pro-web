import React from 'react';
import { CheckCircle, Clock, RotateCcw, Save, XCircle } from 'lucide-react';
import { getCaseReviewStageBadge } from '../../utils/caseReviewStage';
import './CaseReviewStageBadge.css';

const ICONS = {
  waiting: Clock,
  phase1: Save,
  phase2: CheckCircle,
  returned: RotateCcw,
  neutral: Clock,
};

export default function CaseReviewStageBadge({ caseItem, size = 'sm' }) {
  const { label, tone } = getCaseReviewStageBadge(caseItem);
  const Icon = ICONS[tone] ?? Clock;
  return (
    <span className={`case-stage-badge case-stage-badge--${tone} case-stage-badge--${size}`}>
      <Icon size={size === 'sm' ? 12 : 14} strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}
