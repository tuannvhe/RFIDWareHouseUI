import { useLanguage } from "../../context/LanguageContext";

interface BarItem {
  name: string;
  count: number;
}

const PALETTE = ["fill-green", "fill-teal", "fill-indigo", "fill-amber"];

export default function SimpleBarChart({ data }: { data: BarItem[] }) {
  const { t } = useLanguage();
  if (data.length === 0) {
    return <div className="chart-empty">{t("chart.emptyData")}</div>;
  }

  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="bar-list">
      {data.map((d, i) => (
        <div className="bar-list-row" key={d.name} title={`${d.name}: ${d.count}`}>
          <span className="bar-list-label">{d.name}</span>
          <div className="bar-list-track">
            <div
              className={`bar-list-fill ${PALETTE[i % PALETTE.length]}`}
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="bar-list-value">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
