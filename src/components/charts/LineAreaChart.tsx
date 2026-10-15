import { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";

export interface ChartSeries {
  name: string;
  colorVar: string; // ten CSS variable mau, vd "--green-600"
  data: number[];
}

// viewBox khop gan dung ty le hien thi that (card rong ~1300-1500px, cao co dinh 220px)
// de tranh scale khong deu (preserveAspectRatio="none") lam net/chu bi keo gian mo.
const WIDTH = 1320;
const HEIGHT = 220;
const PADDING = 42;
const MAX_AXIS_LABELS = 10;

interface Point {
  x: number;
  y: number;
}

// Duong cong mem qua tung diem du lieu, kieu "monotone cubic" (giong d3.curveMonotoneX) thay vi
// Catmull-Rom thuan tuy - Catmull-Rom de bi vong ra ngoai (overshoot) quanh cac diem tang/giam dot
// ngot (vd 1 ngay dot bien cao han han cac ngay khac), tao cam giac gon song/tho thay vi muot.
// Monotone cubic tinh tiep tuyen rieng cho tung diem sao cho duong cong khong bao gio vuot qua
// khoang gia tri cua 2 diem lang gieng - luon muot va "sat" du lieu that.
function monotoneTangents(points: Point[]): number[] {
  const n = points.length;
  const dx: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const d = points[i + 1].x - points[i].x;
    dx.push(d);
    slopes.push(d === 0 ? 0 : (points[i + 1].y - points[i].y) / d);
  }
  const tangents = new Array<number>(n).fill(0);
  tangents[0] = slopes[0] ?? 0;
  tangents[n - 1] = slopes[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    const sPrev = slopes[i - 1];
    const sNext = slopes[i];
    if (sPrev === 0 || sNext === 0 || sPrev > 0 !== sNext > 0) {
      tangents[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangents[i] = (w1 + w2) / (w1 / sPrev + w2 / sNext);
    }
  }
  return tangents;
}

function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;
  }
  const tangents = monotoneTangents(points);
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) / 3;
    const cp1x = p0.x + dx;
    const cp1y = p0.y + tangents[i] * dx;
    const cp2x = p1.x - dx;
    const cp2y = p1.y - tangents[i + 1] * dx;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }
  return d;
}

export default function LineAreaChart({ labels, series }: { labels: string[]; series: ChartSeries[] }) {
  const { t } = useLanguage();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const hasData = labels.length > 0 && series.some((s) => s.data.some((v) => v > 0));

  if (labels.length === 0) {
    return <div className="chart-empty">{t("chart.emptyData")}</div>;
  }

  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const stepX = labels.length > 1 ? (WIDTH - PADDING * 2) / (labels.length - 1) : 0;
  const centerXWhenSingle = WIDTH / 2;
  const xAt = (i: number) => (labels.length > 1 ? PADDING + i * stepX : centerXWhenSingle);

  const seriesPoints = series.map((s) => ({
    ...s,
    points: s.data.map((v, i) => ({
      x: xAt(i),
      y: HEIGHT - PADDING - (v / max) * (HEIGHT - PADDING * 2),
      value: v,
    })),
  }));

  const seriesWithArea = seriesPoints.map((s) => {
    const line = smoothPath(s.points);
    const area =
      s.points.length > 1
        ? `${line} L${s.points[s.points.length - 1].x},${HEIGHT - PADDING} L${s.points[0].x},${HEIGHT - PADDING} Z`
        : "";
    return { ...s, line, area };
  });

  const hitWidth = labels.length > 1 ? stepX : WIDTH - PADDING * 2;

  // Chi hien toi da MAX_AXIS_LABELS nhan truc de khong chong chu khi co nhieu ngay (vd 30 ngay)
  const labelStep = Math.max(1, Math.ceil(labels.length / MAX_AXIS_LABELS));

  const tooltipLines = hoverIndex !== null ? seriesPoints.map((s) => s.points[hoverIndex]?.value ?? 0) : [];
  const tooltipTextWidth =
    hoverIndex !== null
      ? Math.max(
          labels[hoverIndex]?.length ?? 0,
          ...seriesPoints.map((s) => `${s.name}: ${s.points[hoverIndex]?.value ?? 0}`.length),
        )
      : 0;
  const tooltipW = Math.max(150, tooltipTextWidth * 11 + 40);
  const tooltipH = 36 + seriesPoints.length * 30 + 14;
  const rawTooltipX = hoverIndex !== null ? xAt(hoverIndex) + 18 : 0;
  const tooltipX = Math.min(rawTooltipX, WIDTH - tooltipW - 6);
  const tooltipY = 12;

  return (
    <div style={{ position: "relative" }}>
      {!hasData && <div className="chart-empty chart-empty-overlay">{t("chart.emptyData")}</div>}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" preserveAspectRatio="none">
        <defs>
          {seriesWithArea.map((s, i) => (
            <linearGradient key={s.name} id={`areaFill-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`var(${s.colorVar})`} stopOpacity={i === 0 ? 0.26 : 0.14} />
              <stop offset="100%" stopColor={`var(${s.colorVar})`} stopOpacity="0" />
            </linearGradient>
          ))}
          <filter id="lineGlow" x="-20%" y="-60%" width="140%" height="240%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.22" />
          </filter>
        </defs>

        <line
          x1={PADDING}
          x2={WIDTH - PADDING}
          y1={HEIGHT - PADDING}
          y2={HEIGHT - PADDING}
          className="chart-baseline"
          vectorEffect="non-scaling-stroke"
        />
        {[0.33, 0.66].map((f) => (
          <line
            key={f}
            x1={PADDING}
            x2={WIDTH - PADDING}
            y1={PADDING + f * (HEIGHT - PADDING * 2)}
            y2={PADDING + f * (HEIGHT - PADDING * 2)}
            className="chart-gridline"
            strokeDasharray="4 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {seriesWithArea.map(
          (s, i) => s.area && <path key={`area-${s.name}`} d={s.area} fill={`url(#areaFill-${i})`} />,
        )}

        {seriesWithArea.map((s) => {
          if (s.points.length < 2) return null;
          return (
            <path
              key={s.name}
              d={s.line}
              fill="none"
              stroke={`var(${s.colorVar})`}
              strokeWidth={2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#lineGlow)"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {hoverIndex !== null && (
          <line
            x1={xAt(hoverIndex)}
            x2={xAt(hoverIndex)}
            y1={PADDING - 6}
            y2={HEIGHT - PADDING}
            className="chart-hover-guide"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Chi hien cham tron o diem dang hover (kieu bieu do fintech hien dai) - khong rai cham
            len tung diem du lieu de tranh roi mat khi co nhieu ngay, duong cong da du de doc xu huong. */}
        {hoverIndex !== null &&
          seriesPoints.map((s) => {
            const p = s.points[hoverIndex];
            if (!p) return null;
            return (
              <circle
                key={s.name}
                cx={p.x}
                cy={p.y}
                r={5.5}
                fill={`var(${s.colorVar})`}
                stroke="var(--surface)"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

        {/* Cham nhan manh gia tri tai diem cuoi cung (ngay gan nhat) cho tung duong, giong kieu
            "gia tri hien tai" thuong thay o dashboard fintech. */}
        {hoverIndex === null &&
          seriesWithArea.map((s) => {
            const last = s.points[s.points.length - 1];
            if (!last) return null;
            return (
              <circle
                key={`end-${s.name}`}
                cx={last.x}
                cy={last.y}
                r={4.5}
                fill={`var(${s.colorVar})`}
                stroke="var(--surface)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

        {labels.map((label, i) => {
          if (i % labelStep !== 0 && i !== labels.length - 1) return null;
          return (
            <text key={i} x={xAt(i)} y={HEIGHT - 14} textAnchor="middle" className="chart-axis-label">
              {label}
            </text>
          );
        })}

        {/* Vung bat hover (trong suot) - moi cot ung voi 1 ngay */}
        {labels.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={xAt(i) - hitWidth / 2}
            y={0}
            width={hitWidth}
            height={HEIGHT}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
          />
        ))}

        {hoverIndex !== null && (
          <g className="chart-tooltip-group">
            <rect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx={10} className="chart-tooltip-box" />
            <text x={tooltipX + 16} y={tooltipY + 24} className="chart-tooltip-title">
              {labels[hoverIndex]}
            </text>
            {seriesPoints.map((s, si) => (
              <g key={s.name}>
                <circle cx={tooltipX + 20} cy={tooltipY + 46 + si * 28} r={5} fill={`var(${s.colorVar})`} />
                <text x={tooltipX + 32} y={tooltipY + 51 + si * 28} className="chart-tooltip-row">
                  {s.name}: <tspan className="chart-tooltip-value">{tooltipLines[si] ?? 0}</tspan>
                </text>
              </g>
            ))}
          </g>
        )}
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
