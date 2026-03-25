/**
 * 판정 완료 건인데 서버에 ai_snapshot 이 없을 때(구 데이터) 구성원 화면용 mock
 */
import { MOCK_AI_CHAT_TURNS, MOCK_AI_HIGHLIGHTS } from './mockCaseReviewDemo';

function hashToNum(id) {
  const s = String(id ?? '0');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getMemberAiFallback(caseId) {
  const seed = hashToNum(caseId);
  const recommendation = seed % 2 === 0 ? 'selected' : 'rejected';
  const confidence = 62 + (seed % 32);
  const score = recommendation === 'selected' ? 72 + (seed % 22) : 42 + (seed % 18);
  return {
    recommendation,
    confidence,
    score,
    summary: recommendation === 'selected' ? '우수 응대로 판단됩니다. (mock)' : '추가 검토가 필요합니다. (mock)',
    rationale:
      recommendation === 'selected'
        ? '요청 파악·안내가 명확했습니다. (mock)'
        : '일부 구간에서 추가 확인이 필요합니다. (mock)',
    highlights: MOCK_AI_HIGHLIGHTS,
    chatTurns: MOCK_AI_CHAT_TURNS.map((t) => ({ ...t })),
  };
}
