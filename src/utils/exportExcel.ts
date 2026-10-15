// Dung chung cho moi nut "Xuat Excel" trong app - xuat that .xlsx (khong phai .csv gia danh)
// de mo bang Excel/Google Sheets hien dung font UTF-8, do rong cot hop ly ngay khi mo,
// khong bi loi dau tieng Viet nhu khi mo file .csv truoc day.
// Import dong (khong o dau file) vi thu vien xlsx nang (~500KB) - chi tai khi nguoi dung
// thuc su bam xuat, tranh lam phinh bundle chinh cho moi luot tai trang.
export async function exportToExcel(filename: string, header: string[], rows: (string | number)[][]) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Tu dong gian do rong cot theo noi dung dai nhat (gioi han 60 ky tu) - tranh cot qua hep
  // hoac qua rong mac dinh cua Excel.
  const colWidths = header.map((h, colIndex) => {
    const maxLen = rows.reduce((max, row) => {
      const cell = row[colIndex];
      const len = cell === undefined || cell === null ? 0 : String(cell).length;
      return Math.max(max, len);
    }, h.length);
    return { wch: Math.min(60, Math.max(10, maxLen + 2)) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
