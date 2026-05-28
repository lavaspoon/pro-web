/**
 * Good 멘트·고객 제안 기반 코칭 JSON 파싱
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

/** LM이 줄바꿈을 넣어도 UI·길이 제한은 한 줄로 맞춤 */
function singleLine(s) {
  return String(s ?? '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} raw
 * @returns {{ fromGood: string, fromBad: string } | null}
 */
export function parseInsightFeedback(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const jsonStr = unwrapJsonFence(raw);
    const obj = JSON.parse(jsonStr);

    const fromGood = clip(singleLine(firstString(obj.fromGood, obj.goodInsight, obj.goodSummary, obj.keepDoing)), 72);
    const fromBad = clip(singleLine(firstString(obj.fromBad, obj.badInsight, obj.improveFromBad, obj.gap, obj.softGap)), 72);

    if (!fromGood && !fromBad) return null;

    return { fromGood, fromBad };
  } catch {
    return null;
  }
}
