import { useLanguage } from "../../context/LanguageContext";

interface BarItem {
  name: string;
  count: number;
}

const PALETTE = ["--green-500", "--teal-500", "--indigo-500", "--amber-500", "--red-600"];

const WIDTH = 700;
const HEIGHT = 220;
const PADDING_TOP = 26;
const PADDING_BOTTOM = 40;
const PADDING_X = 16;

function shortLabel(name: string): string {
  return name.length > 8 ? `${name.slice(0, 7)}…` : name;
}

// Bieu do cot doc don gian, dung cho danh sach xep hang nhieu muc (vd Top Lot vi pham FIFO) -
// khac kieu voi SimpleBarChart (thanh ngang) de tao su da dang giua cac the tren Dashboard.
export default function VerticalBarChart({ data }: { data: BarItem[] }) {
  const { t } = useLanguage();
  if (data.length === 0) {
    return <div className="chart-empty">{t("chart.emptyData")}</div>;
  }

  const max = Math.max(1, ...data.map((d) => d.count));
  const plotWidth = WIDTH - PADDING_X * 2;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const slotWidth = plotWidth / data.length;
  const barWidth = Math.min(46, slotWidth * 0.5);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" preserveAspectRatio="none">
      <line
        x1={PADDING_X}
        x2={WIDTH - PADDING_X}
        y1={HEIGHT - PADDING_BOTTOM}
        y2={HEIGHT - PADDING_BOTTOM}
        className="chart-baseline"
        vectorEffect="non-scaling-stroke"
      />
      {data.map((d, i) => {
        const slotX = PADDING_X + i * slotWidth;
        const x = slotX + (slotWidth - barWidth) / 2;
        const barHeight = (d.count / max) * plotHeight;
        const y = HEIGHT - PADDING_BOTTOM - barHeight;
        const color = PALETTE[i % PALETTE.length];
        return (
          <g key={d.name}>
            <rect x={x} y={y} width={barWidth} height={Math.max(0, barHeight)} fill={`var(${color})`} rx={4}>
              <title>{`${d.name}: ${d.count}`}</title>
            </rect>
            <text x={slotX + slotWidth / 2} y={y - 6} textAnchor="middle" className="chart-bar-value">
              {d.count}
            </text>
            <text x={slotX + slotWidth / 2} y={HEIGHT - PADDING_BOTTOM + 16} textAnchor="middle" className="chart-axis-label">
              {shortLabel(d.name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
