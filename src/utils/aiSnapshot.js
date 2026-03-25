/**
 * 판정 API에 넘길 AI 스냅샷 JSON 문자열
 */
export function serializeAiSnapshotForJudge(aiResult) {
  if (!aiResult) return undefined;
  try {
    return JSON.stringify({
      recommendation: aiResult.recommendation,
      confidence: aiResult.confidence,
      score: aiResult.score,
      summary: aiResult.summary,
      rationale: aiResult.rationale,
      highlights: aiResult.highlights || [],
      chatTurns: aiResult.chatTurns || [],
    });
  } catch {
    return undefined;
  }
}
