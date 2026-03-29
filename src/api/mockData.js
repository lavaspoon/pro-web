export const TEAMS = [
  { id: 'team1', name: '1실' },
  { id: 'team2', name: '2실' },
  { id: 'team3', name: '3실' },
];

export const MEMBERS = [
  { id: 'u1', name: '김민준', teamId: 'team1', position: '상담사', role: 'member' },
  { id: 'u2', name: '이수연', teamId: 'team1', position: '상담사', role: 'member' },
  { id: 'u3', name: '박정현', teamId: 'team1', position: '선임상담사', role: 'member' },
  { id: 'u4', name: '최유진', teamId: 'team2', position: '상담사', role: 'member' },
  { id: 'u5', name: '정승호', teamId: 'team2', position: '선임상담사', role: 'member' },
  { id: 'u6', name: '한지영', teamId: 'team3', position: '상담사', role: 'member' },
  { id: 'u7', name: '오재현', teamId: 'team3', position: '선임상담사', role: 'member' },
  { id: 'admin1', name: '김담당', teamId: null, position: '담당자', role: 'admin' },
];

export const CASES = [
  {
    id: 'case1',
    memberId: 'u1',
    title: '고객 불만 신속 해결 및 감동 응대',
    description: '인터넷 서비스 오류로 인한 고객 불만을 빠르게 해결하고, 선제적 보상으로 고객 만족도를 극대화한 사례',
    submittedAt: '2026-03-05T09:30:00',
    status: 'selected',
    month: '2026-03',
    callDuration: '18분 32초',
    customerType: '장기고객 (8년)',
    judgmentReason:
      '고객의 불만을 경청하고 즉각적인 해결책을 제시하였으며, 서비스 오류에 대한 선제적 보상으로 고객 이탈을 방지한 우수한 응대 사례입니다.',
    judgedAt: '2026-03-10T14:00:00',
    aiKeyPoint: {
      recommendation: 'selected',
      confidence: 94,
      summary:
        '고객 공감 표현이 9회로 업무 평균(4.2회) 대비 2배 이상 높으며, 해결 시간이 평균 대비 40% 단축되었습니다.',
      highlights: [
        '적극적인 경청 표현 다수 확인',
        '해결책 제시 속도 우수',
        '고객 감사 표현으로 대화 마무리',
        '서비스 장애 선제 안내 및 보상 제안',
      ],
      score: 92,
    },
    fullTranscript: `고객: 아, 정말 인터넷이 왜 이렇게 자꾸 끊기는 거예요? 벌써 세 번째예요!
상담사: 고객님, 많이 불편하셨겠어요. 죄송합니다. 먼저 상황을 자세히 말씀해 주시겠어요?
고객: 어제 저녁 8시, 오늘 새벽 2시, 그리고 아까 오전에도 끊겼어요. 재택근무 중인데 업무에 지장이 너무 커요.
상담사: 재택근무 중이신데 정말 많이 불편하셨겠습니다. 지역 내 설비 점검 이력을 확인해 볼게요. 잠시만요.
상담사: 확인해보니 고객님 지역에서 어제 저녁부터 오늘 오전까지 설비 임시 점검이 있었고, 이 과정에서 간헐적 접속 오류가 발생했습니다. 충분한 사전 안내가 부족했던 점 진심으로 사과드립니다.
고객: 그럼 그냥 설비 점검 때문이었던 건가요? 왜 미리 알려주지 않은 거예요?
상담사: 맞습니다. 고객님께 사전 SMS 공지가 발송됐어야 하는데, 시스템 오류로 누락된 것으로 확인됩니다. 이 부분은 저희 잘못이 맞습니다. 불편을 드린 만큼, 이번 달 요금에서 3일치 기본료를 감면해 드리겠습니다.
고객: 아, 그렇군요. 감사합니다. 그런데 앞으로도 이런 일이 생기면 미리 알 수 있나요?
상담사: 네, 고객님 연락처로 SMS 알림을 활성화해 드리겠습니다. 앞으로는 설비 점검 전 미리 안내 받으실 수 있습니다. 혹시 다른 불편하신 점은 없으신가요?
고객: 아니요, 이제 괜찮아요. 빠르게 해결해 주셔서 감사해요.`,
  },
  {
    id: 'case2',
    memberId: 'u1',
    title: '고령 고객 맞춤형 요금제 안내로 월 절감 실현',
    description: '디지털 기기에 익숙하지 않은 고령 고객에게 쉬운 언어로 요금제를 안내하고, 월 2만 3천원 절감에 성공한 사례',
    submittedAt: '2026-03-15T11:00:00',
    status: 'pending',
    month: '2026-03',
    callDuration: '24분 15초',
    customerType: '고령 고객 (72세, 10년)',
    judgmentReason: null,
    judgedAt: null,
    aiKeyPoint: {
      recommendation: 'selected',
      confidence: 88,
      summary:
        '쉬운 용어 사용과 반복 설명으로 고객 이해도를 높였으며, 맞춤형 절감 솔루션 제시가 돋보입니다.',
      highlights: [
        '전문용어 없이 쉬운 언어 사용',
        '고객 이해 확인 후 단계별 설명',
        '월 2.3만원 요금 절감 실현',
        '가족 결합 요금제 추가 안내',
      ],
      score: 87,
    },
    fullTranscript: `고객: 여보세요, 저 요금이 왜 이렇게 많이 나오는지 모르겠어요. 작년보다 훨씬 많이 나와서요.
상담사: 안녕하세요, 고객님! 요금 때문에 걱정되셨군요. 제가 도와드릴게요. 현재 어떤 요금제를 쓰고 계신지 확인해봐도 될까요?
고객: 요금제요? 그게 뭔지 잘 모르겠는데요. 전화기 쓰는 건데 요금제가 따로 있나요?
상담사: 네, 쉽게 말씀드리면 매달 얼마를 내는지 정하는 약정 같은 거예요. 고객님은 지금 월 6만 9천원짜리를 쓰고 계신데, 사용 내역을 보니 데이터를 거의 안 쓰시더라고요.
고객: 데이터요? 그게 인터넷 같은 건가요?
상담사: 맞아요! 스마트폰으로 카카오톡이나 인터넷 쓸 때 데이터가 쓰여요. 고객님은 주로 전화 통화만 많이 하시는 것 같아서, 통화 위주 요금제로 바꾸시면 한 달에 약 2만 3천원을 아끼실 수 있어요.
고객: 아이고, 그렇군요. 근데 바꿔도 전화 통화하는 데는 문제없는 거죠?
상담사: 물론이죠! 전화는 오히려 더 넉넉하게 쓸 수 있어요. 혹시 가족분들이랑 자주 통화하시나요? 가족 분들도 SKT를 쓰시면 함께 묶어서 더 저렴하게 할 수도 있거든요.`,
  },
  {
    id: 'case3',
    memberId: 'u1',
    title: '데이터 과금 오류 즉시 환불 처리',
    description: '시스템 오류로 과다 청구된 데이터 요금을 즉시 확인하고 환불 처리한 사례',
    submittedAt: '2026-02-20T14:30:00',
    status: 'rejected',
    month: '2026-02',
    callDuration: '9분 45초',
    customerType: '일반 고객 (3년)',
    judgmentReason:
      '해결 과정은 적절하였으나, 고객 공감 표현과 추가 가치 제공이 부족하여 우수사례 기준에 미달합니다.',
    judgedAt: '2026-02-25T10:00:00',
    aiKeyPoint: {
      recommendation: 'rejected',
      confidence: 71,
      summary:
        '문제 해결 속도는 우수하나 공감 표현(2회)이 업무 평균(4.2회) 대비 낮고 추가 가치 제안이 없었습니다.',
      highlights: ['신속한 오류 확인 및 처리', '공감 표현 횟수 부족', '추가 서비스 안내 미실시'],
      score: 68,
    },
    fullTranscript: `고객: 이번 달 데이터 요금이 이상하게 많이 나왔어요. 확인해주세요.
상담사: 네, 확인해드릴게요. 고객님 번호 알려주시겠어요?
고객: 010-XXXX-XXXX입니다.
상담사: 확인해보니 3월 15일에 데이터 과금 처리 오류가 있었습니다. 5,500원이 잘못 청구됐네요. 즉시 환불해드리겠습니다.
고객: 언제 들어오나요?
상담사: 2-3 영업일 이내에 처리됩니다.`,
  },
  {
    id: 'case4',
    memberId: 'u2',
    title: '로밍 서비스 긴급 개통으로 해외 출장 고객 지원',
    description: '해외 출장 당일 로밍이 안 된다는 고객의 긴급 요청을 공항에서 빠르게 처리한 사례',
    submittedAt: '2026-03-10T08:20:00',
    status: 'selected',
    month: '2026-03',
    callDuration: '11분 08초',
    customerType: '법인 고객 (5년)',
    judgmentReason:
      '긴박한 상황에서도 침착하게 고객의 요구를 파악하고, 신속하게 해결책을 제시하여 고객 신뢰를 확보한 우수사례입니다.',
    judgedAt: '2026-03-14T09:30:00',
    aiKeyPoint: {
      recommendation: 'selected',
      confidence: 91,
      summary: '긴박한 상황에서 평균 처리 시간(8분) 내 해결 완료, 고객 만족 최상위 응대.',
      highlights: ['즉각적 문제 파악 및 안심 제공', '빠른 솔루션 제공 (3분 완료)', '추가 현지 정보 안내'],
      score: 90,
    },
    fullTranscript: `고객: 지금 공항인데 로밍이 안 돼요! 2시간 뒤에 출발인데 어떡해요!
상담사: 고객님, 걱정 마세요! 제가 지금 바로 처리해드릴게요. 몇 분만 시간 주세요.
고객: 빨리 해주세요, 정말 급해요.
상담사: 네, 확인해보니 로밍 신청이 아직 완료되지 않은 상태네요. 지금 즉시 개통 처리해드리겠습니다. 개통 완료까지 약 3분 소요됩니다.
상담사: 완료됐습니다! 지금 바로 사용하실 수 있어요. 방문하실 국가가 어디신가요? 현지에서 유용한 정보도 안내해드릴게요.
고객: 일본이요. 아, 이제 되네요! 정말 감사합니다!`,
  },
  {
    id: 'case5',
    memberId: 'u4',
    title: '월정액 서비스 중복 가입 발견 및 해지 처리',
    description: '고객이 인지하지 못한 중복 가입 서비스를 확인하고 적극적으로 해지 및 환불 안내한 사례',
    submittedAt: '2026-03-12T15:45:00',
    status: 'selected',
    month: '2026-03',
    callDuration: '16분 22초',
    customerType: '일반 고객 (6년)',
    judgmentReason:
      '고객 이익을 최우선으로 생각하여 중복 서비스를 선제적으로 발견하고, 불필요한 지출을 줄여드린 신뢰 기반 응대 사례입니다.',
    judgedAt: '2026-03-18T11:00:00',
    aiKeyPoint: {
      recommendation: 'selected',
      confidence: 93,
      summary: '고객 이익 중심 응대로 장기 신뢰 구축. 월 8,800원 × 3개월 환불 실현.',
      highlights: ['선제적 중복 서비스 발견', '고객 이익 우선 응대', '3개월치 소급 환불 안내'],
      score: 91,
    },
    fullTranscript: `고객: 다른 건 아니고 요금 명세서를 보다가 뭔가 이상한 게 있어서요.
상담사: 네, 말씀해주세요. 어떤 부분이 이상하게 느껴지셨나요?
고객: 뮤직 서비스인가 뭔가가 두 개가 있는 것 같은데, 저 하나만 신청했거든요.
상담사: 확인해보겠습니다. 혹시 작년 10월에 이벤트 가입을 하신 적 있으신가요?
고객: 어, 맞아요. 그때 경품 행사 때 가입한 것 같아요.
상담사: 네, 확인이 됩니다. 이벤트로 가입된 서비스가 무료 기간 종료 후 유료로 전환된 상태에요. 기존에 쓰시던 것과 중복이 되어서 매달 8,800원이 추가로 나가고 있었어요.
고객: 아이고, 그런 게 있었군요. 몰랐어요.
상담사: 고객님이 모르고 계셨던 거라 지금 바로 해지 처리해드리겠습니다. 그리고 지난 3개월치도 환불 신청을 도와드릴게요.`,
  },
  {
    id: 'case6',
    memberId: 'u3',
    title: '5G 전환 거부 고객 데이터 기반 설득',
    description: '5G로의 요금제 전환을 거부하던 고객에게 실제 사용 데이터를 제시하며 장점을 설명한 사례',
    submittedAt: '2026-03-08T13:00:00',
    status: 'selected',
    month: '2026-03',
    callDuration: '22분 40초',
    customerType: '일반 고객 (4년)',
    judgmentReason: '논리적인 데이터 제시와 고객 맞춤 설명으로 신뢰를 형성한 우수사례입니다.',
    judgedAt: '2026-03-13T10:00:00',
    aiKeyPoint: {
      recommendation: 'selected',
      confidence: 89,
      summary: '데이터 기반 설득력 높은 응대. 고객 맞춤 시나리오 제시가 효과적.',
      highlights: ['실제 사용 패턴 분석 제시', '비용 대비 혜택 명확 설명', '고객 우려사항 선제 해소'],
      score: 88,
    },
    fullTranscript: `고객: LTE도 충분한데 굳이 5G로 바꿀 필요가 있나요?
상담사: 좋은 질문이세요! 실제 고객님 사용 패턴을 보면 월평균 28GB를 쓰고 계시거든요. LTE 기준으로 데이터 초과 요금이 계속 발생하고 있어서요.
고객: 아, 그래요? 얼마나 나가고 있는데요?
상담사: 지난 3개월 평균 약 6,200원씩 초과 요금이 발생했어요. 5G 무제한으로 바꾸시면 오히려 월 3,000원 정도 더 저렴하게 무제한으로 쓸 수 있어요.`,
  },
  {
    id: 'case7',
    memberId: 'u5',
    title: '청각장애 고객 문자 상담 전환 및 완벽 지원',
    description: '청각장애 고객이 통화 대신 문자 상담을 원한다는 요청을 받아 채팅 채널로 연결하고 완벽히 해결한 사례',
    submittedAt: '2026-03-03T10:30:00',
    status: 'selected',
    month: '2026-03',
    callDuration: '문자 상담 32분',
    customerType: '장애인 고객 (7년)',
    judgmentReason:
      '사회적 배려가 필요한 고객에 대한 적극적 지원과 채널 전환으로 서비스 접근성을 높인 모범 사례입니다.',
    judgedAt: '2026-03-08T09:00:00',
    aiKeyPoint: {
      recommendation: 'selected',
      confidence: 97,
      summary: '포용적 서비스 제공의 모범. 고객 편의에 맞춘 채널 전환 및 완전 해결.',
      highlights: ['장애 고객 맞춤 응대', '채널 유연하게 전환', '문제 완전 해결', '후속 확인 연락'],
      score: 96,
    },
    fullTranscript: `[문자] 고객: 안녕하세요. 저는 청각장애가 있어서 통화가 어렵습니다. 문자로 상담 가능할까요?
[문자] 상담사: 네, 물론입니다! 문자 상담으로 도와드릴게요. 어떤 도움이 필요하신가요?
[문자] 고객: 데이터 자동 충전 설정을 해제하고 싶은데 앱에서 안 되네요.
[문자] 상담사: 알겠습니다. 제가 직접 시스템에서 처리해드릴게요. 완료됐습니다! 혹시 다른 불편하신 점 있으시면 언제든 문자로 연락주세요.`,
  },
];

export const ANNUAL_STATS = {
  u1: { totalSelected: 8, monthlySelected: { '1월': 1, '2월': 0, '3월': 2 } },
  u2: { totalSelected: 6, monthlySelected: { '1월': 1, '2월': 2, '3월': 1 } },
  u3: { totalSelected: 11, monthlySelected: { '1월': 2, '2월': 2, '3월': 3 } },
  u4: { totalSelected: 7, monthlySelected: { '1월': 1, '2월': 2, '3월': 2 } },
  u5: { totalSelected: 9, monthlySelected: { '1월': 2, '2월': 3, '3월': 2 } },
  u6: { totalSelected: 4, monthlySelected: { '1월': 0, '2월': 1, '3월': 1 } },
  u7: { totalSelected: 7, monthlySelected: { '1월': 2, '2월': 1, '3월': 2 } },
};

export const TEAM_STATS = {
  team1: { name: '1실', avgSelected: 8.3, totalSelected: 25, memberCount: 3 },
  team2: { name: '2실', avgSelected: 8.0, totalSelected: 16, memberCount: 2 },
  team3: { name: '3실', avgSelected: 5.5, totalSelected: 11, memberCount: 2 },
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export const getMemberById = (id) => MEMBERS.find((m) => m.id === id);
export const getTeamById = (id) => TEAMS.find((t) => t.id === id);
export const getCaseById = (id) => CASES.find((c) => c.id === id);
export const getMembersByTeam = (teamId) => MEMBERS.filter((m) => m.teamId === teamId);
export const getCasesByMember = (memberId) => CASES.filter((c) => c.memberId === memberId);

export const getMonthlySelectedCount = (memberId, yearMonth) => {
  return CASES.filter(
    (c) => c.memberId === memberId && c.month === yearMonth && c.status === 'selected',
  ).length;
};

export const apiDelay = delay;
