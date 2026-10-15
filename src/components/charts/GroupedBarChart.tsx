import { useLanguage } from "../../context/LanguageContext";

export interface GroupedBarSeries {
  name: string;
  colorVar: string; // ten CSS variable mau, vd "--amber-600"
  data: number[];
}

// Bieu do cot nhom (vd Vi pham FIFO / Ghi de theo tung thang, 2 cot canh nhau moi thang) -
// cung quy uoc SVG viewBox nhu LineAreaChart de dong bo giao dien.
const WIDTH = 900;
const HEIGHT = 240;
const PADDING_LEFT = 30;
const PADDING_RIGHT = 16;
const PADDING_TOP = 28;
const PADDING_BOTTOM = 36;

export default function GroupedBarChart({ labels, series }: { labels: string[]; series: GroupedBarSeries[] }) {
  const { t } = useLanguage();
  const hasData = labels.length > 0 && series.some((s) => s.data.some((v) => v > 0));

  if (labels.length === 0) {
    return <div className="chart-empty">{t("chart.emptyData")}</div>;
  }

  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const groupWidth = plotWidth / labels.length;
  const barGap = 6;
  const groupPadding = groupWidth * 0.18;
  const barWidth = Math.max(2, (groupWidth - groupPadding * 2 - barGap * (series.length - 1)) / series.length);

  return (
    <div style={{ position: "relative" }}>
      {!hasData && <div className="chart-empty chart-empty-overlay">{t("chart.emptyData")}</div>}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" preserveAspectRatio="none">
        <line
          x1={PADDING_LEFT}
          x2={WIDTH - PADDING_RIGHT}
          y1={HEIGHT - PADDING_BOTTOM}
          y2={HEIGHT - PADDING_BOTTOM}
          className="chart-baseline"
          vectorEffect="non-scaling-stroke"
        />
        {[0.33, 0.66].map((f) => (
          <line
            key={f}
            x1={PADDING_LEFT}
            x2={WIDTH - PADDING_RIGHT}
            y1={PADDING_TOP + f * plotHeight}
            y2={PADDING_TOP + f * plotHeight}
            className="chart-gridline"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {labels.map((label, gi) => {
          const groupX = PADDING_LEFT + gi * groupWidth + groupPadding;
          return (
            <g key={label}>
              {series.map((s, si) => {
                const value = s.data[gi] ?? 0;
                const barHeight = (value / max) * plotHeight;
                const x = groupX + si * (barWidth + barGap);
                const y = HEIGHT - PADDING_BOTTOM - barHeight;
                return (
                  <g key={s.name}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(0, barHeight)}
                      fill={`var(${s.colorVar})`}
                      rx={3}
                    >
                      <title>{`${label} — ${s.name}: ${value}`}</title>
                    </rect>
                    {value > 0 && (
                      <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="chart-bar-value">
                        {value}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={PADDING_LEFT + gi * groupWidth + groupWidth / 2}
                y={HEIGHT - 12}
                textAnchor="middle"
                className="chart-axis-label"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="chart-legend">
        {series.map((s) => (
          <span className="chart-legend-item" key={s.name}>
            <span className="chart-legend-dot" style={{ background: `var(${s.colorVar})` }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
