const tone = (n) => (n >= 80 ? '#34d399' : n >= 60 ? '#22D3EE' : n >= 40 ? '#fbbf24' : '#f87171');

export default function ScoreRing({ value, size = 38, onClick, active }) {
  const r = (size - 6) / 2; const c = 2 * Math.PI * r;
  return (
    <button type="button" onClick={onClick} aria-label={`Critic score ${value} out of 100. Show details`} aria-expanded={active}
      className="relative shrink-0 rounded-full transition hover:scale-105" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272A" strokeWidth="3.5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone(value)} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[11px] font-semibold text-white">{value}</span>
    </button>
  );
}
export { tone };
