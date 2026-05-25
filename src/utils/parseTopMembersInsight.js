/**
 * 구성원 홈 — 상위 10위 최근 인증 사례 기반 접수 트렌드 AI JSON 파싱
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

/** 화면 표시용 — 공백·구두점 정리 */
export function formatReadableText(s) {
  return normalizeText(s)
    .replace(/\s*([,.!?])\s*/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** 상위자 접수 트렌드 — 고정 문장 형식 */
export function formatTopSubmissionTrendSentence(raw) {
  let text = formatReadableText(raw);
  if (!text) return '';

  if (/^최근 상위자들은/.test(text)) {
    return text.endsWith('.') || text.endsWith('。') ? text : `${text}.`;
  }

  text = text.replace(/[.!?…]+$/, '').trim();

  const legacy = /「(.+?)」처럼 (.+?)(?: 접수·응대)? 내용(?:이 많습니다)?$/.exec(text);
  if (legacy) {
    return `최근 상위자들은 ${legacy[2].trim()} 내용으로 접수하고 있습니다.`;
  }

  if (/내용으로 접수/.test(text)) {
    return text.endsWith('습니다') ? `${text}.` : `${text}고 있습니다.`;
  }

  return `최근 상위자들은 ${text} 내용으로 접수하고 있습니다.`;
}

/**
 * @param {string} raw
 * @returns {{
 *   entries: Array<{ rank: number, selectionReason: string }>,
 *   recentTrend: { summary: string, bullets: string[] }
 * } | null}
 */
export function parseTopMembersInsight(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const obj = JSON.parse(unwrapJsonFence(raw));
    const list = Array.isArray(obj.entries)
      ? obj.entries
      : Array.isArray(obj.items)
        ? obj.items
        : Array.isArray(obj.spotlights)
          ? obj.spotlights
          : [];

    const entries = list
      .map((row) => {
        const rank = Number(row?.rank ?? row?.displayRank);
        const selectionReason = normalizeText(
          row?.selectionReason ?? row?.reason ?? row?.why ?? row?.insight,
        );
        if (!Number.isFinite(rank) || rank < 1 || rank > 3 || !selectionReason) return null;
        return { rank: Math.round(rank), selectionReason };
      })
      .filter(Boolean)
      .slice(0, 3);

    const summary = formatReadableText(
      obj.recentTrend
      ?? obj.submissionTrend
      ?? obj.trendSummary
      ?? obj.trend
      ?? obj.suggestion,
    );

    const bulletSrc = Array.isArray(obj.trendBullets)
      ? obj.trendBullets
      : Array.isArray(obj.trendPoints)
        ? obj.trendPoints
        : Array.isArray(obj.tips)
          ? obj.tips
          : [];

    const bullets = bulletSrc
      .map((v) => formatReadableText(typeof v === 'string' ? v : v?.text ?? v?.body))
      .filter(Boolean)
      .slice(0, 2);

    const recentTrend = { summary, bullets };

    if (!entries.length && !summary && !bullets.length) return null;
    return { entries, recentTrend };
  } catch {
    return null;
  }
}

/**
 * @param {Array<{ rank: number, title?: string, description?: string }>} items
 * @param {{ entries?: Array<{ rank: number, selectionReason: string }>, recentTrend?: { summary?: string, bullets?: string[] } }} parsed
 */
export function mapTopMembersInsightByRank(items, parsed) {
  const map = new Map(
    (parsed?.entries ?? []).map((e) => [e.rank, e]),
  );
  const ranked = (items ?? []).slice(0, 3).map((item, idx) => {
    const rank = item.rank > 0 ? item.rank : idx + 1;
    const ai = map.get(rank);
    return {
      ...item,
      rank,
      selectionReason: ai?.selectionReason
        || buildFallbackSelectionReason(item),
    };
  });

  const fallbackTrend = buildFallbackRecentTrend(items);
  const trend = parsed?.recentTrend ?? {};
  const summary = formatReadableText(trend.summary) || fallbackTrend.summary;
  const bullets = (trend.bullets?.length ? trend.bullets : fallbackTrend.bullets)
    .map((b) => formatReadableText(b))
    .filter(Boolean)
    .slice(0, 2);

  return {
    ranked: ranked.map((row) => ({
      ...row,
      selectionReason: formatReadableText(row.selectionReason),
    })),
    recentTrend: { summary, bullets },
  };
}

function buildFallbackSelectionReason(item) {
  const reason = normalizeText(item?.judgmentReason);
  if (reason) return reason;
  const title = normalizeText(item?.title);
  if (title) return `「${title}」 사례의 응대 내용이 인증 기준에 부합한 것으로 평가되었습니다.`;
  return '제공된 사례 내용이 인증 기준에 부합합니다.';
}

/** 상위 10위 구성원 최근 인증 사례 기반 트렌드 폴백 */
export function buildFallbackRecentTrend(items) {
  const rows = (items ?? []).slice(0, 10);
  const titles = rows.map((it) => normalizeText(it?.title)).filter(Boolean);

  const summary = titles.length
    ? `최근 상위자들은 「${titles[0]}」처럼 상황·해결이 드러나는 내용으로 접수하고 있습니다.`
    : '최근 상위자들은 고객 상황과 해결 과정이 구체적인 내용으로 접수하고 있습니다.';

  return {
    summary,
    bullets: [],
  };
}
