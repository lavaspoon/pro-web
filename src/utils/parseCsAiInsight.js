/**
 * CS 만족도 — LM Studio 일자 비교·대응 코칭 JSON 파싱
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

function normalizeText(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function parseReasonList(obj) {
  if (Array.isArray(obj.reasons)) {
    return obj.reasons.map((v) => normalizeText(v)).filter(Boolean).slice(0, 3);
  }
  if (Array.isArray(obj.bullets)) {
    return obj.bullets.map((v) => normalizeText(v)).filter(Boolean).slice(0, 3);
  }
  if (Array.isArray(obj.whyBullets)) {
    return obj.whyBullets.map((v) => normalizeText(v)).filter(Boolean).slice(0, 3);
  }
  const single = normalizeText(
    obj.reason ?? obj.why ?? obj.cause ?? obj.influence ?? obj.summary,
  );
  return single ? [single] : [];
}

/**
 * @param {string} raw
 * @returns {{ reasons: string[] } | null}
 */
export function parseDayOverDayInsight(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const obj = JSON.parse(unwrapJsonFence(raw));
    const reasons = parseReasonList(obj);
    if (!reasons.length) return null;
    return { reasons };
  } catch {
    return null;
  }
}

/** @deprecated parseDayOverDayInsight 사용 */
export function parseDayOverDayBullets(raw) {
  const parsed = parseDayOverDayInsight(raw);
  if (!parsed) return null;
  return parsed.reasons;
}

/**
 * @param {string} raw
 * @returns {{ feedback: string, points: string[] } | null}
 */
export function parseCoachScenario(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const obj = JSON.parse(unwrapJsonFence(raw));
    let feedback = normalizeText(
      obj.feedback
      ?? obj.advice
      ?? obj.coaching
      ?? obj.summary,
    );

    // 구 스키마(customer/agent) 호환
    if (!feedback && (obj.agent || obj.opener)) {
      feedback = normalizeText(obj.agent ?? obj.opener);
    }

    const points = (Array.isArray(obj.points ?? obj.tips ?? obj.actions)
      ? (obj.points ?? obj.tips ?? obj.actions)
      : [])
      .map((v) => normalizeText(v))
      .filter(Boolean)
      .slice(0, 2);

    if (!feedback) return null;
    return { feedback, points };
  } catch {
    return null;
  }
}
