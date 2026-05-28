/**
 * 로컬 LM Studio OpenAI 호환 API (/v1/chat/completions)
 * CRA: REACT_APP_LM_STUDIO_URL (기본 http://127.0.0.1:1234)
 */
const DEFAULT_BASE = 'http://127.0.0.1:1234';
export const LM_STUDIO_MODEL = 'gemma-3-4b-it-qat';

function stripBase(url) {
  return String(url || '').replace(/\/$/, '');
}

/** 개발·디버깅용 — LM Studio system/user 프롬프트 확인 */
function logCsAiPrompt(label, { system, user }) {
  console.log(`[CS AI] ${label}`, { system, user });
}

async function lmChatCompletion({ system, user, maxTokens = 220, temperature = 0.42, signal }) {
  const base = stripBase(process.env.REACT_APP_LM_STUDIO_URL || DEFAULT_BASE);
  const url = `${base}/v1/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LM_STUDIO_MODEL,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `LM Studio HTTP ${res.status}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('모델 응답이 비어 있습니다.');
  }
  return content.trim();
}

function formatUnsatTypesForAi(snap) {
  if (!snap?.unsatTypeCounts?.size) return '(없음)';
  return [...snap.unsatTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t} ${n}건`)
    .join(', ');
}

function formatSnapshotBlock(label, snap) {
  return [
    `【${label}】 ${snap.date}`,
    `- 만족도: ${snap.pct != null ? `${Number(snap.pct).toFixed(1)}%` : '—'} (${snap.satisfiedCount}/${snap.evaluatedCount}건)`,
    `- Good 멘트 ${snap.goodMents?.length ?? 0}건: ${(snap.goodMents ?? []).slice(0, 2).map((m, i) => `${i + 1}) ${m}`).join(' | ') || '(없음)'}`,
    `- 고객 제안 ${snap.badMents?.length ?? 0}건: ${(snap.badMents ?? []).slice(0, 2).map((m, i) => `${i + 1}) ${m}`).join(' | ') || '(없음)'}`,
    `- 불만족 유형: ${formatUnsatTypesForAi(snap)}`,
  ].join('\n');
}

/**
 * 최근 2일 만족도 비교 — 왜 올랐/내렸는지 불릿 생성
 */
export async function fetchCsDayOverDayInsight({
  latest,
  previous,
  direction,
  deltaPp,
  signal,
}) {
  const dirLabel = direction === 'up' ? '상승' : direction === 'down' ? '하락' : '유지';
  const causeHint = direction === 'up'
    ? '상승: Good 멘트 내용을 근거로 작성. 멘트가 시사하는 강점·호평 포인트를 문장에 반영.'
    : direction === 'down'
      ? '하락: 고객 제안·불만족 유형 데이터를 근거로 작성. 원문·유형명·라벨은 직접 쓰지 말고, 그 의미만 부드럽게 문장에 내재.'
      : '큰 변동이 없으면 전일과 비슷했다는 요지만.';

  const system = [
    '만족도 데이터를 해석해 상담사 화면에 보여줄 AI 인사이트 작성자입니다.',
    '읽는 사람은 현장 상담사입니다. 탓·비난·냉정한 평가·위압적·딱딱한 표현 금지.',
    '제공 데이터만 근거로 사실은 정확히 유지하되, 최대한 상냥하고 따뜻한 존댓말로 전달하세요.',
    '코칭·대응 조언·피드백·권유·“해보세요” 표현 금지. 원인 설명만.',
    'JSON만: {"reasons":["…","…"]}',
    'reasons: 3개. 각 항목 한 문장. 만족도가 왜 올랐/내렸는지 원인만.',
    direction === 'up'
      ? '상승이면 Good 멘트를 핵심 근거로 삼아, 고객 호평·만족 포인트가 드러나게 작성하세요.'
      : direction === 'down'
        ? '하락이면 고객 제안과 불만족 유형을 핵심 근거로 삼되, 고객 제안 원문·불만족 유형명·유형 번호·카테고리 라벨은 직접 쓰지 마세요. 응대·안내·속도·태도·설명·이해 등 그 의미가 자연스럽게 느껴지게 내재하세요.'
        : '유지면 큰 변동 요인이 없었다는 요지만.',
    '건수 변화(→)는 1~2개 항목에만. 날짜·%p 나열 금지. 문장 완결.',
    causeHint,
  ].join(' ');

  const user = [
    `만족도 ${dirLabel} · 약 ${Math.abs(deltaPp).toFixed(1)}%p`,
    formatSnapshotBlock('최근', latest),
    formatSnapshotBlock('이전', previous),
    direction === 'up'
      ? '위 Good 멘트를 근거로 reasons 3개 작성. 상냥한 톤으로.'
      : '위 고객 제안·불만족 유형을 근거로 reasons 3개 작성. 유형명·고객 제안 원문은 쓰지 말고 의미만 부드럽게 내재. 상냥한 톤으로.',
  ].join('\n');

  logCsAiPrompt('최근 AI 인사이트(일자 비교)', { system, user });

  return lmChatCompletion({ system, user, maxTokens: 320, temperature: 0.32, signal });
}

/**
 * 불만족 유형·고객 제안 기반 대응 코칭 시나리오
 */
export async function fetchCsCoachScenario({
  typeLabel,
  badMent,
  date,
  signal,
}) {
  const system = [
    '콜센터 슈퍼바이저가 상담사에게 주는 코칭. 상담사 비난·탓 금지. 최대한 상냥하고 존중하는 존댓말.',
    '불만족 유형·고객 제안을 근거로 피드백을 작성하되, 유형명·라벨·고객 제안 원문은 직접 쓰지 마세요(화면에 별도 표시됨).',
    '유형·멘트가 시사하는 응대·안내·처리·속도·태도·설명 등의 의미는 feedback·points에 자연스럽게 내재하세요.',
    '“이렇게 대응·응대하면 좋겠다”는 **피드백**을 작성하세요. 대화 예시·말풍선 형식 금지.',
    'JSON만: {"feedback":"…","points":["…"]}',
    'feedback: 핵심 조언 1~2문장. 문장은 끝까지 완결되게(중간 생략·… 금지).',
    'points: 0~1개. 짧은 완결 문장 1개. 없으면 빈 배열.',
  ].join(' ');

  const user = [
    `참고 불만족 유형: ${typeLabel || '기타'}`,
    badMent ? `참고 고객 제안: ${String(badMent).slice(0, 100)}` : '고객 제안: 없음',
    date ? `기준일: ${date}` : '',
    '위 유형·고객 제안을 근거로 대응 피드백 JSON. 유형명·고객 제안 원문은 쓰지 말고 의미만 부드럽게 내재. 상냥한 톤으로.',
  ].filter(Boolean).join('\n');

  logCsAiPrompt('AI 코칭(불만족 유형)', { system, user });

  return lmChatCompletion({ system, user, maxTokens: 280, temperature: 0.42, signal });
}

/**
 * 최근 Good 멘트 — 잘하고 있는 점 요약
 */
export async function fetchCsGoodMentInsight({ items, dayLimit = 30, signal }) {
  const lines = (items ?? []).slice(0, 8).map((it, i) => {
    const date = it.date ? String(it.date) : '—';
    const text = String(it.text ?? '').slice(0, 120);
    return `${i + 1}. (${date}) ${text || '(없음)'}`;
  });

  const system = [
    '콜센터 상담사 코칭. Good 멘트는 고객이 MMS 만족도 설문에 적은 칭찬 원문입니다.',
    '제공된 Good 멘트들만 근거로, 상담사가 **무엇을 잘하고 있는지** 한 문장으로 요약하세요.',
    '원문 복사·따옴표 인용·멘트 번호 나열 금지. 비난·위압적 표현·“해보세요” 금지.',
    '상담사가 읽어도 기분 좋고 힘이 나는 따뜻한 존댓말로 작성하세요.',
    'JSON만: {"strength":"…"}',
    'strength: 1문장, 존댓말, 64자 내외, 공통 칭찬 패턴 중심.',
  ].join(' ');

  const user = [
    `최근 ${dayLimit}일 Good 멘트 ${lines.length}건.`,
    '',
    ...lines,
    '',
    '위만 보고 strength 작성. 따뜻하고 격려하는 톤으로.',
  ].join('\n');

  logCsAiPrompt('Good 멘트 인사이트', { system, user });

  return lmChatCompletion({ system, user, maxTokens: 160, temperature: 0.38, signal });
}

/**
 * 상위 10위 구성원 — 최근 인증(selected) 사례 기반 접수 트렌드
 */
export async function fetchRecentSubmissionTrendInsight({ items, signal }) {
  const trendItems = (items ?? []).slice(0, 10);
  const blocks = trendItems.map((it, i) => {
    const order = it.rank > 0 ? it.rank : i + 1;
    return [
      `【사례 ${order}】`,
      `- 제목: ${it.title || '(없음)'}`,
      `- 응대 내용: ${String(it.description || '').slice(0, 220) || '(없음)'}`,
      `- 관리자 평가 비고(참고): ${String(it.judgmentReason || '').slice(0, 140) || '(없음)'}`,
    ].join('\n');
  });

  const system = [
    'YOU PRO 우수 상담 사례 분석가. 제공 데이터만 근거로 사실·패턴을 설명합니다.',
    '실명·부서·개인 식별 금지.',
    'JSON만: {"recentTrend":"…"}',
    'recentTrend: 반드시 "최근 상위자들은 ○○○ 내용으로 접수하고 있습니다." 한 문장 전체. ○○○=공통 접수·응대 패턴. 사실만, 존댓말, 58자 내외.',
  ].join(' ');

  const user = [
    '인증 건수 상위 10위 구성원의 최근 인증(selected) 사례. judged_at 최신순. recentTrend 작성.',
    '',
    ...blocks,
  ].join('\n');

  console.log('[상위자 최근 접수 트렌드] AI prompt', { system, user });

  return lmChatCompletion({
    system,
    user,
    maxTokens: 420,
    temperature: 0.35,
    signal,
  });
}

/** @deprecated fetchRecentSubmissionTrendInsight 사용 */
export async function fetchTopMembersSpotlightInsight({ items, signal }) {
  return fetchRecentSubmissionTrendInsight({ items, signal });
}

export async function fetchCsSatisfactionInsight({
  year,
  month,
  statsLines,
  goodLines,
  badLines,
  latestConsultDate,
  mentWindowStartDate,
  signal,
}) {
  const system = [
    '당신은 통신사 콜센터 상담사를 코칭하는 슈퍼바이저입니다. 말투는 항상 따뜻하고 존중하며, 상담사를 비난하지 않습니다.',
    'Good 멘트·고객 제안은 통화 후 고객이 MMS 만족도 설문에 직접 적은 내용입니다. 목록은 평가시간 적용(Y) 건만 쓰였고, 사용자 메시지에 적힌 날짜 구간(최근 10일) 안의 멘트입니다. 통계 숫자는 보조 참고만 하고, 분석의 중심은 설문 글입니다.',
    'fromGood: 위 Good 멘트들에 대해, 고객이 칭찬한 점·고마워한 점을 **짧게 칭찬**하세요. 원문 복사·따옴표 인용 금지.',
    'fromBad: 고객 제안은 설문에 적은 고객의 아쉬움·개선 의견입니다. **따뜻한 말투**로 짧게 **개선 한 가지**만 제안하세요. Good 멘트 맥락을 참고해도 됩니다. 원문 복사·비난 금지.',
    '출력은 유효한 JSON 객체 하나만. 앞뒤 설명·마크다운·코드펜스 금지.',
    '스키마 고정(두 필드만): {"fromGood":"…","fromBad":"…"}',
    '반드시 짧게: 각 값 **최대 2문장**, **줄바꿈 금지(한 줄로만)**. 공백 포함 **각 72자 이내**.',
    'Good 멘트가 없으면 fromGood에 한 문장으로 없음 안내, 고객 제안 없으면 fromBad에 한 문장으로 유지 안내.',
  ].join(' ');

  const batchHint =
    mentWindowStartDate && latestConsultDate
      ? `평가시간=Y만 사용 · 멘트는 상담(평가)일 기준 최근 10일(${mentWindowStartDate} ~ ${latestConsultDate}) 구간에서 수집했습니다.`
      : latestConsultDate
        ? `평가시간=Y만 사용 · 멘트 기준일 ${latestConsultDate} 전후(해당 월 내 최근 10일)입니다.`
        : '평가시간=Y만 사용 · 상담일시 없으면 해당 월 적용 건 전체에서 멘트를 모았습니다.';
  const userPayload = [
    `${year}년 ${month}월 · ${batchHint} MMS 설문형 Good 멘트·고객 제안 텍스트 분석.`,
    '',
    '【참고 통계(간단) — 보조만】',
    statsLines.slice(0, 6).join('\n'),
    '',
    '【Good 멘트 — 최근 10일 구간. 고객이 설문에 적은 긍정·칭찬 원문. fromGood 작성 시 이 목록을 근거로 칭찬하세요】',
    goodLines.length ? goodLines.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(해당 구간 없음)',
    '',
    '【고객 제안 — 최근 10일 구간. 고객이 설문에 적은 아쉬움·개선 의견 원문. fromBad 작성 시 이 목록과 Good 목록을 함께 고려하세요. 원문 복사 금지】',
    badLines.length ? badLines.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(없음)',
  ].join('\n');

  return lmChatCompletion({
    system,
    user: userPayload,
    maxTokens: 180,
    temperature: 0.42,
    signal,
  });
}
