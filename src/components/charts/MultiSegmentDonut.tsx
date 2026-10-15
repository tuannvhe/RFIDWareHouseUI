import { useLanguage } from "../../context/LanguageContext";

interface Segment {
  name: string;
  count: number;
  colorVar: string; // ten CSS variable mau, vd "--green-500"
}

const SIZE = 132;
const STROKE = 17;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

// Donut nhieu mau (moi phan tuong ung 1 hang muc, vd trang thai tem) - khac voi DonutRing
// (chi 2 mau: dat/con lai) de tao su da dang giua cac the tren Dashboard.
export default function MultiSegmentDonut({ data, centerLabel }: { data: Segment[]; centerLabel?: string }) {
  const { t } = useLanguage();
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (data.length === 0 || total === 0) {
    return <div className="chart-empty">{t("chart.emptyData")}</div>;
  }

  // Chua 1 khe ho nho (GAP) giua cac phan, kem bo tron 2 dau (round) - de tach bach cac phan ro rang
  // bang duong vien thay vi chi dua vao mau sac, phong khi 2 mau ke nhau kha giong nhau.
  const GAP = data.length > 1 ? 4 : 0;
  let cumulativeFraction = 0;
  const arcs = data.map((d) => {
    const fraction = d.count / total;
    const arcLength = Math.max(0, fraction * CIRC - GAP);
    const dashArray = `${arcLength} ${CIRC - arcLength}`;
    const rotation = -90 + cumulativeFraction * 360;
    cumulativeFraction += fraction;
    return { ...d, fraction, dashArray, rotation };
  });

  return (
    <div className="multi-donut">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="donut-svg">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} fill="none" className="donut-bg" />
        {arcs.map((a) => (
          <circle
            key={a.name}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            strokeWidth={STROKE}
            fill="none"
            stroke={`var(${a.colorVar})`}
            strokeDasharray={a.dashArray}
            strokeLinecap="round"
            transform={`rotate(${a.rotation} ${SIZE / 2} ${SIZE / 2})`}
          >
            <title>{`${a.name}: ${a.count} (${Math.round(a.fraction * 100)}%)`}</title>
          </circle>
        ))}
        <text x="50%" y="47%" textAnchor="middle" className="donut-value">
          {centerLabel ?? total}
        </text>
        <text x="50%" y="64%" textAnchor="middle" className="donut-caption">
          {centerLabel ? `${total} ${t("chart.total")}` : t("chart.total")}
        </text>
      </svg>

      <div className="chart-legend multi-donut-legend">
        {arcs.map((a) => (
          <span className="chart-legend-item" key={a.name}>
            <span className="chart-legend-dot" style={{ background: `var(${a.colorVar})` }} />
            {a.name} ({a.count})
          </span>
        ))}
      </div>
    </div>
  );
}
