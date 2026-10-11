// Dựng file Excel báo cáo tuần/tháng của một lớp. ExcelJS được truyền vào
// (máy chủ dùng thư viện cài sẵn, bản giáo viên tải từ CDN).

/**
 * @param {any} ExcelJS
 * @param {{ cls: {name:string, schoolName:string, schoolYear:string}, teacher: string, period: {label:string}, report: ReturnType<import("./report.js").classReport> }} input
 * @returns {Promise<ArrayBuffer|Buffer>}
 */
export async function reportWorkbook(ExcelJS, { cls, teacher, period, report }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sổ tay Chủ nhiệm số";
  const ws = wb.addWorksheet("Báo cáo", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const cols = ["STT", "Họ và tên", "Số buổi", "Có mặt", "Vắng có phép", "Vắng không phép", "Tỉ lệ chuyên cần (%)", "Hoàn thành tốt", "Hoàn thành", "Chưa hoàn thành", "Ngôi sao", "Cần quan tâm"];
  ws.columns = [6, 28, 9, 9, 12, 14, 14, 12, 11, 14, 10, 13].map((width) => ({ width }));

  const title = ws.addRow([`BÁO CÁO LỚP ${cls.name.toUpperCase()} – ${period.label.toUpperCase()}`]);
  title.font = { bold: true, size: 14, color: { argb: "FF4B2E83" } };
  ws.addRow([`${cls.schoolName} · Năm học ${String(cls.schoolYear).replace("-", "–")}${teacher ? " · GVCN: " + teacher : ""}`]);
  ws.addRow([`Số buổi đã điểm danh: ${report.totals.days} · Sĩ số: ${report.totals.students}`]);
  ws.addRow([]);

  const head = ws.addRow(cols);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B2E83" } }; });

  report.rows.forEach((r, i) => {
    const row = ws.addRow([i + 1, r.fullName, r.days, r.present, r.P, r.K, r.rate, r.T, r.H, r.C, r.stars, r.care ? "Có" : ""]);
    if (r.care) row.getCell(12).font = { bold: true, color: { argb: "FFC83A3A" } };
  });

  const t = report.totals;
  const total = ws.addRow(["", "Cả lớp", t.days, t.present, t.P, t.K, t.rate, t.T, t.H, t.C, t.stars, t.care]);
  total.font = { bold: true };
  total.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEE8FA" } }; });

  ws.getColumn(7).numFmt = "0.0";
  const first = 5;
  for (let r = first; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (c, col) => {
      if (col > cols.length) return;
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      if (col !== 2 && r > first) c.alignment = { horizontal: "center" };
    });
  }
  ws.views = [{ state: "frozen", ySplit: first }];
  return wb.xlsx.writeBuffer();
}

/** Tên file gợi ý, chỉ gồm chữ không dấu để dùng được trên mọi máy. */
export function reportFileName(className, period) {
  const safe = String(className).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "-");
  return `bao-cao-lop-${safe}-${period.key}.xlsx`;
}
