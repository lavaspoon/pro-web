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
  signal,
}) {
  const base = stripBase(process.env.REACT_APP_LM_STUDIO_URL || DEFAULT_BASE);
  const url = `${base}/v1/chat/completions`;

  const system = [
    '당신은 통신사 콜센터 상담사를 코칭하는 슈퍼바이저입니다.',
    'Good/Bad 멘트는 상담 통화가 끝난 뒤 고객이 MMS로 받은 만족도 설문지에 직접 적은 내용입니다. 사용자 메시지에 실린 목록은 원본에서 평가시간 적용(평가시간=Y) 건만 쓰였고, 같은 달 안에서 상담일자(상담일시 기준)가 가장 최근인 날짜의 접수 건만 모았습니다. 통계 숫자는 맥락 참고만 하고, 분석의 중심은 이 설문 글입니다.',
    'Good 멘트: 고객이 설문에 긍정적으로 적어 준 내용에서 반복되는 강점을 한 줄로 요약하세요.',
    'Bad 멘트의 의미를 반드시 구분하세요. Bad 멘트는 상담사가 통화 중 한 발언이 아니라, 고객이 MMS 설문에서 “상담이 별로였다”고 느낀 점을 고객이 스스로 적은 불만·아쉬움입니다. 원문 복사·따옴표 인용 금지. 고객 경험 관점에서 상담을 어떻게 개선하면 좋을지, 상담사를 비난하지 않고 한 줄로 요약하세요.',
    '출력은 유효한 JSON 객체 하나만. 앞뒤 설명·마크다운·코드펜스 금지.',
    '스키마 고정: {"fromGood":"…","fromBad":"…","nextStep":"…"}',
    '각 값은 한 문장·최대 약 52자. nextStep은 설문 피드백을 바탕으로 오늘부터 실천할 구체적 행동 한 가지.',
    'Good 멘트가 없으면 fromGood에 짧게 없음 안내, Bad 없으면 fromBad에 유지 안내.',
  ].join(' ');

  const batchHint = latestConsultDate
    ? `평가시간=Y만 사용 · 최신 상담일 ${latestConsultDate} 접수 건의 멘트입니다.`
    : '평가시간=Y만 사용 · 상담일시 없으면 해당 월 적용 건 전체에서 멘트를 모았습니다.';
  const userPayload = [
    `${year}년 ${month}월 · ${batchHint} MMS 설문형 Good/Bad 텍스트 분석.`,
    '',
    '【참고 통계(간단) — 보조만】',
    statsLines.slice(0, 4).join('\n'),
    '',
    '【Good 멘트 — 통화 후 MMS 설문지에 고객이 적은 원문. 만족·칭찬 표현에서 패턴을 찾을 것】',
    goodLines.length ? goodLines.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(이번 달 없음)',
    '',
    '【Bad 멘트 — 통화 후 MMS 설문지에 고객이 적은 원문. 상담사의 통화 발언이 아니라, 고객이 상담이 아쉬웠다고 느낀 점을 고객이 직접 쓴 내용임. 요약 시 원문 복사 금지】',
    badLines.length ? badLines.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(없음)',
  ].join('\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LM_STUDIO_MODEL,
      temperature: 0.42,
      max_tokens: 280,
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
