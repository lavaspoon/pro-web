/**
 * Good/Bad 멘트 기반 코칭 JSON 파싱
 */

function unwrapJsonFence(raw) {
  let s = String(raw ?? '').trim();
  const m = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(s);
  if (m) return m[1].trim();
  const idx = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (idx >= 0 && last > idx) return s.slice(idx, last + 1).trim();
  return s;
}

function firstString(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function clip(s, max) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * @param {string} raw
 * @returns {{ fromGood: string, fromBad: string, nextStep: string } | null}
 */
export function parseInsightFeedback(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const jsonStr = unwrapJsonFence(raw);
    const obj = JSON.parse(jsonStr);

    const fromGood = clip(firstString(obj.fromGood, obj.goodInsight, obj.goodSummary, obj.keepDoing), 160);
    const fromBad = clip(firstString(obj.fromBad, obj.badInsight, obj.improveFromBad, obj.gap, obj.softGap), 160);
    const nextStep = clip(firstString(obj.nextStep, obj.tryThis, obj.action, obj.oneThing, obj.improveAction), 140);

    if (!nextStep) return null;

    return { fromGood, fromBad, nextStep };
  } catch {
    return null;
  }
}
