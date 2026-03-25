/**
 * 1차 AI 분석 — 실제 API 대체용 mock (데모: 대화·요약은 mockCaseReviewDemo 고정 데이터)
 */
import {
  MOCK_AI_CHAT_TURNS,
  MOCK_AI_HIGHLIGHTS,
  MOCK_AI_RATIONALE,
  MOCK_AI_SUMMARY,
} from './mockCaseReviewDemo';

function simpleHash(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * @returns {Promise<{
 *   recommendation: 'selected'|'rejected',
 *   confidence: number,
 *   score: number,
 *   summary: string,
 *   rationale: string,
 *   highlights: string[],
 *   chatTurns: { role: string, text: string }[]
 * }>}
 */
export async function mockRunAiAnalysis({ fullTranscript, title, callDate }) {
  await new Promise((r) => setTimeout(r, 700));

  const seed = simpleHash(`${fullTranscript || ''}|${title || ''}|${callDate || ''}`);
  const recommendation = seed % 2 === 0 ? 'selected' : 'rejected';
  const confidence = 62 + (seed % 32);
  const score =
    recommendation === 'selected' ? 68 + (seed % 27) : 38 + (seed % 22);

  const chatTurns = MOCK_AI_CHAT_TURNS.map((t) => ({ ...t }));

  const rationale =
    recommendation === 'selected'
      ? `${MOCK_AI_RATIONALE} 선정 쪽으로는 응대 완결도가 높게 평가됩니다.`
      : `${MOCK_AI_RATIONALE} 비선정 쪽으로는 관리자가 녹취로 한 번 더 확인할 가치가 있다고 보입니다.`;

  const summary =
    recommendation === 'selected'
      ? `${MOCK_AI_SUMMARY} → 우수 응대로 참고합니다.`
      : `${MOCK_AI_SUMMARY} → 추가 검토를 권합니다.`;

  const highlights = MOCK_AI_HIGHLIGHTS.map((h, i) =>
    recommendation === 'selected' ? h : `${h} (재확인 권장)`
  );

  return {
    recommendation,
    confidence,
    score,
    summary,
    rationale,
    highlights,
    chatTurns,
  };
}
