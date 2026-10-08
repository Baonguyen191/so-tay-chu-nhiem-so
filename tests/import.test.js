import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { checkRows, parseCsv, parsePastedText, parseXlsx } from "../server/lib/import.js";
import { templateXlsx } from "../server/lib/template.js";
import { parseDate, parsePhone, validateStudent } from "../public/js/shared/validate.js";
import { sortByVietnameseName } from "../public/js/shared/vnsort.js";
import { createClass, createStudent, createUser, loggedIn, makeApp } from "./helpers.js";

const TODAY = "2026-10-07";
const check = (text, opts = {}) => checkRows(parsePastedText(text), { today: TODAY, ...opts });

test("dán từ Excel: đọc đúng các cột cách nhau bằng tab", () => {
  const r = check("Nguyễn Minh Anh\t05/09/2018\tNữ\tNguyễn Văn Hùng\t0912 345 678\tDị ứng hải sản");
  assert.equal(r.validCount, 1);
  assert.deepEqual(r.rows[0].value, {
    fullName: "Nguyễn Minh Anh", dob: "2018-09-05", gender: "F",
    parentName: "Nguyễn Văn Hùng", parentPhone: "0912345678", healthNote: "Dị ứng hải sản",
    parent2Name: "", parent2Phone: "",
  });
});

test("danh sách kiểu của trường: dòng tiêu đề, tên cột gộp ô, mẹ và bố, bỏ cột mã định danh", async () => {
  // Dữ liệu giả, dựng đúng cấu trúc danh sách lớp do trường cấp.
  const ID = "031999000111";
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.getRow(2).values = ["DANH SÁCH HỌC SINH LỚP 1A9"];
  ws.getRow(3).values = ["Trường: Tiểu học Thử Nghiệm. Năm học 2026- 2027"];
  const header = ["TT", "Họ và tên trẻ", "Ngày tháng năm sinh", "Giới tính", "Mã số định danh cá nhân", "Họ và tên mẹ", "Số điện thoại mẹ", "Họ và tên bố", "Số điện thoại bố", "Ghi chú"];
  for (const r of [4, 5, 6, 7]) ws.getRow(r).values = header; // ô tên cột gộp 4 dòng
  ws.getRow(8).values = [1, "Lê Bảo An", "25/09/2020", "Nam", Number(ID), "Phạm Thị Hoa", 912000111, "Lê Văn Tùng", 988000222, ""];
  // Người gõ 05/09/2020 (ngày 5 tháng 9) nhưng Excel hiểu theo kiểu Mỹ thành ngày 9 tháng 5.
  ws.getRow(9).values = [2, "Vũ Minh Châu", new Date(Date.UTC(2020, 4, 9)), "Nữ", 31999000222, "", null, "Vũ Văn Bình", 977000333, "Dị ứng sữa"];
  for (const r of [8, 9]) ws.getCell(r, 3).numFmt = "mm/dd/yyyy";
  // Ô ngày dùng định dạng ngày mặc định của Excel thì giữ nguyên.
  ws.getRow(10).values = [3, "Đào Thu Hà", new Date(Date.UTC(2020, 1, 3)), "Nữ"];
  ws.getCell(10, 3).numFmt = "mm-dd-yy";

  const r = checkRows(await parseXlsx(Buffer.from(await wb.xlsx.writeBuffer())), { today: TODAY });
  assert.equal(r.validCount, 3);
  assert.deepEqual(r.rows.map((x) => x.line), [8, 9, 10]);
  assert.deepEqual(r.rows[0].value, {
    fullName: "Lê Bảo An", dob: "2020-09-25", gender: "M",
    parentName: "Phạm Thị Hoa", parentPhone: "0912000111", healthNote: "",
    parent2Name: "Lê Văn Tùng", parent2Phone: "0988000222",
  });
  assert.equal(r.rows[1].value.dob, "2020-09-05", "đọc theo chữ số đang hiện trên Excel (ngày/tháng)");
  assert.equal(r.rows[1].value.parentName, "");
  assert.equal(r.rows[1].value.parent2Phone, "0977000333");
  assert.equal(r.rows[1].value.healthNote, "Dị ứng sữa");
  assert.equal(r.rows[2].value.dob, "2020-02-03");
  // Mã định danh không được lưu ở bất kỳ đâu.
  for (const row of r.rows) {
    assert.ok(!JSON.stringify(row.value).includes(ID.slice(1)), "không lưu mã định danh");
    assert.ok(!JSON.stringify(row.value).includes("31999000222"));
  }
});

test("báo lỗi từng dòng: thiếu tên, sai ngày sinh, số điện thoại không hợp lệ", () => {
  const r = check([
    "Trần Gia Bảo\t12/03/2018\tNam\tTrần Thị Lan\t0987654321",
    "\t01/01/2018\tNam",
    "Lê Ngọc Châu\t31/02/2018\tNữ",
    "Phạm Đức Duy\t2018-07-15\tNam\tPhạm Văn Tuấn\t12345",
    "Hoàng Thu Hà\t15/7/2030",
    "Vũ Quang Huy\t\tkhông rõ",
  ].join("\n"));
  assert.equal(r.rows.length, 6);
  assert.equal(r.validCount, 1);
  assert.equal(r.errorCount, 5);
  assert.deepEqual(r.rows.map((x) => x.line), [1, 2, 3, 4, 5, 6]);
  assert.match(r.rows[1].errors[0], /Thiếu họ và tên/);
  assert.match(r.rows[2].errors[0], /Ngày sinh không hợp lệ/);
  assert.match(r.rows[3].errors[0], /Số điện thoại không hợp lệ/);
  assert.match(r.rows[4].errors[0], /Ngày sinh không hợp lý/);
  assert.match(r.rows[5].errors[0], /Giới tính/);
  // Dòng lỗi giữ dữ liệu gốc để giáo viên thấy chỗ sai.
  assert.equal(r.rows[2].value.dob, "31/02/2018");
});

test("nhận ra dòng tiêu đề và cột STT; bỏ qua dòng trống", () => {
  const withHeader = check("STT\tHọ và tên\tNgày sinh\tSĐT phụ huynh\n1\tĐỗ Phương Mai\t3/4/2018\t912345678\n\n2\tNgô Bảo Nam\t\t");
  assert.equal(withHeader.validCount, 2);
  assert.equal(withHeader.rows[0].line, 2);
  assert.equal(withHeader.rows[0].value.parentPhone, "0912345678", "tự thêm số 0 bị Excel làm mất");
  assert.equal(withHeader.rows[1].line, 4);

  const sttNoHeader = check("1\tDương Thảo Nhi\n2\tLý Hoàng Phúc");
  assert.deepEqual(sttNoHeader.rows.map((x) => x.value.fullName), ["Dương Thảo Nhi", "Lý Hoàng Phúc"]);

  const namesOnly = check("Mai Diệu Thảo\nPhan Anh Thư\n");
  assert.equal(namesOnly.validCount, 2);
});

test("phát hiện trùng trong danh sách và trùng với học sinh đã có", () => {
  const r = check("Tạ Gia Vinh\t01/02/2018\nTạ Gia Vinh\t01/02/2018\nHồ Đức Trí", {
    existing: [{ full_name: "Hồ Đức Trí", dob: null }],
  });
  assert.equal(r.rows[0].errors.length, 0);
  assert.match(r.rows[1].errors[0], /Trùng với dòng 1/);
  assert.match(r.rows[2].errors[0], /Đã có học sinh này trong lớp/);
});

test("chặn mã độc trong tên (chống XSS từ dữ liệu nhập)", () => {
  const r = check("<img src=x onerror=alert(1)>\nNguyễn <b>An</b>");
  assert.equal(r.validCount, 0);
});

test("đọc file CSV: dấu chấm phẩy, ngoặc kép, BOM", () => {
  const rows = parseCsv('﻿Họ và tên;Ngày sinh;Ghi chú sức khỏe\r\n"Lương Hải Yến";20/11/2018;"Hen, mang thuốc ""xịt"""\r\n');
  const r = checkRows(rows, { today: TODAY });
  assert.equal(r.validCount, 1);
  assert.equal(r.rows[0].value.healthNote, 'Hen, mang thuốc "xịt"');
});

test("đọc file .xlsx: ô ngày kiểu Date, số điện thoại kiểu số", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("DS");
  ws.addRow(["Họ và tên", "Ngày sinh", "Giới tính", "Họ tên phụ huynh", "Số điện thoại"]);
  ws.addRow(["Kiều Nhật Long", new Date(Date.UTC(2018, 5, 1)), "Nam", "Kiều Văn Sơn", 987654321]);
  ws.addRow([{ richText: [{ text: "Chu Bảo " }, { text: "Trâm" }] }, "07/08/2018", "Nữ"]);
  const rows = await parseXlsx(Buffer.from(await wb.xlsx.writeBuffer()));
  const r = checkRows(rows, { today: TODAY });
  assert.equal(r.validCount, 2);
  assert.equal(r.rows[0].value.dob, "2018-06-01");
  assert.equal(r.rows[0].value.parentPhone, "0987654321");
  assert.equal(r.rows[1].value.fullName, "Chu Bảo Trâm");
});

test("file mẫu .xlsx đọc lại được sau khi điền", async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await templateXlsx());
  wb.getWorksheet("Danh sách").getRow(2).values = ["Bùi Tuấn Kiệt", "09/10/2018", "Nam", "Bùi Thị Nga", "0901234567", ""];
  const r = checkRows(await parseXlsx(Buffer.from(await wb.xlsx.writeBuffer())), { today: TODAY });
  assert.equal(r.validCount, 1);
  assert.equal(r.rows[0].value.fullName, "Bùi Tuấn Kiệt");
});

test("chuẩn hóa ngày và số điện thoại", () => {
  assert.equal(parseDate("5/9/2018"), "2018-09-05");
  assert.equal(parseDate("05-09-18"), "2018-09-05");
  assert.equal(parseDate(43348), "2018-09-05"); // số ngày của Excel
  assert.equal(parseDate("29/02/2019"), null);
  assert.equal(parsePhone("+84 912 345 678").value, "0912345678");
  assert.equal(parsePhone("0222.3456.789").value, "02223456789");
  assert.ok(parsePhone("0123").error);
  assert.deepEqual(validateStudent({ fullName: "  Nguyễn   Văn  An " }).value.fullName, "Nguyễn Văn An");
});

test("sắp xếp theo tên rồi đến họ, đúng thứ tự chữ cái tiếng Việt", () => {
  const names = ["Trần Văn Đức", "Lê Thị Ánh", "Nguyễn Văn An", "Phạm Thị Ân", "Hoàng Duy", "Bùi Văn Dũng", "Võ Thị Ăn", "Đỗ Văn An", "Nguyễn Thị Bảo"];
  const sorted = sortByVietnameseName(names.map((fullName) => ({ fullName }))).map((x) => x.fullName);
  assert.deepEqual(sorted, [
    "Đỗ Văn An", "Nguyễn Văn An", "Lê Thị Ánh", "Võ Thị Ăn", "Phạm Thị Ân",
    "Nguyễn Thị Bảo", "Bùi Văn Dũng", "Hoàng Duy", "Trần Văn Đức",
  ]);
});

async function classSetup() {
  const ctx = makeApp();
  const t = createUser(ctx.db, { username: "cohanh" });
  ctx.classId = createClass(ctx.db, { teacherId: t });
  createStudent(ctx.db, ctx.classId, "Hồ Đức Trí");
  ctx.c = await loggedIn(ctx.app, "cohanh");
  return ctx;
}

test("API nhập hàng loạt: xem trước không lưu; lưu chỉ khi không còn lỗi", async () => {
  const { c, db, classId } = await classSetup();
  const count = () => db.prepare("SELECT COUNT(*) n FROM students WHERE class_id = ?").get(classId).n;

  const preview = await c.post(`/api/classes/${classId}/students/import/preview`, {
    text: "Họ và tên\tNgày sinh\tGiới tính\nNguyễn Minh Anh\t05/09/2018\tNữ\nHồ Đức Trí\t\t\nTrần Gia Bảo\t40/01/2018\tNam",
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.validCount, 1);
  assert.equal(preview.body.errorCount, 2);
  assert.equal(count(), 1, "xem trước chưa lưu gì");

  const bad = await c.post(`/api/classes/${classId}/students/import`, {
    rows: [{ fullName: "Lê Ngọc Châu" }, { fullName: "" }],
  });
  assert.equal(bad.status, 400);
  assert.equal(count(), 1, "có dòng lỗi thì không lưu dòng nào");

  const valid = preview.body.rows.filter((r) => !r.errors.length).map((r) => r.value);
  const ok = await c.post(`/api/classes/${classId}/students/import`, { rows: valid });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.inserted, 1);
  assert.equal(count(), 2);

  const again = await c.post(`/api/classes/${classId}/students/import`, { rows: valid });
  assert.equal(again.status, 400, "không nhập trùng lần hai");

  const data = (await c.get(`/api/classes/${classId}/data`)).body;
  assert.deepEqual(data.students.map((s) => s.fullName), ["Nguyễn Minh Anh", "Hồ Đức Trí"]);
  assert.equal(data.students[0].dob, "2018-09-05");
});

test("API nhập hàng loạt: tải lên file .xlsx", async () => {
  const { c, classId } = await classSetup();
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("DS").addRows([["Họ và tên", "Số điện thoại"], ["Ngô Bảo Nam", "0912345678"], ["Mai Diệu Thảo", "abc"]]);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const res = await c.agent.post(`/api/classes/${classId}/students/import/preview?name=ds.xlsx`)
    .set("X-CSRF-Token", c.csrf).set("Content-Type", "application/octet-stream").send(buf);
  assert.equal(res.status, 200);
  assert.equal(res.body.validCount, 1);
  assert.equal(res.body.rows[1].line, 3);

  const xls = await c.agent.post(`/api/classes/${classId}/students/import/preview?name=ds.xls`)
    .set("X-CSRF-Token", c.csrf).set("Content-Type", "application/octet-stream").send(Buffer.from("abc"));
  assert.equal(xls.status, 400);
  assert.match(xls.body.error, /xlsx/);
});

test("API học sinh: thêm, sửa, xóa kèm dữ liệu liên quan", async () => {
  const { c, db, classId } = await classSetup();
  const add = await c.post(`/api/classes/${classId}/students`, { fullName: "Đặng Khánh Linh", dob: "2018-04-12", gender: "F", parentPhone: "0911222333" });
  assert.equal(add.status, 201);
  const id = add.body.student.id;
  assert.equal((await c.post(`/api/classes/${classId}/students`, { fullName: "" })).status, 400);
  assert.equal((await c.put(`/api/students/${id}`, { fullName: "Đặng Khánh Linh", parentPhone: "99" })).status, 400);

  await c.post(`/api/classes/${classId}/stars`, { studentId: id, date: "2026-10-06", delta: 1, reason: "Tiến bộ" });
  assert.equal((await c.delete(`/api/students/${id}`)).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM stars").get().n, 0);
});

test("API: lưu và đọc lại phụ huynh thứ hai", async () => {
  const { c, classId } = await classSetup();
  const preview = await c.post(`/api/classes/${classId}/students/import/preview`, {
    text: "Họ và tên trẻ\tHọ và tên mẹ\tSố điện thoại mẹ\tHọ và tên bố\tSố điện thoại bố\nLê Bảo An\tPhạm Thị Hoa\t912000111\tLê Văn Tùng\t988000222",
  });
  assert.equal(preview.body.validCount, 1);
  const rows = preview.body.rows.map((r) => r.value);
  assert.equal((await c.post(`/api/classes/${classId}/students/import`, { rows })).status, 201);
  const st = (await c.get(`/api/classes/${classId}/data`)).body.students.find((s) => s.fullName === "Lê Bảo An");
  assert.equal(st.parentName, "Phạm Thị Hoa");
  assert.equal(st.parent2Name, "Lê Văn Tùng");
  assert.equal(st.parent2Phone, "0988000222");

  const upd = await c.put(`/api/students/${st.id}`, { ...st, parent2Phone: "123" });
  assert.equal(upd.status, 400);
  assert.match(upd.body.error, /phụ huynh thứ hai/);
});
