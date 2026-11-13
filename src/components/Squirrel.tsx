"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Wear } from "@/lib/growth";

type Hop = "idle" | "squash" | "jump" | "land";
type Eat = "none" | "grab" | "chewA" | "chewB" | "gulp" | "yum";

const T: React.CSSProperties = { transformBox: "view-box", transformOrigin: "58px 110px" };
const BODY: Record<string, React.CSSProperties> = {
  idle: { ...T, transition: "transform .3s cubic-bezier(.3,1.6,.5,1)", transform: "none" },
  squash: { ...T, transition: "transform .12s ease-in", transform: "scale(1.12, .86)" },
  jump: { ...T, transition: "transform .22s cubic-bezier(.2,.8,.3,1)", transform: "translateY(-18px) scale(.94, 1.08) rotate(-5deg)" },
  land: { ...T, transition: "transform .16s ease-in", transform: "scale(1.07, .93)" },
  chewA: { ...T, transition: "transform .14s ease-out", transform: "scale(1.02, .98)" },
  chewB: { ...T, transition: "transform .14s ease-out", transform: "scale(.99, 1.01) translateY(-1px)" },
};
// 먹는 순서: 들어 올리기 → 오물오물 → 꿀꺽 → 냠!
const EAT: [Eat, number][] = [
  ["grab", 280], ["chewA", 170], ["chewB", 170], ["chewA", 170], ["chewB", 170],
  ["chewA", 170], ["chewB", 170], ["chewA", 170], ["chewB", 170], ["gulp", 320], ["yum", 650],
];

/**
 * 도토리를 안은 다람쥐 (와이어프레임 Squirrel).
 * 누르면 폴짝, `eats` 값이 늘어나면 도토리를 냠냠 먹는다. `wear`로 꾸미기 아이템을 씌운다 (마이페이지).
 */
export function Squirrel({ size = 88, eats = 0, wear }: { size?: number; eats?: number; wear?: Wear }) {
  const uid = useId().replace(/:/g, "");
  const [hop, setHop] = useState<Hop>("idle");
  const [eat, setEat] = useState<Eat>("none");
  const [bite, setBite] = useState(0);
  const [nutBack, setNutBack] = useState(true);
  const busy = useRef(false);
  const seen = useRef(eats);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

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
    }, t + 260);
  }, [eats]);

  const poke = () => {
    if (busy.current) return;
    busy.current = true;
    setHop("squash");
    later(() => setHop("jump"), 120);
    later(() => setHop("land"), 380);
    later(() => {
      setHop("idle");
      busy.current = false;
    }, 560);
  };

  const chewing = eat === "chewA" || eat === "chewB";
  const up = hop === "jump";
  let body = BODY[hop];
  if (chewing && hop === "idle") body = BODY[eat];
  const scale = [1, 0.82, 0.64, 0.46, 0.28][bite] ?? 0.28;
  let nut: React.CSSProperties;
  if (eat === "grab" || chewing) {
    const wob = eat === "chewA" ? -8 : 8;
    nut = { opacity: 1, transform: `translateY(-11px) rotate(${eat === "grab" ? 0 : wob}deg) scale(${eat === "grab" ? 1 : scale})` };
  } else if (eat === "gulp" || eat === "yum" || !nutBack) {
    nut = { opacity: 0, transform: "translateY(-11px) scale(.1)" };
  } else if (up) {
    nut = { opacity: 1, transform: "translateY(-4px) rotate(-12deg)" };
  } else {
    nut = { opacity: 1, transform: "none" };
  }
  const paws = eat === "grab" || chewing ? "translateY(-9px)" : "none";
  const puff = eat === "gulp" ? 1.32 : eat === "chewA" ? 1.22 : eat === "chewB" ? 1.12 : eat === "yum" ? 1.06 : 1;
  const cheek = (x: number): React.CSSProperties => ({
    transformBox: "view-box",
    transformOrigin: `${x}px 77px`,
    transition: "transform .14s ease-out",
    transform: `scale(${puff})`,
  });
  let mouth = "M52 72 q2 2.4 4 0 q2 2.4 4 0";
  let mouthFill = "none";
  if (eat === "chewA") {
    mouth = "M53.5 73 q2.5 2.2 5 0 q-2.5 -1 -5 0 z";
    mouthFill = "#C7655A";
  }
  if (eat === "chewB") mouth = "M53 73 q3 1.2 6 0";
  if (eat === "gulp") mouth = "M54 73 q2 1 4 0";
  if (eat === "yum" || up) {
    mouth = "M51 72.5 Q56 79 61 72.5 Z";
    mouthFill = "#C7655A";
  }
  const happy = up || chewing || eat === "gulp" || eat === "yum";
  const off = bite * 2;
  const id = (n: string) => `${n}-${uid}`;
  const url = (n: string) => `url(#${id(n)})`;

  return (
    <button
      type="button"
      onClick={poke}
      aria-label="다람쥐 누르기"
      className="inline-block shrink-0 cursor-pointer border-0 bg-transparent p-0"
      style={{ width: size, height: size, WebkitTapHighlightColor: "transparent" }}
    >
      <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ overflow: "visible" }} aria-hidden="true">
        <defs>
          <radialGradient id={id("fur")} cx="0.36" cy="0.28" r="0.85"><stop offset="0" stopColor="#FFE0B8" /><stop offset="0.5" stopColor="#F5B26E" /><stop offset="1" stopColor="#D5823E" /></radialGradient>
          <radialGradient id={id("tail")} cx="0.3" cy="0.25" r="0.9"><stop offset="0" stopColor="#FFD7A6" /><stop offset="0.55" stopColor="#EDA35C" /><stop offset="1" stopColor="#C47132" /></radialGradient>
          <radialGradient id={id("muzzle")} cx="0.5" cy="0.45" r="0.55"><stop offset="0" stopColor="#FFF8EE" /><stop offset="0.55" stopColor="#FFEBD3" /><stop offset="1" stopColor="#FFE3C4" stopOpacity="0" /></radialGradient>
          <radialGradient id={id("belly")} cx="0.5" cy="0.4" r="0.6"><stop offset="0" stopColor="#FFF4E4" /><stop offset="1" stopColor="#FFE3C4" stopOpacity="0" /></radialGradient>
          <radialGradient id={id("ear")} cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#FFC6C0" /><stop offset="1" stopColor="#F29C95" /></radialGradient>
          <radialGradient id={id("nut")} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#E7A86A" /><stop offset="1" stopColor="#A9632C" /></radialGradient>
          <radialGradient id={id("cap")} cx="0.4" cy="0.3" r="0.8"><stop offset="0" stopColor="#9A6438" /><stop offset="1" stopColor="#5A3418" /></radialGradient>
        </defs>
        <ellipse cx="58" cy="112" rx={up ? 20 : 30} ry="5" fill="#5A3418" opacity=".14" />
        <g style={body}>
          <g style={{ transformBox: "view-box", transformOrigin: "78px 98px", transition: "transform .25s", transform: `rotate(${up || eat === "yum" ? 16 : chewing ? 5 : 0}deg)` }}>
            <g>
              <animateTransform attributeName="transform" type="rotate" values="-3 80 98;3 80 98;-3 80 98" dur="3.2s" repeatCount="indefinite" />
              {/* 다람쥐 꼬리: 등 뒤에서 머리 위까지 크게 S자로 올라가 끝이 바깥으로 말림 */}
              <path d="M70 101 C93 107 115 97 116 78 C117 63 109 54 107 44 C105 35 108 26 115 22 C121 19 122 10 115 6 C106 2 90 5 84 16 C78 27 80 39 85 51 C90 63 90 74 84 83 C79 90 74 93 68 95 Z" fill={url("tail")} stroke="#B66A2E" strokeOpacity=".4" strokeWidth="1.4" />
            </g>
          </g>
          <ellipse cx="56" cy="95" rx="25" ry="17" fill={url("fur")} stroke="#B66A2E" strokeOpacity=".4" strokeWidth="1.4" />
          <ellipse cx="56" cy="98" rx="17" ry="12" fill={url("belly")} />
          <ellipse cx="45" cy="109" rx="7" ry="4" fill="#F0A865" stroke="#B66A2E" strokeOpacity=".4" strokeWidth="1.2" />
          <ellipse cx="67" cy="109" rx="7" ry="4" fill="#F0A865" stroke="#B66A2E" strokeOpacity=".4" strokeWidth="1.2" />
          <circle cx="31" cy="33" r="9.5" fill={url("fur")} stroke="#B66A2E" strokeOpacity=".4" strokeWidth="1.4" />
          <circle cx="31.5" cy="34" r="5" fill={url("ear")} />
          <circle cx="81" cy="33" r="9.5" fill={url("fur")} stroke="#B66A2E" strokeOpacity=".4" strokeWidth="1.4" />
          <circle cx="80.5" cy="34" r="5" fill={url("ear")} />
          <ellipse cx="56" cy="62" rx="38" ry="32" fill={url("fur")} stroke="#B66A2E" strokeOpacity=".4" strokeWidth="1.4" />
          <path d="M50 32 Q56 28 62 32 L60 46 Q56 48 52 46 Z" fill="#C97A3A" opacity=".4" />
          <ellipse cx="38" cy="42" rx="11" ry="6" fill="#FFFFFF" opacity=".35" transform="rotate(-28 38 42)" />
          <ellipse cx="56" cy="77" rx="33" ry="19" fill={url("muzzle")} />
          <g style={cheek(38)}><ellipse cx="38" cy="77" rx="10" ry="8" fill="#FFE6CB" opacity=".9" /><ellipse cx="36" cy="75" rx="6.5" ry="3.6" fill="#FF8F8F" opacity={happy ? 0.85 : 0.5} /></g>
          <g style={cheek(74)}><ellipse cx="74" cy="77" rx="10" ry="8" fill="#FFE6CB" opacity=".9" /><ellipse cx="76" cy="75" rx="6.5" ry="3.6" fill="#FF8F8F" opacity={happy ? 0.85 : 0.5} /></g>
          <g opacity={happy ? 0 : 1}>
            <ellipse cx="43" cy="63" rx="3.6" ry="4.6" fill="#2A1E16"><animate attributeName="ry" values="4.6;4.6;0.6;4.6" keyTimes="0;0.92;0.96;1" dur="4.5s" repeatCount="indefinite" /></ellipse>
            <ellipse cx="69" cy="63" rx="3.6" ry="4.6" fill="#2A1E16"><animate attributeName="ry" values="4.6;4.6;0.6;4.6" keyTimes="0;0.92;0.96;1" dur="4.5s" repeatCount="indefinite" /></ellipse>
            <circle cx="44.4" cy="61.2" r="1.3" fill="#FFFFFF" />
            <circle cx="70.4" cy="61.2" r="1.3" fill="#FFFFFF" />
          </g>
          <g opacity={happy ? 1 : 0} fill="none" stroke="#2A1E16" strokeWidth="2.2" strokeLinecap="round">
            <path d="M39 64 Q43 59 47 64" />
            <path d="M65 64 Q69 59 73 64" />
          </g>
          <ellipse cx="56" cy="69" rx="2.2" ry="1.5" fill="#6B3E1D" />
          <path d={mouth} fill={mouthFill} stroke="#6B3E1D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <g style={{ transformBox: "view-box", transformOrigin: "56px 90px", transition: "transform .16s ease-out, opacity .25s", ...nut }}>
            <path d="M56 82 v-3" stroke="#5A3418" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M47 87 Q47 80 56 80 Q65 80 65 87 Q65 89 56 89 Q47 89 47 87 Z" fill={url("cap")} />
            <path d="M48.5 88 Q48.5 100 56 101 Q63.5 100 63.5 88 Z" fill={url("nut")} />
            <ellipse cx="52.5" cy="92" rx="1.5" ry="3" fill="#FFFFFF" opacity=".35" />
          </g>
          <g style={{ transformBox: "view-box", transformOrigin: "56px 91px", transition: "transform .2s ease-out", transform: paws }}>
            <ellipse cx="45" cy="91" rx="5.5" ry="4.5" fill="#F6B36F" stroke="#B66A2E" strokeOpacity=".4" strokeWidth="1.2" />
            <ellipse cx="67" cy="91" rx="5.5" ry="4.5" fill="#F6B36F" stroke="#B66A2E" strokeOpacity=".4" strokeWidth="1.2" />
          </g>
          <g opacity={eat === "chewB" || eat === "gulp" ? 1 : 0} fill="#C27C3E">
            <circle cx={47 - off} cy={84 + off} r="1.6" />
            <circle cx={64 + off} cy={83 + off} r="1.2" />
            <circle cx={52} cy={90 + off} r="1.4" />
          </g>
          {/* 꾸미기 아이템 (몸과 같이 폴짝) */}
          {wear?.face === "glasses" && (
            <g fill="#FFFFFF" fillOpacity=".18" stroke="#3A2A1C" strokeWidth="2.2">
              <circle cx="43" cy="63" r="8.5" />
              <circle cx="69" cy="63" r="8.5" />
              <path d="M51.5 62 Q56 58.5 60.5 62" fill="none" />
              <path d="M34.5 61 L25 57 M77.5 61 L87 57" fill="none" strokeLinecap="round" />
            </g>
          )}
          {wear?.ear === "ribbon" && (
            <g transform="translate(86 24) rotate(18)">
              <path d="M0 0 L-10 -7 Q-12 0 -10 7 Z" fill="#FF8FA3" stroke="#D9607A" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M0 0 L10 -7 Q12 0 10 7 Z" fill="#FF8FA3" stroke="#D9607A" strokeWidth="1.2" strokeLinejoin="round" />
              <circle r="3" fill="#E86A86" />
            </g>
          )}
          {wear?.head === "cap" && (
            <g>
              <path d="M56 19 v-6" stroke="#5A3418" strokeWidth="3" strokeLinecap="round" />
              <path d="M36 36 Q36 18 56 18 Q76 18 76 36 Q76 40 56 40 Q36 40 36 36 Z" fill={url("cap")} />
              <path d="M40 30 Q56 25 72 30 M38.5 35 Q56 30 73.5 35" fill="none" stroke="#3E2410" strokeWidth="1.2" opacity=".5" />
            </g>
          )}
          {wear?.head === "crown" && (
            <g>
              <path d="M38 37 L40 17 L49 27 L56 12 L63 27 L72 17 L74 37 Z" fill="#FFD36B" stroke="#C9962E" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="56" cy="30" r="2.6" fill="#FF8F8F" />
              <circle cx="46" cy="32" r="1.8" fill="#7FB3E8" />
              <circle cx="66" cy="32" r="1.8" fill="#7FB3E8" />
            </g>
          )}
          <g opacity={up || eat === "yum" ? 1 : 0}>
            <path d="M44 14 c-3-5-10-2-7 4 l7 6 l7-6 c3-6-4-9-7-4z" fill="#FF8F8F" />
            <path d="M18 30 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z" fill="#FFD36B" />
          </g>
        </g>
      </svg>
    </button>
  );
}
