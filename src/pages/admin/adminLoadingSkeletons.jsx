import React from 'react';
import Skeleton from '../../components/common/Skeleton';

/** KPI 카드 내 센터 행 — adm-sat-kpi-center-head / row 그리드와 동일 열 수 */
export function KpiCenterListSkeleton({ rows = 4, cols = 4 }) {
  const widths =
    cols === 4
      ? [32, 52, 40, 36]
      : cols === 2
        ? [32, 56]
        : [32, 48, 44];
  return (
    <>
      {Array.from({ length: rows }).map((i) => (
        <div key={i} className="adm-sat-kpi-center-row adm-sat-kpi-skeleton-row">
          {widths.map((w, c) => (
            <Skeleton key={c} variant="text" width={w} height={12} />
          ))}
        </div>
      ))}
    </>
  );
}

/** CS 만족도 상단 4카드 */
export function KpiOverviewSkeleton() {
  return (
    <div className="adm-overview-grid adm-sat-kpi-grid adm-sat-kpi-grid--four">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="adm-kpi-card adm-kpi-card--tone-files adm-sat-kpi-card--centers adm-kpi-card--skeleton">
          <div className="adm-kpi-head adm-kpi-head--skeleton">
            <Skeleton width={28} height={28} radius={8} />
            <Skeleton variant="text" width={90} height={14} />
          </div>
          <div className="adm-sat-kpi-center-list">
            <div className="adm-sat-kpi-center-head" aria-hidden>
              <span>구분</span>
              <span>목표</span>
              <span>실적</span>
              <span>달성</span>
            </div>
            <KpiCenterListSkeleton rows={3} cols={4} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** YOU프로 대시보드 상단 2카드 */
export function DashboardOverviewSkeleton() {
  return (
    <div className="adm-overview-grid adm-overview-grid--two">
      <div className="adm-kpi-card adm-kpi-card--tone-chart adm-sat-kpi-card--centers adm-kpi-card--annual-by-center adm-kpi-card--skeleton">
        <div className="adm-kpi-head adm-kpi-head--skeleton">
          <Skeleton width={28} height={28} radius={8} />
          <Skeleton variant="text" width={88} height={14} />
        </div>
        <div className="adm-sat-kpi-center-list">
          <div className="adm-sat-kpi-center-head" aria-hidden>
            <span>센터</span>
            <span>평가대상</span>
            <span>인증인원</span>
            <span>인증률</span>
          </div>
          <KpiCenterListSkeleton rows={4} cols={4} />
        </div>
      </div>
      <div className="adm-kpi-card adm-kpi-card--tone-users adm-sat-kpi-card--centers adm-kpi-card--center-metrics-3 adm-kpi-card--skeleton">
        <div className="adm-kpi-head adm-kpi-head--skeleton">
          <Skeleton width={28} height={28} radius={8} />
          <Skeleton variant="text" width={120} height={14} />
        </div>
        <div className="adm-sat-kpi-center-list">
          <div className="adm-sat-kpi-center-head" aria-hidden>
            <span>센터</span>
            <span>평가대상</span>
            <span>접수</span>
            <span>인증</span>
          </div>
          <KpiCenterListSkeleton rows={4} cols={4} />
        </div>
      </div>
    </div>
  );
}

export function SummaryTableSkeletonRows({ rows = 6, cols = 8 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={`sk-${r}`} className="adm-table-skeleton-row">
      {Array.from({ length: cols }).map((__, c) => (
        <td key={c}>
          <Skeleton variant="text" width={c < 3 ? 70 : 44} height={12} />
        </td>
      ))}
    </tr>
  ));
}

/** 연간 순위 3열 × 5행 */
export function RankingCompactSkeleton({ blocks }) {
  return (
    <div className="adm-rank-compact__grid-wrap">
      <div className="adm-rank-compact__grid">
        {blocks.map((block) => (
          <div key={block.id} className="adm-rank-compact__col">
            <Skeleton variant="text" width={56} height={14} className="adm-rank-skeleton-title" />
            <table className="adm-rank-compact__table">
              <thead>
                <tr>
                  <th scope="col" className="adm-rank-compact__th adm-rank-compact__th--rank">
                    <Skeleton variant="text" width={24} height={10} />
                  </th>
                  <th scope="col" className="adm-rank-compact__th">
                    <Skeleton variant="text" width={32} height={10} />
                  </th>
                  <th scope="col" className="adm-rank-compact__th">
                    <Skeleton variant="text" width={28} height={10} />
                  </th>
                  <th scope="col" className="adm-rank-compact__th adm-rank-compact__th--num">
                    <Skeleton variant="text" width={24} height={10} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: block.endRank - block.startRank + 1 }).map((_, i) => (
                  <tr key={i} className="adm-rank-compact__tr adm-rank-skeleton-row">
                    <td className="adm-rank-compact__td adm-rank-compact__td--rank">
                      <Skeleton width={22} height={22} radius={999} />
                    </td>
                    <td className="adm-rank-compact__td">
                      <Skeleton variant="text" width="72%" height={12} />
                    </td>
                    <td className="adm-rank-compact__td">
                      <Skeleton variant="text" width="85%" height={12} />
                    </td>
                    <td className="adm-rank-compact__td adm-rank-compact__td--val">
                      <Skeleton variant="text" width={36} height={12} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
