type Props = {
  size?: number;
  /** 다 쓴(먹은) 도토리: 흐리게 */
  faded?: boolean;
  /** 빈 칸 (개요 표의 회색 도토리) */
  ghost?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** 와이어프레임의 도토리 아이콘 */
export function Acorn({ size = 26, faded, ghost, className, style }: Props) {
  const cap = ghost ? "#CDBBA6" : "#6B3E1D";
  const nut = ghost ? "#E4D6C4" : "#C27C3E";
  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 40 48"
      aria-hidden="true"
      className={className}
      style={{
        transition: "opacity .4s, transform .4s",
        ...(faded ? { opacity: 0.18, transform: "translateY(6px) rotate(40deg)" } : {}),
        ...style,
      }}
    >
      <path d="M20 3v6" stroke="#5A3418" strokeWidth="3" strokeLinecap="round" />
      <path d="M4 20Q4 8 20 8Q36 8 36 20Q36 24 20 24Q4 24 4 20Z" fill={cap} />
      <path d="M7 22Q7 44 20 46Q33 44 33 22Z" fill={nut} />
    </svg>
  );
}
