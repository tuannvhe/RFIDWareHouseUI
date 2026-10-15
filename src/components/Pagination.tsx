import { ChevronLeft, ChevronRight } from "lucide-react";

// Danh sach so trang thu gon kieu "1 2 ... 4 5 6 ... 10" - tranh liet ke het tat ca so trang
// khi tong so trang lon. Dung chung cho moi bang co phan trang trong app (Nhat ky in, Nhat ky
// xuat qua cong, ...) de dinh dang phan trang dong nhat toan bo web.
//
// Cach lam: luon giu lai trang dau, trang cuoi, trang hien tai va 1 trang lang gieng moi ben -
// nhung so con lai deu gop lai. Neu khoang trong giua 2 so giu lai chi thieu dung 1 trang (vd 1 va 3)
// thi hien luon so do (2) thay vi dau "...", vi an di 1 trang duy nhat khong tiet kiem duoc gi ca -
// nho vay bang co it trang (vd 6-7 trang) van duoc gop gon thay vi hien het nhu truoc.
export function getPageNumbers(current: number, total: number): (number | "gap")[] {
  const siblingCount = 1;
  const keep = new Set<number>([1, total]);
  for (let i = current - siblingCount; i <= current + siblingCount; i++) {
    if (i >= 1 && i <= total) keep.add(i);
  }
  const sorted = Array.from(keep).sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const diff = sorted[i] - sorted[i - 1];
      if (diff === 2) {
        result.push(sorted[i - 1] + 1);
      } else if (diff > 2) {
        result.push("gap");
      }
    }
    result.push(sorted[i]);
  }
  return result;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}

export default function Pagination({ page, totalPages, onChange, disabled }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination-controls">
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={disabled || page <= 1}>
        <ChevronLeft size={15} />
      </button>
      {getPageNumbers(page, totalPages).map((p, i) =>
        typeof p === "number" ? (
          <button
            key={p}
            type="button"
            className={`page-num-btn ${p === page ? "active" : ""}`}
            onClick={() => onChange(p)}
            disabled={disabled}
          >
            {p}
          </button>
        ) : (
          <span key={`gap-${i}`} className="page-num-gap">
            …
          </span>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={disabled || page >= totalPages}
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
