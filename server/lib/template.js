// Tạo file mẫu nhập danh sách học sinh.
import ExcelJS from "exceljs";

export const TEMPLATE_HEADERS = ["Họ và tên", "Ngày sinh (ngày/tháng/năm)", "Giới tính (Nam/Nữ)", "Họ tên phụ huynh", "Số điện thoại", "Ghi chú sức khỏe", "Họ tên phụ huynh thứ hai", "Số điện thoại phụ huynh thứ hai"];

export async function templateXlsx() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sổ tay Chủ nhiệm số";
  const ws = wb.addWorksheet("Danh sách", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [{ width: 28 }, { width: 16 }, { width: 12 }, { width: 26 }, { width: 16 }, { width: 36 }, { width: 26 }, { width: 18 }];
  const header = ws.addRow(TEMPLATE_HEADERS);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B2E83" } };
  // Định dạng chữ cho 300 dòng để Excel không tự đổi ngày sinh và không làm mất số 0 đầu số điện thoại.
  for (let r = 2; r <= 301; r++) {
    ws.getCell(r, 2).numFmt = "@";
    ws.getCell(r, 5).numFmt = "@";
    ws.getCell(r, 8).numFmt = "@";
    ws.getCell(r, 3).dataValidation = { type: "list", allowBlank: true, formulae: ['"Nam,Nữ"'] };
  }

  const help = wb.addWorksheet("Hướng dẫn");
  help.getColumn(1).width = 100;
  [
    "CÁCH ĐIỀN DANH SÁCH HỌC SINH",
    "1. Điền mỗi học sinh một dòng ở trang \"Danh sách\", bắt đầu từ dòng 2. Không xóa dòng tiêu đề.",
    "2. Họ và tên là bắt buộc. Các cột khác có thể để trống và bổ sung sau. Có thể ghi thêm phụ huynh thứ hai (ví dụ bố) ở hai cột cuối.",
    "3. Ngày sinh ghi theo dạng ngày/tháng/năm, ví dụ 05/09/2018.",
    "4. Giới tính ghi Nam hoặc Nữ.",
    "5. Số điện thoại gồm 10 chữ số, bắt đầu bằng 0, ví dụ 0912345678.",
    "6. Không ghi số định danh cá nhân, số căn cước hay thông tin không cần cho công tác chủ nhiệm. Nếu danh sách của trường có cột mã định danh, ứng dụng tự bỏ qua cột đó.",
    "7. Lưu file rồi tải lên trong ứng dụng: Hôm nay → Nhập danh sách → Tải file lên.",
  ].forEach((t, i) => {
    const row = help.addRow([t]);
    if (i === 0) row.font = { bold: true, size: 14 };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function templateCsv() {
  return "﻿" + TEMPLATE_HEADERS.join(",") + "\r\n";
}
