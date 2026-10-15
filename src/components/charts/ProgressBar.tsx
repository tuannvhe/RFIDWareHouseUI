interface ProgressBarProps {
  percent: number;
  colorVar: string; // ten CSS variable mau, vd "--teal-500"
  label: string;
  caption: string;
}

// Thanh tien trinh dang gradient + nhan phan tram noi (kieu the "Limits" cua cac dashboard fintech) -
// dung thay the/bo sung cho DonutRing o nhung cho can nhieu chi so xep chong trong cung 1 the.
export default function ProgressBar({ percent, colorVar, label, caption }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress-bar-widget">
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${Math.max(clamped, 12)}%`, background: `var(${colorVar})` }}
        >
          <span className="progress-bar-badge">{Math.round(clamped)}%</span>
        </div>
      </div>
      <div className="progress-bar-footer">
        <span className="progress-bar-label">{label}</span>
        <span className="progress-bar-caption">{caption}</span>
      </div>
    </div>
  );
}
