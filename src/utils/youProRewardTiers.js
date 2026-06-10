/** YOU PRO Reward 등급 — HomePage·관리자 구성원 카드 공통 (백엔드 IncentiveReflectService 와 동일) */
export const YOU_PRO_REWARD_TIERS = [
  { id: 'mangju', name: 'YOU 망주', range: '1건 이상', minCases: 1, rateWon: 30000 },
  { id: 'player', name: 'YOU 플레이어', range: '10건 이상', minCases: 10, rateWon: 50000 },
  { id: 'topia', name: 'YOU 토피아', range: '19건 이상', minCases: 19, rateWon: 70000 },
];

/** @deprecated HomePage 호환 alias */
export const TIERS = YOU_PRO_REWARD_TIERS;

export function getTierIdx(n) {
  if (n >= 19) return 2;
  if (n >= 10) return 1;
  if (n >= 1) return 0;
  return -1;
}

export function getTierNameByCumulative(count) {
  const idx = getTierIdx(Number(count) || 0);
  return idx >= 0 ? YOU_PRO_REWARD_TIERS[idx].name : null;
}

export function getTierRateWonByName(tierName) {
  const name = String(tierName ?? '').trim();
  if (!name) return null;
  const tier = YOU_PRO_REWARD_TIERS.find((t) => t.name === name);
  return tier?.rateWon ?? null;
}

/** 등급표·관리자 카드 — 30000 → "3만원" */
export function formatTierRateWon(rateWon) {
  if (rateWon == null || rateWon <= 0) return '—';
  if (rateWon % 10000 === 0) return `${rateWon / 10000}만원`;
  return `${Number(rateWon).toLocaleString('ko-KR')}원`;
}
