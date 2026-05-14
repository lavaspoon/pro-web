/**
 * 로컬 LM Studio OpenAI 호환 API (/v1/chat/completions)
 * CRA: REACT_APP_LM_STUDIO_URL (기본 http://127.0.0.1:1234)
 */
const DEFAULT_BASE = 'http://127.0.0.1:1234';
export const LM_STUDIO_MODEL = 'gemma-3-4b-it-qat';

function stripBase(url) {
  return String(url || '').replace(/\/$/, '');
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
  const base = stripBase(process.env.REACT_APP_LM_STUDIO_URL || DEFAULT_BASE);
  const url = `${base}/v1/chat/completions`;

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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LM_STUDIO_MODEL,
      temperature: 0.42,
      max_tokens: 180,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPayload },
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
