/**
 * 관리자 AI 분석 mock — 실제 API 연동 전 데모용 고정 대화·요약
 */

/** AI 분석 결과에 쓸 임의 대화형(핵심 요약) 턴 */
export const MOCK_AI_CHAT_TURNS = [
  { role: 'customer', text: '요금이 갑자기 올랐는데, 데이터를 안 쓴 것 같아요.' },
  { role: 'agent', text: '사용 내역을 확인해 보니 해외 로밍 데이터가 잠깐 발생했습니다.' },
  { role: 'customer', text: '공항에서 켜 둔 것 때문에 그런가요?' },
  { role: 'agent', text: '네, 가능성이 높습니다. 할인 신청 안내를 보내 드릴게요.' },
  { role: 'customer', text: '알겠습니다. 신청할게요.' },
];

export const MOCK_AI_SUMMARY =
  '요금 이의 → 로밍 데이터 원인 설명 → 할인 검토·안내까지 응대가 이어졌습니다. (데모)';

export const MOCK_AI_RATIONALE =
  '고객 불만에 대해 원인(로밍)을 구체적으로 설명하고, 후속 조치(할인·문자 안내)를 제시했습니다. 톤이 친절하고 정책 안내가 명확합니다. (데모 mock)';

export const MOCK_AI_HIGHLIGHTS = [
  '문제 원인을 데이터 사용 내역으로 설명함 (데모)',
  '추가 조치(할인 검토, 안내 문자)를 제시함 (데모)',
];

/** AI 핵심멘트 (mock) — 한 줄 요약 */
export const MOCK_AI_KEY_MESSAGE_SELECTED =
  '원인 설명·할인 안내까지 끊김 없이 이어진 응대로, 고객 신뢰 회복에 유리합니다.';

export const MOCK_AI_KEY_MESSAGE_REJECTED =
  '일부 구간에서 정책 근거가 약해 보이며, 우수 사례로 제출하기엔 보완이 필요합니다.';

/** AI 피드백 본문 (mock) */
export const MOCK_AI_FEEDBACK_SELECTED =
  '고객의 불만(요금)에 대해 로밍 데이터 사용을 근거로 설명하고, 할인 가능 여부를 안내한 점이 긍정적입니다. ' +
  '톤은 친절하며 마무리(문자 안내)까지 제시되어 선정 후보로 적합합니다. (mock 데이터)';

export const MOCK_AI_FEEDBACK_REJECTED =
  '응대 흐름은 양호하나, 정책 인용·근거 제시가 짧고 녹취 일부에서 확인이 필요합니다. ' +
  '관리자가 STT를 다시 검토한 뒤 선정 여부를 판단하는 것이 좋습니다. (mock 데이터)';
