"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Wear } from "@/lib/growth";

type Hop = "idle" | "squash" | "jump" | "land";
type Eat = "none" | "grab" | "chewA" | "chewB" | "gulp" | "yum";

const JELLY = "cubic-bezier(.34,1.56,.64,1)";
const T: React.CSSProperties = { transformBox: "view-box", transformOrigin: "58px 114px" };
const BODY: Record<Hop, React.CSSProperties> = {
  idle: { ...T, transition: `transform .45s ${JELLY}`, transform: "none" },
  squash: { ...T, transition: "transform .13s ease-in", transform: "scale3d(1.1,.88,1)" },
  jump: { ...T, transition: "transform .24s cubic-bezier(.2,.8,.3,1)", transform: "translate3d(0,-18px,0) scale3d(.95,1.06,1) rotate(-3deg)" },
  land: { ...T, transition: "transform .13s ease-in", transform: "scale3d(1.08,.93,1)" },
};
// 꼬리는 몸보다 한 박자 늦게 따라옴 (뛸 때 아래로 처졌다가 내려앉을 때 휙 올라감)
const TAIL: Record<Hop, string> = { idle: "none", squash: "rotate(6deg)", jump: "rotate(-14deg)", land: "rotate(12deg)" };
// 먹는 순서 (합계 2.4s = CSS sq-cheek 길이): 물기 → 오물오물 ×8 → 꿀꺽 → 냠!
const EAT: [Eat, number][] = [
  ["grab", 220], ["chewA", 170], ["chewB", 170], ["chewA", 170], ["chewB", 170],
  ["chewA", 170], ["chewB", 170], ["chewA", 170], ["chewB", 170], ["gulp", 320], ["yum", 500],
];

// 머리와 몸이 이어진 한 덩어리 실루엣 (도형을 겹치지 않고 하나의 선으로)
const SILHOUETTE =
  "M58 15 C83 15 101 31 101 53 C101 69 93 79 83 84 C87 90 89 98 87 105 C85 112 75 114.5 58 114.5 C41 114.5 31 112 29 105 C27 98 29 90 33 84 C23 79 15 69 15 53 C15 31 33 15 58 15 Z";
const TAIL_BASE = "M68 106 C92 112 113 98 114 78 C115 64 109 54 101 45 C93 56 91 68 87 78 C83 88 77 95 68 99 Z";
const TAIL_TIP = "M99 68 C90 57 88 40 95 28 C100 18 112 13 117 20 C121 26 118 33 112 35 C117 44 116 57 110 68 Z";

/**
 * 도토리를 안은 다람쥐. 가만히 있어도 숨 쉬고, 꼬리를 흔들고, 귀를 쫑긋하고, 마우스를 바라본다.
 * 누르면 폴짝(꼬리는 한 박자 늦게), `eats`가 늘면 도토리를 먹으며 양볼이 젤리처럼 빵빵해졌다 꺼진다.
 * `wear`로 꾸미기 아이템을 씌운다 (마이페이지).
 */
export function Squirrel({ size = 88, eats = 0, wear }: { size?: number; eats?: number; wear?: Wear }) {
  const uid = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const [hop, setHop] = useState<Hop>("idle");
  const [eat, setEat] = useState<Eat>("none");
  const [run, setRun] = useState(0);
  const [bite, setBite] = useState(0);
  const [nutBack, setNutBack] = useState(true);
  const busy = useRef(false);
  const seen = useRef(eats);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // 마우스 쪽을 바라봄 (눈동자·얼굴이 살짝 따라옴). 다시 그리지 않고 CSS 변수만 바꿈
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.45;
        const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2)));
        const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2)));
        el.style.setProperty("--lx", nx.toFixed(3));
        el.style.setProperty("--ly", ny.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    if (eats <= seen.current) {
      seen.current = eats;
      return;
    }
    seen.current = eats;
    busy.current = true;
    let t = 0;
    let b = 0;
    later(() => setRun((r) => r + 1), 0);
    EAT.forEach(([phase, dur]) => {
      later(() => {
        if (phase === "chewA") b += 1;
        setHop("idle");
        setEat(phase);
        setBite(Math.min(b, 4));
        setNutBack(false);
      }, t);
      t += dur;
    });
    later(() => {
      setEat("none");
      setBite(0);
    }, t);
    later(() => {
      setNutBack(true);
      busy.current = false;
    }, t + 280);
  }, [eats]);

  const poke = () => {
    if (busy.current) return;
    busy.current = true;
    setHop("squash");
    later(() => setHop("jump"), 130);
    later(() => setHop("land"), 390);
    later(() => {
      setHop("idle");
      busy.current = false;
    }, 620);
  };

  const eating = eat !== "none";
  const chewing = eat === "chewA" || eat === "chewB";
  const up = hop === "jump";
  const scale = [1, 0.8, 0.6, 0.42, 0.26][bite] ?? 0.26;
  let nut: React.CSSProperties;
  if (eat === "grab" || chewing) {
    const wob = eat === "chewA" ? -7 : 7;
    nut = { opacity: 1, transform: `translate3d(0,-9px,0) rotate(${eat === "grab" ? 0 : wob}deg) scale(${eat === "grab" ? 1 : scale})` };
  } else if (eat === "gulp" || eat === "yum" || !nutBack) {
    nut = { opacity: 0, transform: "translate3d(0,-10px,0) scale(.1)" };
  } else if (up) {
    nut = { opacity: 1, transform: "translate3d(0,-3px,0) rotate(-10deg)" };
  } else {
    nut = { opacity: 1, transform: "none" };
  }
  const paws = eat === "grab" || chewing ? "translate3d(0,-7px,0)" : "none";

  let mouth = "M53.5 69 q2.25 2 4.5 0 q2.25 2 4.5 0";
  let mouthFill = "none";
  if (eat === "grab") mouth = "M55.5 69.5 q2.5 1.4 5 0";
  if (eat === "chewA") {
    mouth = "M56 69.5 q2 1.6 4 0 q-2 -.9 -4 0 z";
    mouthFill = "#A9524A";
  }
  if (eat === "chewB") mouth = "M56 69.8 q2 .7 4 0";
  if (eat === "gulp") mouth = "M56.5 69.8 q1.5 .8 3 0";
  if (eat === "yum" || up) {
    mouth = "M53 68.5 Q58 75.5 63 68.5 Z";
    mouthFill = "#A9524A";
  }
  const happy = up || eat === "gulp" || eat === "yum";
  const off = bite * 1.6;
  const id = (n: string) => `${n}-${uid}`;
  const url = (n: string) => `url(#${id(n)})`;
  const look: React.CSSProperties = {
    transformBox: "view-box",
    transformOrigin: "58px 60px",
    transition: "transform .5s cubic-bezier(.22,1,.36,1)",
    transform: "translate3d(calc(var(--lx, 0) * 2.2px), calc(var(--ly, 0) * 1.6px), 0) rotate(calc(var(--lx, 0) * 3deg))",
  };
  const pupil: React.CSSProperties = {
    transition: "transform .35s cubic-bezier(.22,1,.36,1)",
    transform: "translate3d(calc(var(--lx, 0) * 1.4px), calc(var(--ly, 0) * 1.2px), 0)",
  };

  return (
    <button
      type="button"
      onClick={poke}
      aria-label="다람쥐 누르기"
      className="inline-block shrink-0 cursor-pointer border-0 bg-transparent p-0"
      style={{ width: size, height: size, WebkitTapHighlightColor: "transparent" }}
    >
      <svg ref={svg} viewBox="0 0 120 120" width="100%" height="100%" style={{ overflow: "visible" }} aria-hidden="true" className={eating ? "sq-eating" : undefined}>
        <defs>
          {/* 털: 위·왼쪽에서 빛이 오는 하나의 입체 */}
          <radialGradient id={id("fur")} cx="0.36" cy="0.26" r="0.86"><stop offset="0" stopColor="#FFD9AC" /><stop offset="0.45" stopColor="#EFAA66" /><stop offset="0.85" stopColor="#D88744" /><stop offset="1" stopColor="#C2733A" /></radialGradient>
          <linearGradient id={id("tail")} x1="0.1" y1="1" x2="0.9" y2="0"><stop offset="0" stopColor="#C46F33" /><stop offset="0.55" stopColor="#E99E57" /><stop offset="1" stopColor="#F9C88F" /></linearGradient>
          <radialGradient id={id("face")} cx="0.5" cy="0.42" r="0.6"><stop offset="0" stopColor="#FFF6EA" /><stop offset="0.6" stopColor="#FFE8CF" stopOpacity=".95" /><stop offset="1" stopColor="#FFE2C2" stopOpacity="0" /></radialGradient>
          <radialGradient id={id("belly")} cx="0.5" cy="0.4" r="0.6"><stop offset="0" stopColor="#FFF3E2" /><stop offset="1" stopColor="#FFE6CA" stopOpacity="0" /></radialGradient>
          {/* 머리 아래 그늘: 머리와 몸이 이어져 보이게 */}
          <radialGradient id={id("neck")} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#8A4E22" stopOpacity=".28" /><stop offset="1" stopColor="#8A4E22" stopOpacity="0" /></radialGradient>
          <radialGradient id={id("ear")} cx="0.5" cy="0.6" r="0.6"><stop offset="0" stopColor="#F9B7AE" /><stop offset="1" stopColor="#E59186" /></radialGradient>
          <radialGradient id={id("cheek")} cx="0.42" cy="0.36" r="0.68"><stop offset="0" stopColor="#FFF4E6" /><stop offset="0.65" stopColor="#FFE3C6" /><stop offset="1" stopColor="#F2C190" stopOpacity=".9" /></radialGradient>
          <radialGradient id={id("blush")} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FF8E86" stopOpacity=".7" /><stop offset="1" stopColor="#FF8E86" stopOpacity="0" /></radialGradient>
          <radialGradient id={id("eye")} cx="0.42" cy="0.36" r="0.7"><stop offset="0" stopColor="#4B3427" /><stop offset="1" stopColor="#120B07" /></radialGradient>
          <radialGradient id={id("nut")} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#E3A465" /><stop offset="1" stopColor="#A5612B" /></radialGradient>
          <radialGradient id={id("cap")} cx="0.4" cy="0.3" r="0.8"><stop offset="0" stopColor="#8F5C33" /><stop offset="1" stopColor="#523015" /></radialGradient>
          <radialGradient id={id("shade")} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#3A2614" stopOpacity=".16" /><stop offset="1" stopColor="#3A2614" stopOpacity="0" /></radialGradient>
        </defs>

        <ellipse cx="60" cy="115" rx={up ? 20 : 32} ry="4.5" fill={url("shade")} style={{ transition: `rx .3s ${JELLY}` }} />

        <g style={BODY[hop]}>
          {/* 꼬리: 몸에 붙은 밑동 + 끝이 한 박자 늦게 흔들림 */}
          <g style={{ transformBox: "view-box", transformOrigin: "72px 104px", transition: `transform .5s ${JELLY} .06s`, transform: TAIL[hop] }}>
            <g className="sq-tail-sway">
              <path d={TAIL_BASE} fill={url("tail")} />
              <g className="sq-tail-tip">
                <path d={TAIL_TIP} fill={url("tail")} />
                <path d="M106 20 C111 18 114 21 113 25" fill="none" stroke="#FFE3C0" strokeWidth="2" strokeLinecap="round" opacity=".8" />
              </g>
              <path d="M96 84 C101 76 103 66 101 58" fill="none" stroke="#FBD3A4" strokeWidth="2.4" strokeLinecap="round" opacity=".55" />
            </g>
          </g>

          <g className="sq-breathe">
            {/* 귀 (머리 뒤, 따로 쫑긋) */}
            <g className="sq-ear-l">
              <path d="M22 36 C17 25 20 11 29 7 C35 12 40 22 40 31 Z" fill="#E39A57" />
              <path d="M26 30 C24 23 26 15 30 12 C33 17 35 23 35 28 Z" fill={url("ear")} />
              <path d="M28 8 C27 4 30 1 32 2" fill="none" stroke="#C97C3E" strokeWidth="1.6" strokeLinecap="round" />
            </g>
            <g className="sq-ear-r">
              <path d="M94 36 C99 25 96 11 87 7 C81 12 76 22 76 31 Z" fill="#E39A57" />
              <path d="M90 30 C92 23 90 15 86 12 C83 17 81 23 81 28 Z" fill={url("ear")} />
              <path d="M88 8 C89 4 86 1 84 2" fill="none" stroke="#C97C3E" strokeWidth="1.6" strokeLinecap="round" />
            </g>

            {/* 몸 + 머리 한 덩어리 */}
            <path d={SILHOUETTE} fill={url("fur")} />
            <ellipse cx="58" cy="86" rx="22" ry="6" fill={url("neck")} />
            <ellipse cx="58" cy="101" rx="17" ry="12" fill={url("belly")} />
            <path d="M52 17 Q58 15 64 17 L62 31 Q58 33 54 31 Z" fill="#C2733A" opacity=".28" />
            <ellipse cx="40" cy="30" rx="12" ry="5.5" fill="#FFFFFF" opacity=".22" transform="rotate(-24 40 30)" />
            {/* 뒷발 (몸에 붙어 살짝 보임) */}
            <path d="M38 110 C38 106 50 106 52 110 C52 114 38 114 38 110 Z" fill="#E59E5C" />
            <path d="M64 110 C66 106 78 106 78 110 C78 114 64 114 64 110 Z" fill="#E59E5C" />

            {/* 얼굴 (마우스를 바라봄) */}
            <g style={look}>
              <g key={run} className="sq-chew">
                <ellipse cx="58" cy="65" rx="31" ry="18" fill={url("face")} />

                <g className="sq-cheek">
                  <ellipse cx="35" cy="66" rx="10.5" ry="8.5" fill={url("cheek")} />
                  <ellipse cx="35" cy="67" rx="8" ry="5" fill={url("blush")} opacity={happy ? 1 : 0.75} />
                  <ellipse className="sq-cheek-shine" cx="32" cy="62.5" rx="3.6" ry="2" fill="#FFFFFF" opacity="0" transform="rotate(-20 32 62.5)" />
                </g>
                <g className="sq-cheek">
                  <ellipse cx="81" cy="66" rx="10.5" ry="8.5" fill={url("cheek")} />
                  <ellipse cx="81" cy="67" rx="8" ry="5" fill={url("blush")} opacity={happy ? 1 : 0.75} />
                  <ellipse className="sq-cheek-shine" cx="78" cy="62.5" rx="3.6" ry="2" fill="#FFFFFF" opacity="0" transform="rotate(-20 78 62.5)" />
                </g>

                <g opacity={happy ? 0 : 1} style={{ transition: "opacity .12s" }}>
                  <ellipse cx="43" cy="53" rx="6" ry="7.2" fill={url("eye")}>
                    <animate attributeName="ry" values="7.2;7.2;0.7;7.2;7.2;0.7;7.2" keyTimes="0;0.6;0.62;0.64;0.9;0.92;1" dur="6.3s" repeatCount="indefinite" />
                  </ellipse>
                  <ellipse cx="73" cy="53" rx="6" ry="7.2" fill={url("eye")}>
                    <animate attributeName="ry" values="7.2;7.2;0.7;7.2;7.2;0.7;7.2" keyTimes="0;0.6;0.62;0.64;0.9;0.92;1" dur="6.3s" repeatCount="indefinite" />
                  </ellipse>
                  <g style={pupil}>
                    <circle cx="45.2" cy="50.2" r="2.3" fill="#FFFFFF" />
                    <circle cx="75.2" cy="50.2" r="2.3" fill="#FFFFFF" />
                    <circle cx="41.6" cy="56" r="1" fill="#FFFFFF" opacity=".8" />
                    <circle cx="71.6" cy="56" r="1" fill="#FFFFFF" opacity=".8" />
                  </g>
                </g>
                <g opacity={happy ? 1 : 0} fill="none" stroke="#1E140D" strokeWidth="2.4" strokeLinecap="round" style={{ transition: "opacity .12s" }}>
                  <path d="M38 54 Q43 48.5 48 54" />
                  <path d="M68 54 Q73 48.5 78 54" />
                </g>
                {/* 수염 */}
                <g stroke="#B97A4A" strokeWidth=".8" strokeLinecap="round" opacity=".55" fill="none">
                  <path d="M47 66 Q40 64 33 65" />
                  <path d="M47 68 Q40 68.5 34 70.5" />
                  <path d="M69 66 Q76 64 83 65" />
                  <path d="M69 68 Q76 68.5 82 70.5" />
                </g>
                <ellipse className="sq-nose" cx="58" cy="64.2" rx="2.7" ry="1.9" fill="#5A3218" />
                <path d={mouth} fill={mouthFill} stroke="#5A3218" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />

                {wear?.face === "glasses" && (
                  <g fill="#FFFFFF" fillOpacity=".16" stroke="#1E140D" strokeWidth="2">
                    <circle cx="43" cy="53" r="10" />
                    <circle cx="73" cy="53" r="10" />
                    <path d="M53 52 Q58 48.5 63 52" fill="none" />
                    <path d="M33 51 L20 46 M83 51 L96 46" fill="none" strokeLinecap="round" />
                  </g>
                )}
              </g>
            </g>

            {/* 꾸미기: 머리 위 */}
            {wear?.ear === "ribbon" && (
              <g transform="translate(91 14) rotate(18)">
                <path d="M0 0 L-10 -7 Q-12 0 -10 7 Z" fill="#F39AAA" stroke="#D0687F" strokeWidth="1.1" strokeLinejoin="round" />
                <path d="M0 0 L10 -7 Q12 0 10 7 Z" fill="#F39AAA" stroke="#D0687F" strokeWidth="1.1" strokeLinejoin="round" />
                <circle r="3" fill="#DE6F88" />
              </g>
            )}
            {wear?.head === "cap" && (
              <g>
                <path d="M58 11 v-6" stroke="#523015" strokeWidth="3" strokeLinecap="round" />
                <path d="M37 27 Q37 9 58 9 Q79 9 79 27 Q79 31 58 31 Q37 31 37 27 Z" fill={url("cap")} />
                <path d="M41 21 Q58 16 75 21 M39.5 26 Q58 21 76.5 26" fill="none" stroke="#3E2410" strokeWidth="1.1" opacity=".5" />
              </g>
            )}
            {wear?.head === "crown" && (
              <g>
                <path d="M40 27 L42 7 L51 17 L58 2 L65 17 L74 7 L76 27 Z" fill="#F4C860" stroke="#B98A2A" strokeWidth="1.4" strokeLinejoin="round" />
                <circle cx="58" cy="20" r="2.6" fill="#F08A84" />
                <circle cx="48" cy="22" r="1.8" fill="#7FA9DB" />
                <circle cx="68" cy="22" r="1.8" fill="#7FA9DB" />
              </g>
            )}

            {/* 도토리 + 앞발 */}
            <g style={{ transformBox: "view-box", transformOrigin: "58px 92px", transition: "transform .2s ease-out, opacity .25s", ...nut }}>
              <path d="M58 84 v-3" stroke="#523015" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M49.5 88.5 Q49.5 82 58 82 Q66.5 82 66.5 88.5 Q66.5 90.5 58 90.5 Q49.5 90.5 49.5 88.5 Z" fill={url("cap")} />
              <path d="M51 89.5 Q51 100.5 58 101.5 Q65 100.5 65 89.5 Z" fill={url("nut")} />
              <ellipse cx="54.8" cy="93" rx="1.4" ry="2.8" fill="#FFFFFF" opacity=".35" />
            </g>
            <g style={{ transformBox: "view-box", transformOrigin: "58px 93px", transition: `transform .24s ${JELLY}`, transform: paws }}>
              <path d="M43 94 C42 89 47 86 51 88 C54 90 53 96 49 97 C46 98 43.5 96.5 43 94 Z" fill="#F0A865" />
              <path d="M73 94 C74 89 69 86 65 88 C62 90 63 96 67 97 C70 98 72.5 96.5 73 94 Z" fill="#F0A865" />
              <path d="M46 92 l1.4 .4 M48 91 l1 .8" stroke="#C47A3E" strokeWidth=".8" strokeLinecap="round" opacity=".6" />
              <path d="M70 92 l-1.4 .4 M68 91 l-1 .8" stroke="#C47A3E" strokeWidth=".8" strokeLinecap="round" opacity=".6" />
            </g>

            <g opacity={eat === "chewB" || eat === "gulp" ? 1 : 0} fill="#B47A43" style={{ transition: "opacity .1s" }}>
              <circle cx={48 - off} cy={80 + off} r="1.4" />
              <circle cx={68 + off} cy={79 + off} r="1.1" />
              <circle cx={54} cy={86 + off} r="1.2" />
            </g>
          </g>

          <g opacity={up || eat === "yum" ? 1 : 0} style={{ transition: "opacity .2s" }}>
            <path d="M100 8 c-3-5-10-2-7 4 l7 6 l7-6 c3-6-4-9-7-4z" fill="#F08A84" />
            <path d="M12 22 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z" fill="#F4C860" />
          </g>
        </g>
      </svg>
    </button>
  );
}
