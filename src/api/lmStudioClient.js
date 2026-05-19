/**
 * 로컬 LM Studio OpenAI 호환 API (/v1/chat/completions)
 * CRA: REACT_APP_LM_STUDIO_URL (기본 http://127.0.0.1:1234)
 */
const DEFAULT_BASE = 'http://127.0.0.1:1234';
export const LM_STUDIO_MODEL = 'gemma-3-4b-it-qat';

function stripBase(url) {
  return String(url || '').replace(/\/$/, '');
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

function formatSnapshotBlock(label, snap) {
  const unsatTypes = snap.unsatTypeCounts
    ? [...snap.unsatTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t} ${n}건`)
      .join(', ')
    : '(없음)';

  return [
    `【${label}】 ${snap.date}`,
    `- 만족도: ${snap.pct != null ? `${Number(snap.pct).toFixed(1)}%` : '—'} (${snap.satisfiedCount}/${snap.evaluatedCount}건)`,
    `- Good 멘트 ${snap.goodMents?.length ?? 0}건: ${(snap.goodMents ?? []).slice(0, 2).map((m, i) => `${i + 1}) ${m}`).join(' | ') || '(없음)'}`,
    `- Bad 멘트 ${snap.badMents?.length ?? 0}건: ${(snap.badMents ?? []).slice(0, 2).map((m, i) => `${i + 1}) ${m}`).join(' | ') || '(없음)'}`,
    `- 불만족 유형: ${unsatTypes || '(없음)'}`,
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
    ? '상승 원인: Good 멘트·만족 건수·불만족 감소 등 데이터에 나온 요인만.'
    : direction === 'down'
      ? '하락 원인: 불만족 유형·Bad 멘트·불만족 건수 등 데이터에 나온 요인만.'
      : '큰 변동이 없으면 전일과 비슷했다는 요지만.';

  const system = [
    '만족도 데이터 분석가. 제공 수치·멘트·유형만 근거로 사실만 말합니다.',
    '코칭·대응 조언·피드백·권유·“해보세요” 표현 금지.',
    'JSON만: {"reasons":["…","…"]}',
    'reasons: 2~3개. 각 항목 한 문장. 만족도가 왜 올랐/내렸는지 원인만.',
    '상승이면 Good 멘트, 하락이면 불만족 유형을 각각 문장에 그대로 포함(가능하면 첫 항목).',
    '건수 변화(→)는 1개 항목에만. 날짜·%p 나열 금지. 문장 완결.',
    causeHint,
  ].join(' ');

  const user = [
    `만족도 ${dirLabel} · 약 ${Math.abs(deltaPp).toFixed(1)}%p`,
    formatSnapshotBlock('최근', latest),
    formatSnapshotBlock('이전', previous),
    '위만 보고 reasons 2~3개 작성.',
  ].join('\n');

  return lmChatCompletion({ system, user, maxTokens: 280, temperature: 0.32, signal });
}

/**
 * 불만족 유형·Bad 멘트 기반 대응 코칭 시나리오
 */
export async function fetchCsCoachScenario({
  typeLabel,
  badMent,
  date,
  signal,
}) {
  const system = [
    '콜센터 슈퍼바이저가 상담사에게 주는 코칭. 상담사 비난 금지. 쉬운 말.',
    '불만족 **유형**에 맞춰 “이렇게 대응·응대하면 좋겠다”는 **피드백**을 작성하세요. 대화 예시·말풍선 형식 금지.',
    'JSON만: {"feedback":"…","points":["…"]}',
    'feedback: 유형 핵심 조언 1~2문장. 문장은 끝까지 완결되게(중간 생략·… 금지).',
    'points: 0~2개. 각각 짧은 완결 문장. 없으면 빈 배열.',
    'Bad 멘트는 참고만, 원문 복사 금지.',
  ].join(' ');

  const user = [
    `불만족 유형: ${typeLabel || '기타'}`,
    badMent ? `참고 Bad 멘트: ${String(badMent).slice(0, 100)}` : 'Bad 멘트: 없음',
    '이 유형에 대한 대응 피드백 JSON.',
  ].join('\n');

  return lmChatCompletion({ system, user, maxTokens: 280, temperature: 0.42, signal });
}

/**
 * YOU 프로 상위 구성원(랭킹 1~3위) — 선정 포인트 + 접수 제안
 */
export async function fetchTopMembersSpotlightInsight({ items, signal }) {
  const top3 = (items ?? []).slice(0, 3);
  const blocks = top3.map((it, i) => {
    const rank = it.rank > 0 ? it.rank : i + 1;
    return [
      `【${rank}위】`,
      `- 제목: ${it.title || '(없음)'}`,
      `- 응대 내용: ${String(it.description || '').slice(0, 280) || '(없음)'}`,
      `- 관리자 선정 사유(참고): ${String(it.judgmentReason || '').slice(0, 180) || '(없음)'}`,
    ].join('\n');
  });

  const system = [
    'YOU PRO 우수 상담 사례 분석가. 제공 데이터만 근거로 사실·패턴을 설명합니다.',
    '실명·부서·개인 식별 금지.',
    'JSON만: {"entries":[{"rank":1,"selectionReason":"…"}],"recentTrend":"…","trendBullets":["…","…"]}',
    'entries: 1~3위 각 1개. selectionReason: 선정 포인트 1문장, 48자 내외.',
    'recentTrend: 최근 선정된 접수(제목·응대 내용)에서 보이는 공통 패턴을 1~2문장으로 요약. 사실만, 존댓말, 80자 내외.',
    'trendBullets: 2개. 제목·본문 작성에서 요즘 잘 선정되는 방향을 각 1짧은 문장(28자 내외). 번호·따옴표 인용 금지.',
  ].join(' ');

  const user = [
    '랭킹 1~3위 최근 선정 사례(1위=가장 최근). entries·recentTrend·trendBullets 작성.',
    '',
    ...blocks,
  ].join('\n');

  return lmChatCompletion({
    system,
    user,
    maxTokens: 380,
    temperature: 0.35,
    signal,
  });
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
    'Good/Bad 멘트는 통화 후 고객이 MMS 만족도 설문에 직접 적은 내용입니다. 목록은 평가시간 적용(Y) 건만 쓰였고, 사용자 메시지에 적힌 날짜 구간(최근 10일) 안의 멘트입니다. 통계 숫자는 보조 참고만 하고, 분석의 중심은 설문 글입니다.',
    'fromGood: 위 Good 멘트들에 대해, 고객이 칭찬한 점·고마워한 점을 **짧게 칭찬**하세요. 원문 복사·따옴표 인용 금지.',
    'fromBad: Bad 멘트는 설문에 적은 고객의 아쉬움입니다. **따뜻한 말투**로 짧게 **개선 한 가지**만 제안하세요. Good 멘트 맥락을 참고해도 됩니다. 원문 복사·비난 금지.',
    '출력은 유효한 JSON 객체 하나만. 앞뒤 설명·마크다운·코드펜스 금지.',
    '스키마 고정(두 필드만): {"fromGood":"…","fromBad":"…"}',
    '반드시 짧게: 각 값 **최대 2문장**, **줄바꿈 금지(한 줄로만)**. 공백 포함 **각 72자 이내**.',
    'Good 멘트가 없으면 fromGood에 한 문장으로 없음 안내, Bad 없으면 fromBad에 한 문장으로 유지 안내.',
  ].join(' ');

  const batchHint =
    mentWindowStartDate && latestConsultDate
      ? `평가시간=Y만 사용 · 멘트는 상담(평가)일 기준 최근 10일(${mentWindowStartDate} ~ ${latestConsultDate}) 구간에서 수집했습니다.`
      : latestConsultDate
        ? `평가시간=Y만 사용 · 멘트 기준일 ${latestConsultDate} 전후(해당 월 내 최근 10일)입니다.`
        : '평가시간=Y만 사용 · 상담일시 없으면 해당 월 적용 건 전체에서 멘트를 모았습니다.';
  const userPayload = [
    `${year}년 ${month}월 · ${batchHint} MMS 설문형 Good/Bad 텍스트 분석.`,
    '',
    '【참고 통계(간단) — 보조만】',
    statsLines.slice(0, 6).join('\n'),
    '',
    '【Good 멘트 — 최근 10일 구간. 고객이 설문에 적은 긍정·칭찬 원문. fromGood 작성 시 이 목록을 근거로 칭찬하세요】',
    goodLines.length ? goodLines.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(해당 구간 없음)',
    '',
    '【Bad 멘트 — 최근 10일 구간. 고객이 설문에 적은 아쉬움 원문. fromBad 작성 시 이 목록과 Good 목록을 함께 고려하세요. 원문 복사 금지】',
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
