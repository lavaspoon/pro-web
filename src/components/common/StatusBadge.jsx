import React from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import './StatusBadge.css';

const STATUS_CONFIG = {
  selected: {
    label: '선정',
    icon: CheckCircle,
    className: 'badge-selected',
  },
  pending: {
    label: '대기중',
    icon: Clock,
    className: 'badge-pending',
  },
  rejected: {
    label: '비선정',
    icon: XCircle,
    className: 'badge-rejected',
  },
};

export default function StatusBadge({ status, size = 'md' }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <span className={`status-badge ${config.className} size-${size}`}>
      <Icon size={size === 'sm' ? 12 : 14} />
      {config.label}
    </span>
  );
}
