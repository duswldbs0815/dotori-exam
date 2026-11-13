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

// 머리와 몸이 이어진 한 덩어리 (큰 머리 + 아래로 이어지는 몸, 마스코트 비율)
const SILHOUETTE =
  "M58 20 C83 20 100 35 100 57 C100 71 93 80 85 85 C89 91 90 99 88 104 C85 111 74 113 58 113 C42 113 31 111 28 104 C26 99 27 91 31 85 C23 80 16 71 16 57 C16 35 33 20 58 20 Z";
const TAIL_PATH = "M74 102 C100 106 116 82 110 58 C105 38 86 30 78 44 C90 46 96 60 91 74 C87 86 78 90 70 96 Z";
const LINE = "#B66A2E";

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

  let mouth = "M54 68 q2 2.4 4 0 q2 2.4 4 0";
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
          <radialGradient id={id("fur")} cx="0.36" cy="0.28" r="0.85"><stop offset="0" stopColor="#FFE0B8" /><stop offset="0.5" stopColor="#F5B26E" /><stop offset="1" stopColor="#D5823E" /></radialGradient>
          <radialGradient id={id("tail")} cx="0.3" cy="0.25" r="0.9"><stop offset="0" stopColor="#FFD7A6" /><stop offset="0.55" stopColor="#EDA35C" /><stop offset="1" stopColor="#C47132" /></radialGradient>
          <radialGradient id={id("muzzle")} cx="0.5" cy="0.45" r="0.55"><stop offset="0" stopColor="#FFF8EE" /><stop offset="0.55" stopColor="#FFEBD3" /><stop offset="1" stopColor="#FFE3C4" stopOpacity="0" /></radialGradient>
          <radialGradient id={id("belly")} cx="0.5" cy="0.4" r="0.6"><stop offset="0" stopColor="#FFF4E4" /><stop offset="1" stopColor="#FFE3C4" stopOpacity="0" /></radialGradient>
          <radialGradient id={id("ear")} cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#FFC6C0" /><stop offset="1" stopColor="#F29C95" /></radialGradient>
          <radialGradient id={id("eye")} cx="0.42" cy="0.36" r="0.7"><stop offset="0" stopColor="#4A3426" /><stop offset="1" stopColor="#1E140D" /></radialGradient>
          <radialGradient id={id("nut")} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#E7A86A" /><stop offset="1" stopColor="#A9632C" /></radialGradient>
          <radialGradient id={id("cap")} cx="0.4" cy="0.3" r="0.8"><stop offset="0" stopColor="#9A6438" /><stop offset="1" stopColor="#5A3418" /></radialGradient>
          <radialGradient id={id("shade")} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#3A2614" stopOpacity=".18" /><stop offset="1" stopColor="#3A2614" stopOpacity="0" /></radialGradient>
        </defs>

        <ellipse cx="58" cy="114" rx={up ? 20 : 32} ry="4.5" fill={url("shade")} style={{ transition: `rx .3s ${JELLY}` }} />

        <g style={BODY[hop]}>
          {/* 꼬리: 몸보다 한 박자 늦게 따라옴 */}
          <g style={{ transformBox: "view-box", transformOrigin: "74px 104px", transition: `transform .5s ${JELLY} .06s`, transform: TAIL[hop] }}>
            <g className="sq-tail-sway">
              <path d={TAIL_PATH} fill={url("tail")} stroke={LINE} strokeOpacity=".4" strokeWidth="1.4" />
              <path d="M86 40 C96 38 106 46 107 58" fill="none" stroke="#FFE7C8" strokeWidth="3" strokeLinecap="round" opacity=".7" />
            </g>
          </g>

          <g className="sq-breathe">
            {/* 동그란 귀 */}
            <g className="sq-ear-l">
              <circle cx="31" cy="31" r="9.5" fill={url("fur")} stroke={LINE} strokeOpacity=".4" strokeWidth="1.4" />
              <circle cx="31.5" cy="32" r="5" fill={url("ear")} />
            </g>
            <g className="sq-ear-r">
              <circle cx="85" cy="31" r="9.5" fill={url("fur")} stroke={LINE} strokeOpacity=".4" strokeWidth="1.4" />
              <circle cx="84.5" cy="32" r="5" fill={url("ear")} />
            </g>

            {/* 머리와 몸이 이어진 한 덩어리 */}
            <path d={SILHOUETTE} fill={url("fur")} stroke={LINE} strokeOpacity=".4" strokeWidth="1.4" />
            <ellipse cx="58" cy="101" rx="17" ry="11" fill={url("belly")} />
            <path d="M52 21.5 Q58 19.5 64 21.5 L62 35 Q58 37 54 35 Z" fill="#C97A3A" opacity=".4" />
            <ellipse cx="38" cy="37" rx="11" ry="6" fill="#FFFFFF" opacity=".35" transform="rotate(-28 38 37)" />

            {/* 얼굴 (마우스를 바라봄) */}
            <g style={look}>
              <g key={run} className="sq-chew">
                <ellipse cx="58" cy="70" rx="33" ry="18" fill={url("muzzle")} />

                <g className="sq-cheek">
                  <ellipse cx="38" cy="72" rx="10" ry="8" fill="#FFE6CB" opacity=".9" />
                  <ellipse cx="36" cy="71" rx="6.5" ry="3.6" fill="#FF8F8F" opacity={happy ? 0.85 : 0.5} />
                  <ellipse className="sq-cheek-shine" cx="35" cy="68" rx="3.4" ry="1.8" fill="#FFFFFF" opacity="0" transform="rotate(-20 35 68)" />
                </g>
                <g className="sq-cheek">
                  <ellipse cx="78" cy="72" rx="10" ry="8" fill="#FFE6CB" opacity=".9" />
                  <ellipse cx="80" cy="71" rx="6.5" ry="3.6" fill="#FF8F8F" opacity={happy ? 0.85 : 0.5} />
                  <ellipse className="sq-cheek-shine" cx="77" cy="68" rx="3.4" ry="1.8" fill="#FFFFFF" opacity="0" transform="rotate(-20 77 68)" />
                </g>

                <g opacity={happy ? 0 : 1} style={{ transition: "opacity .12s" }}>
                  <ellipse cx="45" cy="59" rx="3.8" ry="4.7" fill={url("eye")}>
                    <animate attributeName="ry" values="4.7;4.7;0.6;4.7;4.7;0.6;4.7" keyTimes="0;0.6;0.62;0.64;0.9;0.92;1" dur="6.3s" repeatCount="indefinite" />
                  </ellipse>
                  <ellipse cx="71" cy="59" rx="3.8" ry="4.7" fill={url("eye")}>
                    <animate attributeName="ry" values="4.7;4.7;0.6;4.7;4.7;0.6;4.7" keyTimes="0;0.6;0.62;0.64;0.9;0.92;1" dur="6.3s" repeatCount="indefinite" />
                  </ellipse>
                  <g style={pupil}>
                    <circle cx="46.4" cy="57.2" r="1.4" fill="#FFFFFF" />
                    <circle cx="72.4" cy="57.2" r="1.4" fill="#FFFFFF" />
                  </g>
                </g>
                <g opacity={happy ? 1 : 0} fill="none" stroke="#1E140D" strokeWidth="2.2" strokeLinecap="round" style={{ transition: "opacity .12s" }}>
                  <path d="M41 60 Q45 55 49 60" />
                  <path d="M67 60 Q71 55 75 60" />
                </g>
                <ellipse className="sq-nose" cx="58" cy="65" rx="2.2" ry="1.5" fill="#6B3E1D" />
                <path d={mouth} fill={mouthFill} stroke="#6B3E1D" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />

                {wear?.face === "glasses" && (
                  <g fill="#FFFFFF" fillOpacity=".16" stroke="#1E140D" strokeWidth="2">
                    <circle cx="45" cy="59" r="8.5" />
                    <circle cx="71" cy="59" r="8.5" />
                    <path d="M53.5 58 Q58 54.5 62.5 58" fill="none" />
                    <path d="M36.5 57 L27 53 M79.5 57 L89 53" fill="none" strokeLinecap="round" />
                  </g>
                )}
              </g>
            </g>

            {/* 꾸미기: 머리 위 */}
            {wear?.ear === "ribbon" && (
              <g transform="translate(90 22) rotate(18)">
                <path d="M0 0 L-10 -7 Q-12 0 -10 7 Z" fill="#F39AAA" stroke="#D0687F" strokeWidth="1.1" strokeLinejoin="round" />
                <path d="M0 0 L10 -7 Q12 0 10 7 Z" fill="#F39AAA" stroke="#D0687F" strokeWidth="1.1" strokeLinejoin="round" />
                <circle r="3" fill="#DE6F88" />
              </g>
            )}
            {wear?.head === "cap" && (
              <g transform="translate(0 6)">
                <path d="M58 11 v-6" stroke="#523015" strokeWidth="3" strokeLinecap="round" />
                <path d="M37 27 Q37 9 58 9 Q79 9 79 27 Q79 31 58 31 Q37 31 37 27 Z" fill={url("cap")} />
                <path d="M41 21 Q58 16 75 21 M39.5 26 Q58 21 76.5 26" fill="none" stroke="#3E2410" strokeWidth="1.1" opacity=".5" />
              </g>
            )}
            {wear?.head === "crown" && (
              <g transform="translate(0 6)">
                <path d="M40 27 L42 7 L51 17 L58 2 L65 17 L74 7 L76 27 Z" fill="#F4C860" stroke="#B98A2A" strokeWidth="1.4" strokeLinejoin="round" />
                <circle cx="58" cy="20" r="2.6" fill="#F08A84" />
                <circle cx="48" cy="22" r="1.8" fill="#7FA9DB" />
                <circle cx="68" cy="22" r="1.8" fill="#7FA9DB" />
              </g>
            )}

            {/* 발 */}
            <ellipse cx="46" cy="110" rx="7" ry="4" fill="#F0A865" stroke={LINE} strokeOpacity=".4" strokeWidth="1.2" />
            <ellipse cx="70" cy="110" rx="7" ry="4" fill="#F0A865" stroke={LINE} strokeOpacity=".4" strokeWidth="1.2" />

            {/* 도토리 + 앞발 */}
            <g style={{ transformBox: "view-box", transformOrigin: "58px 92px", transition: "transform .2s ease-out, opacity .25s", ...nut }}>
              <path d="M58 84 v-3" stroke="#5A3418" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M49 89 Q49 82 58 82 Q67 82 67 89 Q67 91 58 91 Q49 91 49 89 Z" fill={url("cap")} />
              <path d="M50.5 90 Q50.5 102 58 103 Q65.5 102 65.5 90 Z" fill={url("nut")} />
              <ellipse cx="54.5" cy="94" rx="1.5" ry="3" fill="#FFFFFF" opacity=".35" />
            </g>
            <g style={{ transformBox: "view-box", transformOrigin: "58px 93px", transition: `transform .24s ${JELLY}`, transform: paws }}>
              <ellipse cx="47" cy="93" rx="5.5" ry="4.5" fill="#F6B36F" stroke={LINE} strokeOpacity=".4" strokeWidth="1.2" />
              <ellipse cx="69" cy="93" rx="5.5" ry="4.5" fill="#F6B36F" stroke={LINE} strokeOpacity=".4" strokeWidth="1.2" />
            </g>

            <g opacity={eat === "chewB" || eat === "gulp" ? 1 : 0} fill="#C27C3E" style={{ transition: "opacity .1s" }}>
              <circle cx={49 - off} cy={84 + off} r="1.5" />
              <circle cx={67 + off} cy={83 + off} r="1.2" />
              <circle cx={54} cy={89 + off} r="1.3" />
            </g>
          </g>

          <g opacity={up || eat === "yum" ? 1 : 0} style={{ transition: "opacity .2s" }}>
            <path d="M100 14 c-3-5-10-2-7 4 l7 6 l7-6 c3-6-4-9-7-4z" fill="#F08A84" />
            <path d="M14 26 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z" fill="#F4C860" />
          </g>
        </g>
      </svg>
    </button>
  );
}
