// 서버 전용: 가상 학교(도토리중학교) 교사 계정. 교사 한 명 = 과목 하나 담당.
// 로그인한 교사는 자기 과목의 수행평가와 그 응시 기록만 봅니다.
// 시연용 가상 교사라 비밀번호는 해시만 둡니다 (scrypt, 소금:해시). 실제 도입 시에는 슈퍼스쿨 계정 로그인으로 바꿉니다.
import { scryptSync, timingSafeEqual } from "node:crypto";

export type Teacher = { id: string; name: string; subject: string };

type Account = Teacher & { hash: string };

const ACCOUNTS: Account[] = [
  { id: "kor@dotori.school", name: "김도담", subject: "국어", hash: "3abed960e11eb0834be02c89dd4141f1:c0ea22fc0bb1984445cdf9145ca66fe0dd0d7ac0b9506b1b3ab7b651bcb216bd" },
  { id: "sci@dotori.school", name: "이솔", subject: "과학", hash: "e3cb8232e8a12592532dd070d614559c:a1a73861406c3a885417f9f5e590be5e4f296b9b36d8d2c28eb5d62cee13a96d" },
  { id: "soc@dotori.school", name: "최가람", subject: "사회", hash: "39e391c9a3ec51ee94f06527422a52dc:ac96ec760a16225bf3a1ef940367ac91e033aa5fb453f64f09c4ed67d78e3ee5" },
  { id: "eng@dotori.school", name: "정새봄", subject: "영어", hash: "f0d9f354c22ce791b5b1d3ad9f517b90:0f4be4347358fc45836d7c2ef8a6fc118ab1fcda2f43ba4311abe80a850e47f9" },
];

const pub = ({ id, name, subject }: Account): Teacher => ({ id, name, subject });

export function findTeacher(id: string): Teacher | null {
  const a = ACCOUNTS.find((t) => t.id === id);
  return a ? pub(a) : null;
}

/** 아이디·비밀번호가 맞으면 교사 정보, 아니면 null */
export function verifyTeacher(id: unknown, password: unknown): Teacher | null {
  if (typeof id !== "string" || typeof password !== "string" || password.length > 200) return null;
  const a = ACCOUNTS.find((t) => t.id === id.trim().toLowerCase());
  // 없는 아이디도 같은 시간이 걸리게 해시는 항상 계산
  const [salt, hash] = (a ?? ACCOUNTS[0]).hash.split(":");
  const got = scryptSync(password, salt, 32);
  const ok = timingSafeEqual(got, Buffer.from(hash, "hex"));
  return a && ok ? pub(a) : null;
}
