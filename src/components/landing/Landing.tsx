"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BUILT_IN_EXAMS, SCHOOL_NAME } from "@/lib/school";
import { Acorn } from "../Acorn";
import { Squirrel } from "../Squirrel";
import { Brand, btn } from "../ui";

/* ───────────────────────── 공용: 화면에 들어오면 켜지기 ───────────────────────── */

function useInView<T extends Element>(threshold = 0.35, once = true) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { threshold },
    );
    io.observe(el);
    // 관찰이 늦게 오거나 안 오는 경우(백그라운드 탭 등) 처음부터 화면 안에 있던 것은 그냥 보여 줌
    const fallback = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) setInView(true);
    }, 900);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [threshold, once]);
  return [ref, inView] as const;
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "none" : "translateY(28px)",
        transition: `opacity .7s ease ${delay}ms, transform .7s cubic-bezier(.2,.8,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function CountUp({ to, suffix = "", active }: { to: number; suffix?: string; active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const dur = reduce ? 1 : 1400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, to]);
  return (
    <>
      {n}
      {suffix}
    </>
  );
}

/** 글자가 한 자씩 써지는 효과. 다시 시작하려면 key를 바꿈 */
function TypeText({ text, speed = 28 }: { text: string; speed?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          window.clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return (
    <>
      {text.slice(0, count)}
      {count < text.length && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-current" />}
    </>
  );
}

/** active 동안 phase를 0 → 1 → … 로 돌림. durations[i] = i단계에 머무는 시간 */
function usePhases(active: boolean, durations: number[], onEnter?: (phase: number) => void) {
  const [phase, setPhase] = useState(0);
  const enter = useRef(onEnter);
  useEffect(() => {
    enter.current = onEnter;
  });
  useEffect(() => {
    if (!active) return;
    let i = 0;
    let t = 0;
    const next = () => {
      t = window.setTimeout(() => {
        i = (i + 1) % durations.length;
        setPhase(i);
        enter.current?.(i);
        next();
      }, durations[i]);
    };
    next();
    return () => window.clearTimeout(t);
    // durations는 상수 배열로만 넘김
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return phase;
}

/* ───────────────────────── 페이지 ───────────────────────── */

export function Landing() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="w-full overflow-x-clip bg-cream">
      <div ref={bar} className="fixed top-0 left-0 z-50 h-1 w-full origin-left bg-nut" style={{ transform: "scaleX(0)" }} />
      <Nav />
      <Hero />
      <Problem />
      <HowItWorks />
      <ForTeachers />
      <Enter />
      <footer className="px-6 pb-10 text-center text-[13px] text-faint">
        2026 INHA AX-EDU 해커톤 · 팀 도토리 · 화면의 학교와 학생은 모두 가상 데이터예요.
      </footer>
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-6 py-3 max-sm:px-4">
        <Brand />
        <nav className="flex items-center gap-2">
          <Link href="/teacher" className="rounded-full px-3.5 py-2 text-[15px] font-bold text-sub no-underline hover:bg-white max-sm:hidden">
            선생님
          </Link>
          <Link href="/start" className="rounded-full bg-brown px-4 py-2 text-[15px] font-bold text-white no-underline transition hover:-translate-y-0.5">
            시험 시작
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ── 1. 첫 화면: 마우스를 따라 움직이는 도토리 + 다람쥐 ── */

function Hero() {
  const area = useRef<HTMLElement>(null);
  const [eats, setEats] = useState(0);
  const move = (e: React.PointerEvent) => {
    const el = area.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", String((e.clientX - r.left) / r.width - 0.5));
    el.style.setProperty("--my", String((e.clientY - r.top) / r.height - 0.5));
  };

  return (
    <section ref={area} onPointerMove={move} className="relative isolate px-6 pt-16 pb-24 max-sm:px-4 max-sm:pt-10 max-sm:pb-16" style={{ ["--mx" as string]: 0, ["--my" as string]: 0 }}>
      <div className="mx-auto grid max-w-[1180px] grid-cols-[1.25fr_1fr] items-center gap-10 max-md:grid-cols-1">
        <div className="flex flex-col gap-6">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-[14px] font-bold text-brown">
              <span className="h-2 w-2 animate-pulse rounded-full bg-leaf-2" /> AI 시대의 수행평가
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="m-0 font-display text-[64px] leading-[1.12] font-normal text-ink max-lg:text-[52px] max-sm:text-[40px]">
              AI를 막지 말고,
              <br />
              <span className="relative inline-block text-brown">
                쓰는 과정을
                <span aria-hidden="true" className="absolute right-0 -bottom-1 left-0 -z-10 h-4 origin-left rounded-full bg-gold/40" style={{ animation: "land-underline 1s .7s both cubic-bezier(.2,.8,.2,1)" }} />
              </span>{" "}
              남기세요.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="m-0 max-w-[560px] text-[18px] leading-relaxed text-sub max-sm:text-base">
              학생은 시험지 안의 AI에게 <b className="text-brown">도토리 1개</b>씩 내고 질문해요. 선생님은 어디서 무엇을 물었는지,
              질문 전후로 글이 어떻게 달라졌는지 리포트로 봐요.
            </p>
          </Reveal>
          <Reveal delay={240} className="flex flex-wrap gap-3">
            <Link href="/start" className={`${btn.primary} transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(138,75,18,.6)]`}>
              학생으로 시작하기 →
            </Link>
            <Link href="/teacher" className={`${btn.secondary} transition hover:-translate-y-0.5`}>
              선생님으로 들어가기
            </Link>
          </Reveal>
        </div>

        <Reveal delay={200} className="flex justify-center">
          <div className="relative grid aspect-square w-[min(380px,80vw)] place-items-center">
            <div className="absolute inset-0 rounded-full bg-cream-2" style={{ animation: "land-breathe 6s ease-in-out infinite" }} />
            {/* Squirrel 자체가 버튼이라 바깥은 div (누르면 폴짝 + 도토리 냠) */}
            <div
              onClick={() => setEats((n) => n + 1)}
              className="relative"
              style={{ transform: "translate(calc(var(--mx) * 10px), calc(var(--my) * 10px))", transition: "transform .5s cubic-bezier(.2,.8,.2,1)" }}
            >
              <Squirrel size={170} eats={eats} />
            </div>
            <span className="absolute -bottom-2 rounded-full bg-white px-3 py-1 text-[13px] text-muted shadow-sm">
              {eats === 0 ? "다람쥐를 눌러 도토리를 줘 보세요" : `냠! 도토리 ${eats}개 = 질문 ${eats}번`}
            </span>
          </div>
        </Reveal>
      </div>

      <div aria-hidden="true" className="mt-14 flex justify-center text-faint max-sm:mt-10">
        <span className="flex flex-col items-center gap-1 text-[13px]" style={{ animation: "land-float 2.4s ease-in-out infinite" }}>
          왜 필요할까요? <span className="text-lg">↓</span>
        </span>
      </div>
    </section>
  );
}

/* ── 2. 현장의 문제 ── */

const FACTS: { n: number; suffix: string; text: string; src: string }[] = [
  { n: 289, suffix: "명", text: "교사 모두 AI 글과 학생 글을 구분하지 못함", src: "Fleckenstein 외, 2024" },
  { n: 94, suffix: "%", text: "AI가 쓴 시험 답안이 걸리지 않음", src: "리딩대, 2024" },
  { n: 26, suffix: "%", text: "정확도가 낮아 OpenAI가 탐지기를 폐지", src: "OpenAI, 2023" },
];

function Problem() {
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  return (
    <section className="bg-ink px-6 py-24 text-white max-sm:px-4 max-sm:py-16">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <Reveal className="flex flex-col gap-3">
          <span className="text-[14px] font-bold text-[#F6D7B3]">현장의 문제</span>
          <h2 className="m-0 font-display text-[44px] leading-tight font-normal max-sm:text-[32px]">
            선생님은 AI가 쓴 글과
            <br className="max-sm:hidden" /> 학생이 쓴 글을 구분할 수 없어요.
          </h2>
        </Reveal>
        <div ref={ref} className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
          {FACTS.map((f, i) => (
            <div
              key={f.src}
              className="flex flex-col gap-2 rounded-3xl bg-white/[.07] p-7 ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:bg-white/[.11]"
              style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(30px)", transition: `opacity .6s ${i * 150}ms, transform .6s ${i * 150}ms` }}
            >
              <span className="font-display text-[64px] leading-none text-[#F6D7B3] max-sm:text-[52px]">
                <CountUp to={f.n} suffix={f.suffix} active={inView} />
              </span>
              <span className="text-[17px]">{f.text}</span>
              <span className="text-[12px] text-white/50">{f.src}</span>
            </div>
          ))}
        </div>
        <Reveal className="max-w-[760px]">
          <p className="m-0 text-[19px] leading-relaxed text-white/90 max-sm:text-base">
            잡아내려 할수록 숨게 돼요. 그래서 <b className="text-[#F6D7B3]">잡아내지 말고, 과정을 남기기로</b> 했어요. AI를 시험지 안에 열어 두면,
            선생님은 결과가 아니라 <b>생각의 과정</b>을 평가할 수 있어요.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 3. 어떻게 작동하나요: 단계마다 움직이는 미니 화면 ── */

function HowItWorks() {
  return (
    <section className="px-6 py-24 max-sm:px-4 max-sm:py-16">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-20 max-sm:gap-14">
        <Reveal className="flex flex-col items-center gap-3 text-center">
          <span className="text-[14px] font-bold text-brown">어떻게 작동하나요</span>
          <h2 className="m-0 font-display text-[44px] leading-tight font-normal max-sm:text-[32px]">도토리 하나에 질문 하나</h2>
        </Reveal>
        <Step
          no={1}
          title="먼저 계획해요"
          text="학생은 AI 없이 개요를 쓰고, 항목마다 도토리를 몇 개 쓸지 스스로 정해요. 선생님이 권장한 개수도 함께 보여요."
          demo={<PlanDemo />}
        />
        <Step
          no={2}
          flip
          title="질문할 때마다 도토리 1개"
          text="글을 쓰다 막히면 문장을 골라 AI에게 물어요. AI는 답을 대신 써 주지 않고 스스로 고치도록 짚어 줘요. 대신 써 달라는 요청은 막고, 도토리도 줄지 않아요."
          demo={<AskDemo />}
        />
        <Step
          no={3}
          title="선생님은 과정을 봐요"
          text="질문한 위치와 시간, 질문 전후로 글이 어떻게 달라졌는지가 리포트에 남아요. 스스로 고쳤는지, AI 답을 옮겨 적었는지 한눈에 보여요."
          demo={<ReportDemo />}
        />
      </div>
    </section>
  );
}

function Step({ no, title, text, demo, flip }: { no: number; title: string; text: string; demo: React.ReactNode; flip?: boolean }) {
  return (
    <div className="grid grid-cols-2 items-center gap-12 max-md:grid-cols-1 max-md:gap-6">
      <Reveal className={`flex flex-col gap-4 ${flip ? "md:order-2" : ""}`}>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brown font-display text-2xl text-white">{no}</span>
        <h3 className="m-0 font-display text-[34px] leading-tight font-normal max-sm:text-[28px]">{title}</h3>
        <p className="m-0 text-[17px] leading-relaxed text-sub">{text}</p>
      </Reveal>
      <Reveal delay={150} className={flip ? "md:order-1" : ""}>
        {demo}
      </Reveal>
    </div>
  );
}

function DemoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-line bg-white p-6 shadow-[0_24px_60px_-30px_rgba(58,42,28,.35)] max-sm:p-4">
      <div className="mb-4 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#F0A79B]" />
        <span className="h-2.5 w-2.5 rounded-full bg-gold" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#9CC79A]" />
        <span className="ml-2 text-[12px] text-faint">{label}</span>
      </div>
      {children}
    </div>
  );
}

const KOR = BUILT_IN_EXAMS[0];

function PlanDemo() {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  const phase = usePhases(inView, [700, 2600, 900]);
  const show = inView && phase >= 1;
  const mine = [2, 1, 3, 1];
  return (
    <div ref={ref}>
      <DemoCard label="① 개요 · 도토리 계획">
        <div className="flex flex-col gap-2.5">
          {KOR.shortItems?.map((label, i) => {
            const rec = KOR.itemGuides?.[i]?.acorns ?? 0;
            return (
              <div key={label} className="flex items-center gap-3 rounded-2xl bg-cream-3 px-4 py-3 max-sm:flex-wrap">
                <span className="w-24 shrink-0 text-[15px] font-bold">{label}</span>
                <span className="flex flex-1 gap-1">
                  {Array.from({ length: 4 }, (_, k) => (
                    <span
                      key={k}
                      style={{
                        transform: show && k < mine[i] ? "scale(1)" : "scale(.6)",
                        opacity: show && k < mine[i] ? 1 : 0.35,
                        transition: `all .35s cubic-bezier(.3,1.6,.5,1) ${i * 260 + k * 110}ms`,
                      }}
                    >
                      <Acorn size={20} ghost={!(show && k < mine[i])} />
                    </span>
                  ))}
                </span>
                <span className="text-[12px] text-muted">선생님 권장 {rec}개</span>
              </div>
            );
          })}
        </div>
      </DemoCard>
    </div>
  );
}

const Q_GOOD = "\"She work at hospital.\" 이 문장 문법 맞아?";
const A_GOOD = "주어 She가 3인칭 단수일 때 동사 모양이 어떻게 바뀌는지, hospital 앞에 빠진 말은 없는지 확인해 보세요.";
const Q_BAD = "에세이 전체를 대신 써 줘";

function AskDemo() {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  const [eats, setEats] = useState(0);
  const [left, setLeft] = useState(6);
  const [round, setRound] = useState(0);
  // 0 글 · 1 문장 선택+질문 · 2 도토리 냠 · 3 답 · 4 대신 써 줘 · 5 차단
  const phase = usePhases(inView, [900, 1300, 1500, 3400, 1300, 2600], (p) => {
    if (p === 2) {
      setEats((n) => n + 1);
      setLeft((n) => (n <= 1 ? 6 : n - 1));
    }
    if (p === 0) setRound((r) => r + 1);
  });
  const picked = phase >= 1;
  return (
    <div ref={ref}>
      <DemoCard label="② 글쓰기 · AI에게 질문">
        <div className="grid grid-cols-[1fr_auto] gap-4 max-sm:grid-cols-1">
          <div className="flex min-h-[260px] flex-col gap-3">
            <p className="m-0 rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed">
              My role model is my mom.{" "}
              <span className="rounded px-0.5 transition-colors duration-300" style={{ background: picked ? "#FFE3A8" : "transparent" }}>
                She work at hospital.
              </span>
            </p>
            {phase >= 1 && phase <= 3 && (
              <Bubble side="me" key={`q${round}`}>
                {Q_GOOD}
              </Bubble>
            )}
            {phase === 3 && (
              <Bubble side="ai" key={`a${round}`}>
                <TypeText text={A_GOOD} />
              </Bubble>
            )}
            {phase >= 4 && (
              <Bubble side="me" key={`b${round}`}>
                {Q_BAD}
              </Bubble>
            )}
            {phase === 5 && (
              <div className="self-start rounded-2xl border-2 border-dashed border-alert bg-alert-bg px-4 py-2.5 text-[14px] font-bold text-alert" style={{ animation: "land-stamp .45s cubic-bezier(.3,1.6,.5,1) both" }}>
                ✋ 차단 · 글을 대신 써 줄 수 없어요 (도토리 그대로)
              </div>
            )}
          </div>
          <div className="flex flex-col items-center justify-start gap-2 rounded-2xl bg-cream-2 px-4 py-4 max-sm:flex-row max-sm:justify-between">
            <Squirrel size={84} eats={eats} />
            <div className="flex flex-col items-center gap-1">
              <span className="text-[12px] text-muted">남은 도토리</span>
              <span className="font-display text-3xl text-brown">{left}</span>
            </div>
          </div>
        </div>
      </DemoCard>
    </div>
  );
}

function Bubble({ side, children }: { side: "me" | "ai"; children: React.ReactNode }) {
  return (
    <div
      className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${side === "me" ? "self-end rounded-br-md bg-brown text-white" : "self-start rounded-bl-md bg-leaf-bg text-leaf"}`}
      style={{ animation: "land-pop .35s cubic-bezier(.3,1.6,.5,1) both" }}
    >
      {side === "ai" && <b className="mr-1">AI</b>}
      {children}
    </div>
  );
}

function ReportDemo() {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  // 0 질문 전 · 1 지운 부분 · 2 새로 쓴 부분 · 3 메모 · 4 유지
  const phase = usePhases(inView, [1100, 1100, 1100, 3200, 600]);
  const on = (p: number) => inView && phase >= p;
  return (
    <div ref={ref}>
      <DemoCard label="③ 교사 리포트 · 질문 전후 비교">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="rounded-full bg-ink px-2.5 py-1 font-bold text-white">도토리 1</span>
            <span className="text-muted">2학년 1반 · 20105 · 09:52 · 글쓰기 중 질문</span>
          </div>
          <p className="m-0 rounded-2xl border border-line bg-paper px-4 py-3 text-[16px] leading-loose">
            My role model is my mom. She{" "}
            <span className="rounded px-0.5 transition-all duration-500" style={on(1) ? { background: "var(--color-del-bg)", color: "var(--color-del)", textDecoration: "line-through" } : {}}>
              work
            </span>
            <span className="inline-block overflow-hidden align-bottom transition-all duration-500" style={{ maxWidth: on(2) ? 80 : 0 }}>
              <span className="ml-1 rounded bg-add-bg px-0.5 text-add">works</span>
            </span>{" "}
            at{" "}
            <span className="inline-block overflow-hidden align-bottom transition-all duration-500" style={{ maxWidth: on(2) ? 40 : 0 }}>
              <span className="rounded bg-add-bg px-0.5 text-add">a</span>
            </span>{" "}
            hospital.
          </p>
          <div
            className="flex items-start gap-3 rounded-2xl bg-path-rev-bg px-4 py-3 text-[14px] leading-relaxed text-path-rev"
            style={{ opacity: on(3) ? 1 : 0, transform: on(3) ? "none" : "translateY(10px)", transition: "all .5s" }}
          >
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[12px] font-bold">질문 후 스스로 수정</span>
            <span>AI는 어디가 틀렸는지만 짚었고, 고친 문장은 학생이 직접 썼어요. 질문 방식: 사실 확인 요청</span>
          </div>
        </div>
      </DemoCard>
    </div>
  );
}

/* ── 4. 선생님: 과목마다 다른 AI 기준 ── */

const SUBJECT_TONE: Record<string, string> = {
  국어: "#C27C3E",
  과학: "#4A6B3C",
  영어: "#2F6DB5",
  사회: "#8A4B12",
};

function ForTeachers() {
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const [pick, setPick] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (!inView || hold) return;
    const id = window.setInterval(() => setPick((p) => (p + 1) % BUILT_IN_EXAMS.length), 3800);
    return () => window.clearInterval(id);
  }, [inView, hold]);
  const exam = BUILT_IN_EXAMS[pick];
  const tone = SUBJECT_TONE[exam.subject] ?? "#8A4B12";
  const labels = exam.shortItems ?? exam.outlineItems;
  const max = 4;

  return (
    <section className="bg-cream-2 px-6 py-24 max-sm:px-4 max-sm:py-16">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[1fr_1.15fr] items-center gap-12 max-md:grid-cols-1">
        <Reveal className="flex flex-col gap-4">
          <span className="text-[14px] font-bold text-brown">선생님을 위해</span>
          <h2 className="m-0 font-display text-[44px] leading-tight font-normal max-sm:text-[32px]">
            과목마다 다른 AI 기준,
            <br />
            AI가 먼저 제안해요
          </h2>
          <p className="m-0 text-[17px] leading-relaxed text-sub">
            과제와 수업 자료, 채점기준표를 올리면 AI가 읽고 항목마다 <b>AI가 도와도 되는 일</b>, <b>하지 않을 일</b>, <b>권장 도토리 수</b>를 제안해요.
            학생 스스로 판단해야 하는 곳에는 적게, 혼자 알기 어려운 곳에는 많이. 선생님은 고쳐서 반에 배포만 하면 돼요.
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[15px] text-sub">
            <li>📄 PDF·텍스트 자료와 채점기준표를 그대로 읽어요</li>
            <li>🏫 {SCHOOL_NAME} 1~3학년 12개 반의 진행 상황을 한 화면에서</li>
            <li>📤 학생 리포트는 PDF 저장, 슈퍼스쿨로 보내기</li>
          </ul>
        </Reveal>

        <Reveal delay={150}>
          <div ref={ref} onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} className="rounded-[28px] border border-line bg-white p-6 shadow-[0_24px_60px_-30px_rgba(58,42,28,.35)] max-sm:p-4">
            <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="과목">
              {BUILT_IN_EXAMS.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  role="tab"
                  aria-selected={i === pick}
                  onClick={() => {
                    setPick(i);
                    setHold(true);
                  }}
                  className="cursor-pointer rounded-full border px-4 py-1.5 text-[14px] font-bold transition"
                  style={i === pick ? { background: SUBJECT_TONE[e.subject], borderColor: SUBJECT_TONE[e.subject], color: "#fff" } : { background: "#fff", borderColor: "var(--color-line)", color: "var(--color-sub)" }}
                >
                  중{e.grade} {e.subject}
                </button>
              ))}
            </div>
            <p key={exam.id} className="m-0 mb-5 font-display text-[22px] leading-snug" style={{ animation: "land-pop .4s both" }}>
              {exam.title}
            </p>
            <div className="grid grid-cols-4 items-end gap-3" style={{ height: 180 }}>
              {labels.map((label, i) => {
                const n = exam.itemGuides?.[i]?.acorns ?? 0;
                return (
                  <div key={i} className="flex h-full flex-col items-center justify-end gap-2">
                    <span className="font-display text-xl" style={{ color: tone }}>
                      {n}
                    </span>
                    <div
                      className="w-full rounded-t-xl"
                      style={{
                        height: `${inView ? Math.max(4, (n / max) * 120) : 4}px`,
                        background: tone,
                        opacity: 0.25 + (n / max) * 0.75,
                        transition: `height .7s cubic-bezier(.3,1.4,.5,1) ${i * 90}ms, background .4s, opacity .4s`,
                      }}
                    />
                    <span className="text-center text-[12px] leading-tight text-muted">{label}</span>
                  </div>
                );
              })}
            </div>
            <div key={`h${exam.id}`} className="mt-5 rounded-2xl bg-leaf-bg px-4 py-3 text-[14px] leading-relaxed text-leaf" style={{ animation: "land-pop .5s .15s both" }}>
              <b>AI가 이렇게 제안한 이유</b> · {exam.rationale}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 5. 들어가기 ── */

function Enter() {
  const cards = [
    {
      href: "/start",
      who: "학생",
      title: "수행평가 시작하기",
      text: "반을 고르고 학번·이름을 넣은 뒤 본인 확인을 하면 바로 시작해요.",
      cta: "시험 시작 →",
      dark: false,
    },
    {
      href: "/teacher",
      who: "선생님",
      title: "교사 화면 들어가기",
      text: "교사 코드로 들어가요. 학교 전체 현황, 반별 리포트, 새 수행평가 만들기.",
      cta: "교사 화면 →",
      dark: true,
    },
  ];
  return (
    <section className="px-6 py-24 max-sm:px-4 max-sm:py-16">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <Reveal className="text-center">
          <h2 className="m-0 font-display text-[44px] leading-tight font-normal max-sm:text-[32px]">지금 들어가 볼까요?</h2>
        </Reveal>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          {cards.map((c, i) => (
            <Reveal key={c.href} delay={i * 120}>
              <Link
                href={c.href}
                className={`group relative flex min-h-[240px] flex-col justify-between gap-6 overflow-hidden rounded-[28px] p-8 no-underline transition duration-300 hover:-translate-y-1.5 max-sm:p-6 ${c.dark ? "bg-ink text-white hover:shadow-[0_24px_50px_-24px_rgba(58,42,28,.8)]" : "border border-line bg-white text-ink hover:shadow-[0_24px_50px_-24px_rgba(138,75,18,.5)]"}`}
              >
                <div className="flex flex-col gap-2">
                  <span className={`text-[14px] font-bold ${c.dark ? "text-[#F6D7B3]" : "text-brown"}`}>{c.who}</span>
                  <span className="font-display text-[32px] leading-tight">{c.title}</span>
                  <span className={`max-w-[420px] text-[16px] leading-relaxed ${c.dark ? "text-white/80" : "text-sub"}`}>{c.text}</span>
                </div>
                <span className={`font-display text-xl transition group-hover:translate-x-1 ${c.dark ? "text-[#F6D7B3]" : "text-brown"}`}>{c.cta}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
