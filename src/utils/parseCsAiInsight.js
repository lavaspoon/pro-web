/**
 * CS 만족도 — LM Studio 일자 비교·대응 코칭 JSON 파싱
 */

/** 백엔드 DISSATISFACTION_TYPE_LABELS와 동일 */
const DISSAT_TYPE_LABELS = [
  '서비스 지식부족',
  '성의 없는 태도',
  '적절하지 않는 혜택 안내',
  '알아듣기 어려운 설명',
  '문의내용 이해 못함',
];

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/** AI 코멘트에 불만족 유형명이 섞이면 부드러운 표현으로 치환 */
function softenDissatTypeMentions(text) {
  let s = String(text ?? '');
  DISSAT_TYPE_LABELS.forEach((label) => {
    s = s.replace(new RegExp(escapeRegExp(label), 'g'), '응대·안내 과정');
  });
  s = s.replace(/불만족\s*유형\s*[1-5]?/g, '고객 아쉬움');
  s = s.replace(/유형\s*[1-5]\s*(?:불만|건)?/g, '고객 아쉬움');
  return normalizeText(s);
}

function unwrapJsonFence(raw) {
  let s = String(raw ?? '').trim();
  const m = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(s);
  if (m) return m[1].trim();
  const idx = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (idx >= 0 && last > idx) return s.slice(idx, last + 1).trim();
  return s;
}

function parseReasonList(obj) {
  if (Array.isArray(obj.reasons)) {
    return obj.reasons.map((v) => softenDissatTypeMentions(v)).filter(Boolean).slice(0, 3);
  }
  if (Array.isArray(obj.bullets)) {
    return obj.bullets.map((v) => softenDissatTypeMentions(v)).filter(Boolean).slice(0, 3);
  }
  if (Array.isArray(obj.whyBullets)) {
    return obj.whyBullets.map((v) => softenDissatTypeMentions(v)).filter(Boolean).slice(0, 3);
  }
  const single = softenDissatTypeMentions(
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
    let feedback = softenDissatTypeMentions(
      obj.feedback
      ?? obj.advice
      ?? obj.coaching
      ?? obj.summary,
    );

    // 구 스키마(customer/agent) 호환
    if (!feedback && (obj.agent || obj.opener)) {
      feedback = softenDissatTypeMentions(obj.agent ?? obj.opener);
    }

    const points = (Array.isArray(obj.points ?? obj.tips ?? obj.actions)
      ? (obj.points ?? obj.tips ?? obj.actions)
      : [])
      .map((v) => softenDissatTypeMentions(v))
      .filter(Boolean)
      .slice(0, 1);

    if (!feedback) return null;
    return { feedback, points };
  } catch {
    return null;
  }
}

/**
 * @param {string} raw
 * @returns {{ strength: string } | null}
 */
export function parseGoodMentInsight(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const obj = JSON.parse(unwrapJsonFence(raw));
    const strength = normalizeText(
      obj.strength
      ?? obj.summary
      ?? obj.keepDoing
      ?? obj.fromGood
      ?? obj.insight,
    );
    if (!strength) return null;
    return { strength: strength.length > 96 ? `${strength.slice(0, 96)}…` : strength };
  } catch {
    return null;
  }
}
