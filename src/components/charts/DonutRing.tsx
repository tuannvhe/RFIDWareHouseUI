export default function DonutRing({
  percent,
  valueLabel,
  caption,
  tone = "green",
}: {
  percent: number;
  valueLabel: string;
  caption: string;
  tone?: "green" | "amber" | "teal" | "indigo" | "red";
}) {
  const size = 132;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c - (clamped / 100) * c;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" className="donut-bg" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={`donut-fg donut-${tone}`}
      />
      <text x="50%" y="47%" textAnchor="middle" className="donut-value">
        {valueLabel}
      </text>
      <text x="50%" y="64%" textAnchor="middle" className="donut-caption">
        {caption}
      </text>
    </svg>
  );
}
