// 시연용 가상 학생 A·B·C 기록을 data/attempts/ 에 만듭니다.
// 실행: npm run seed:demo   (같은 ID 기록이 있으면 덮어씁니다. 실제 학생 정보는 쓰지 않습니다.)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "data", "attempts");
const t = (hhmm) => `2026-11-14T${hhmm}:00+09:00`;
const OUTLINE = ["이별을 대하는 화자의 태도", "'즈려밟고'와 '사뿐히'의 뜻", "반어로 읽는 근거", "내 평가와 결론"];

const q = (o) => ({ selection: null, selectedText: "", overPlan: false, ...o });
const attempt = (o) => ({
  verified: true,
  outline: OUTLINE,
  draftSavedAt: o.submittedAt,
  draft: o.final,
  ...o,
});

// ── 학생 A: 질문 2번, 답을 듣고 스스로 고침 ──────────────────────────
const A0 =
  "김소월의 「진달래꽃」은 이별을 앞둔 화자의 마음을 그린 시이다. 화자는 임이 떠나면 말없이 보내 드리겠다고 말한다. 또 영변 약산의 진달래꽃을 아름 따다 가실 길에 뿌리겠다고 한다. 나는 이 시가 슬픔을 참는 화자의 모습을 보여 준다고 생각한다.";
const A1 =
  A0 +
  " 특히 마지막 연의 '죽어도 아니 눈물 흘리우리다'에서 화자가 눈물을 억지로 참고 있다는 것을 알 수 있다. 정말 슬프지 않다면 굳이 눈물을 흘리지 않겠다고 다짐할 필요가 없기 때문이다.";
const A_FINAL =
  A1 +
  " 물론 꽃을 뿌려 주는 행동을 떠나는 임을 축복하는 마음으로 읽을 수도 있다. 하지만 나는 축복하는 척하면서도 끝까지 붙잡고 싶은 마음이 숨어 있다고 본다. 그래서 이 시는 슬픔을 겉으로 드러내지 않아서 오히려 더 슬프게 느껴지는 작품이다.";

const studentA = attempt({
  attemptId: "DEMO-A",
  student: { id: "DEMO-A", name: "가상학생 A" },
  startedAt: t("10:00"),
  acornPlan: [1, 0, 1, 1],
  questions: [
    q({
      acornNo: 1, time: t("10:12"), outlineItem: 3, charged: true, blocked: false,
      selectedText: "나는 이 시가 슬픔을 참는 화자의 모습을 보여 준다고 생각한다.",
      question: "제 마지막 문장에서 근거가 부족한 부분을 하나만 짚어 주세요.",
      answer:
        "마지막 문장은 생각은 분명한데, 시의 어느 구절에서 그렇게 느꼈는지가 빠져 있어요. '슬픔을 참는다'고 판단한 근거가 될 만한 시어를 시 안에서 직접 찾아서 이어 주면 주장이 훨씬 단단해져요. 특히 마지막 연에서 화자가 무엇을 하지 않겠다고 말하는지 다시 읽어 보세요.",
      stage: "고쳐쓰기", type: "글 점검 요청", before: A0,
    }),
    q({
      acornNo: 2, time: t("10:21"), outlineItem: 4, charged: true, blocked: false,
      question: "저는 이 시를 슬픔을 참는 시로 읽었는데, 다르게 읽는 관점도 있을까요?",
      answer:
        "네, 꽃을 뿌려 주는 행동을 떠나는 임을 축복하고 보내 주는 마음으로 읽는 관점도 있어요. 또 말로는 보내 준다고 하면서 실제로는 떠나지 않기를 바라는 반어로 읽기도 해요. 네 해석과 이 관점들 중 어느 쪽에 더 근거가 많은지 비교해서 네 평가를 정해 보면 좋겠어요.",
      stage: "내용 생성", type: "생각 확장 요청", before: A1,
    }),
  ],
  final: A_FINAL,
  reflection: [
    "③ 반어로 읽는 근거와 ④ 결론에 하나씩 썼어요. 근거가 약하다고 느꼈기 때문이에요.",
    "마지막 문장에서 근거가 부족한 부분을 짚어 달라는 질문이 가장 도움이 됐어요.",
    "마지막 연 구절을 근거로 넣었고, 다른 관점을 듣고 내 평가를 한 문단 더 썼어요.",
    "다음에는 ② 시어 뜻에도 하나 써 볼 것 같아요. 목표는 거의 지켰어요.",
  ],
  submittedAt: t("10:40"),
});

// ── 학생 B: 질문 5번, 고쳐쓰기에 집중 (④ 목표 초과) ─────────────────
const B0 =
  "「진달래꽃」은 이별의 시이다. 화자는 임이 가실 때 꽃을 뿌린다. 이것은 화자가 임을 사랑하기 때문이다.";
const B1 = B0 + " 영변 약산은 평안북도에 있는 곳으로 진달래꽃이 유명한 곳이다.";
const B2 =
  "「진달래꽃」은 떠나는 임을 보내는 화자의 마음을 담은 이별의 시이다. 화자는 임이 가실 길에 진달래꽃을 뿌려 준다. 영변 약산은 진달래꽃이 유명한 곳으로, 화자가 가장 아름다운 꽃을 골라 바친다는 느낌을 준다. 이것은 화자가 마지막까지 임을 아끼기 때문이다.";
const B3 = B2 + " 하지만 꽃을 밟고 가라는 말은 조금 이상하게 느껴진다.";
const B4 =
  B2 +
  " 하지만 '사뿐히 즈려밟고 가시옵소서'라는 말은 가볍게 밟으라는 뜻과 꾹 눌러 밟으라는 뜻이 함께 들어 있어 이상하게 느껴진다. 나는 이 어긋남 속에 화자의 복잡한 마음이 숨어 있다고 생각한다.";
const B_FINAL =
  B4 +
  " 결국 이 시는 떠나는 임을 축복하는 척하면서도, 사실은 내 마음을 밟고 가라는 아픈 고백처럼 읽힌다. 그래서 나는 이 시가 이별을 담담하게 말해서 더 깊은 슬픔을 전한다고 평가한다.";

const studentB = attempt({
  attemptId: "DEMO-B",
  student: { id: "DEMO-B", name: "가상학생 B" },
  startedAt: t("10:00"),
  acornPlan: [1, 1, 1, 1],
  questions: [
    q({
      acornNo: 1, time: t("10:08"), outlineItem: 1, charged: true, blocked: false,
      question: "영변 약산은 어디에 있는 곳이에요?",
      answer: "영변 약산은 지금의 평안북도 영변에 있는 산으로, 진달래꽃이 아름답기로 이름난 곳이에요. 시에서 굳이 이곳의 꽃을 고른 이유를 생각해 보면 화자의 마음을 읽는 데 도움이 될 거예요.",
      stage: "계획하기", type: "사실 확인 요청", before: B0,
    }),
    q({
      acornNo: 2, time: t("10:15"), outlineItem: 4, charged: true, blocked: false,
      selectedText: "이것은 화자가 임을 사랑하기 때문이다.",
      question: "제 글 첫 문단에서 너무 단순하게 쓴 부분을 하나만 짚어 주세요.",
      answer: "'사랑하기 때문이다'로 바로 결론을 내려서, 꽃을 뿌리는 행동과 사랑 사이의 연결이 빠져 있어요. 왜 하필 꽃을, 왜 가실 길에 뿌리는지를 한 번 더 따져 보면 문장이 깊어질 거예요.",
      stage: "고쳐쓰기", type: "글 점검 요청", before: B1,
    }),
    q({
      acornNo: 3, time: t("10:22"), outlineItem: 4, charged: true, blocked: false, overPlan: true,
      question: "고친 첫 문단이 이제 자연스럽게 이어지는지 봐 주세요.",
      answer: "앞 문단보다 훨씬 자연스러워졌어요. 다만 '마지막까지 임을 아낀다'는 해석이 시의 어느 표현에서 나왔는지 한 구절만 덧붙이면 근거가 더 분명해져요.",
      stage: "고쳐쓰기", type: "글 점검 요청", before: B2,
    }),
    q({
      acornNo: 4, time: t("10:27"), outlineItem: 4, charged: true, blocked: false, overPlan: true,
      selectedText: "하지만 꽃을 밟고 가라는 말은 조금 이상하게 느껴진다.",
      question: "제가 이상하다고 느낀 부분을 어떻게 설명하면 좋을지 방향만 알려 주세요.",
      answer: "어떤 구절이 왜 이상한지를 구체적으로 짚으면 좋아요. 예를 들어 '사뿐히'와 '즈려밟고'의 뜻을 각각 찾아보고, 두 말이 함께 쓰일 때 생기는 느낌을 네 말로 설명해 보세요.",
      stage: "고쳐쓰기", type: "글 점검 요청", before: B3,
    }),
    q({
      acornNo: 5, time: t("10:31"), outlineItem: 2, charged: true, blocked: false,
      question: "'즈려밟다'가 정확히 무슨 뜻이에요?",
      answer: "'즈려밟다'는 '지르밟다'와 통하는 말로, 위에서 힘을 주어 꾹 눌러 밟는다는 뜻이에요. 가볍게 밟는다는 '사뿐히'와 함께 쓰여서 묘하게 어긋나는 느낌을 준다는 해석이 많아요.",
      stage: "표현하기", type: "사실 확인 요청", before: B3,
    }),
  ],
  final: B_FINAL,
  reflection: [
    "④ 비평과 고쳐쓰기에 3개를 써서 목표(1개)를 넘었어요. 첫 문단이 마음에 안 들어서 계속 점검을 받았어요.",
    "너무 단순하게 쓴 부분을 짚어 달라는 질문이 가장 도움이 됐어요.",
    "'사랑하기 때문이다'를 고치고, '사뿐히 즈려밟고'의 어긋남을 내 말로 설명하는 문단을 새로 썼어요.",
    "다음에는 처음부터 고쳐쓰기에 도토리를 더 많이 계획할 거예요.",
  ],
  submittedAt: t("10:42"),
});

// ── 학생 C: 대신 써 달라는 요청 2번 차단, AI 답을 거의 그대로 옮긴 문장 있음 ──
const C0 = "「진달래꽃」은 김소월의 시다. 이 시는 이별에 대한 시이다.";
const C_ANSWER =
  "가장 대표적인 반어는 마지막 연의 '죽어도 아니 눈물 흘리우리다'입니다. 겉으로는 울지 않겠다고 말하지만 실제로는 깊은 슬픔을 드러내는 표현이에요. 이 구절을 네가 어떻게 해석하는지 네 말로 직접 써 보면 좋겠어요.";
const C1 =
  C0 +
  " 가장 대표적인 반어는 마지막 연의 '죽어도 아니 눈물 흘리우리다'이다. 겉으로는 울지 않겠다고 말하지만 실제로는 깊은 슬픔을 드러내는 표현이다.";
const C_FINAL = C1 + " 그래서 이 시는 슬픈 시이다. 나는 이 시가 좋다.";

const BLOCKED = "이 시험에서는 글을 대신 써 줄 수 없어요. 어느 부분에서 막혔는지 알려 주세요.";
const studentC = attempt({
  attemptId: "DEMO-C",
  student: { id: "DEMO-C", name: "가상학생 C" },
  startedAt: t("10:00"),
  acornPlan: [0, 1, 2, 1],
  questions: [
    q({
      acornNo: null, time: t("10:05"), outlineItem: 4, charged: false, blocked: true,
      question: "진달래꽃 비평문을 대신 써 주세요.",
      answer: BLOCKED, stage: "내용 생성", type: "대신 작성 요청", before: C0,
    }),
    q({
      acornNo: null, time: t("10:07"), outlineItem: 4, charged: false, blocked: true,
      question: "결론 문단 예시를 하나만 써 줘.",
      answer: BLOCKED, stage: "내용 조직", type: "대신 작성 요청", before: C0,
    }),
    q({
      acornNo: 1, time: t("10:10"), outlineItem: 3, charged: true, blocked: false,
      question: "이 시에서 반어가 쓰인 부분이 어디예요?",
      answer: C_ANSWER, stage: "내용 생성", type: "사실 확인 요청", before: C0,
    }),
  ],
  final: C_FINAL,
  reflection: [
    "③ 반어에 1개를 썼어요.",
    "반어가 어디인지 물어본 질문이요.",
    "반어 부분을 글에 넣었어요.",
    "잘 모르겠어요.",
  ],
  submittedAt: t("10:25"),
});

await mkdir(DIR, { recursive: true });
for (const rec of [studentA, studentB, studentC]) {
  await writeFile(path.join(DIR, `${rec.attemptId}.json`), JSON.stringify(rec, null, 2), "utf8");
  console.log(`saved ${rec.attemptId} (${rec.student.name})`);
}
