// Hộp thoại nhập danh sách học sinh: dán từ Excel hoặc tải file .xlsx/.csv → xem trước → lưu.
import { api } from "../api.js";
import { S, reloadClass, ui } from "../store.js";
import { $, $$, closeDialog, esc, fmt, genderLabel, openDialog, toast, withBusy } from "../util.js";

const MAX_FILE = 2 * 1024 * 1024;
const st = { mode: "paste", text: "", file: null, preview: null };

export function openImport() {
  Object.assign(st, { mode: "paste", text: "", file: null, preview: null });
  step1();
}

function step1() {
  const dlg = openDialog(`<form id="impForm" novalidate>
    <div class="dlg-h"><div class="grow"><div class="name">Nhập danh sách học sinh – Lớp ${esc(S.cls.name)}</div>
      <div class="sub">Bước 1/2: đưa danh sách vào</div></div>
      <button class="btn ghost" type="button" data-close>Đóng</button></div>
    <div class="dlg-b">
      <div class="tabs" role="tablist">
        <button type="button" role="tab" data-mode="paste" aria-selected="${st.mode === "paste"}">Dán từ Excel</button>
        <button type="button" role="tab" data-mode="file" aria-selected="${st.mode === "file"}">Tải file lên</button>
      </div>
      <p class="hint" style="margin:0">Thứ tự cột: <b>Họ và tên</b> · Ngày sinh · Giới tính · Họ tên phụ huynh · Số điện thoại · Ghi chú sức khỏe.
        Chỉ Họ và tên là bắt buộc. Có thể kèm dòng tiêu đề và cột STT.</p>
      ${st.mode === "paste"
        ? `<label class="field">Trong Excel, chọn các ô cần nhập, nhấn Ctrl + C, rồi bấm vào ô dưới đây và nhấn Ctrl + V
             <textarea id="impText" rows="10" spellcheck="false" style="font-family:ui-monospace,Consolas,monospace;font-size:14px;white-space:pre;overflow:auto" placeholder="Nguyễn Minh Anh	05/09/2018	Nữ	Nguyễn Văn Hùng	0912345678">${esc(st.text)}</textarea></label>`
        : `<div class="drop"><label class="btn" for="impFile">Chọn file .xlsx hoặc .csv</label>
             <input type="file" id="impFile" accept=".xlsx,.csv" class="sr">
             <div class="sub" id="fileName">${st.file ? esc(st.file.name) : "Chưa chọn file"}</div></div>`}
      <div class="sub">Chưa có danh sách? Tải file mẫu:
        <a href="mau/mau-nhap-hoc-sinh.xlsx" download>Excel (.xlsx)</a> ·
        <a href="mau/mau-nhap-hoc-sinh.csv" download>CSV</a></div>
      <p class="err" id="impErr" role="alert"></p>
    </div>
    <div class="dlg-f"><button class="btn" type="button" data-close>Hủy</button><button class="btn primary" id="impNext">Xem trước</button></div>
  </form>`, { wide: true });

  const keepText = () => {
    const t = $("#impText", dlg);
    if (t) st.text = t.value;
  };
  $$("[data-close]", dlg).forEach((b) => (b.onclick = closeDialog));
  $$("[data-mode]", dlg).forEach((b) => (b.onclick = () => {
    keepText();
    st.mode = b.dataset.mode;
    step1();
  }));
  const fileInput = $("#impFile", dlg);
  if (fileInput) fileInput.onchange = () => {
    st.file = fileInput.files[0] || null;
    $("#fileName", dlg).textContent = st.file ? st.file.name : "Chưa chọn file";
  };
  $("#impText", dlg)?.focus();

  $("#impForm", dlg).onsubmit = (e) => {
    e.preventDefault();
    keepText();
    withBusy($("#impNext", dlg), async () => {
      if (st.mode === "paste") {
        if (!st.text.trim()) throw new Error("Hãy dán danh sách vào ô trên");
        st.preview = await api("POST", `/classes/${S.cls.id}/students/import/preview`, { text: st.text });
      } else {
        if (!st.file) throw new Error("Hãy chọn file cần tải lên");
        if (st.file.size > MAX_FILE) throw new Error("File lớn hơn 2 MB. Hãy chỉ giữ lại trang danh sách học sinh.");
        const buf = await st.file.arrayBuffer();
        st.preview = await api("POST", `/classes/${S.cls.id}/students/import/preview?name=${encodeURIComponent(st.file.name)}`, buf);
      }
      step2();
    }, $("#impErr", dlg));
  };
}

function step2() {
  const p = st.preview;
  const valid = p.rows.filter((r) => !r.errors.length);
  const dlg = openDialog(`<form id="impForm2" novalidate>
    <div class="dlg-h"><div class="grow"><div class="name">Xem trước danh sách – Lớp ${esc(S.cls.name)}</div>
      <div class="sub">Bước 2/2: kiểm tra rồi lưu</div></div>
      <button class="btn ghost" type="button" data-close>Đóng</button></div>
    <div class="dlg-b">
      <div class="row"><span class="tag green">${p.validCount} dòng hợp lệ</span>${p.errorCount ? `<span class="tag red">${p.errorCount} dòng lỗi</span>` : ""}</div>
      ${p.errorCount ? `<p class="notice red" style="margin:0">Các dòng lỗi được tô đỏ và <b>sẽ không được lưu</b>. Thầy/cô có thể quay lại sửa, hoặc lưu các dòng hợp lệ trước rồi nhập bổ sung sau.</p>` : ""}
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Dòng</th><th>Họ và tên</th><th>Ngày sinh</th><th>Giới tính</th><th>Phụ huynh</th><th>Số điện thoại</th><th>Ghi chú sức khỏe</th><th>Kết quả</th></tr></thead>
        <tbody>${p.rows.map((r) => {
          const v = r.value;
          const bad = r.errors.length > 0;
          return `<tr class="${bad ? "bad" : ""}"><td>${r.line}</td><td>${esc(v.fullName)}</td>
            <td>${esc(bad ? v.dob : fmt(v.dob))}</td><td>${esc(bad ? v.gender : genderLabel(v.gender))}</td>
            <td>${esc(v.parentName)}</td><td>${esc(v.parentPhone)}</td><td>${esc(v.healthNote)}</td>
            <td class="${bad ? "errs" : ""}">${bad ? esc(r.errors.join(". ")) : `<span class="tag green">Hợp lệ</span>`}</td></tr>`;
        }).join("")}</tbody></table></div>
      <p class="err" id="impErr2" role="alert"></p>
    </div>
    <div class="dlg-f"><button class="btn" type="button" id="impBack">Quay lại sửa</button>
      <button class="btn primary" id="impSave" ${valid.length ? "" : "disabled"}>Lưu ${valid.length} học sinh${p.errorCount ? " hợp lệ" : ""}</button></div>
  </form>`, { wide: true });

  $$("[data-close]", dlg).forEach((b) => (b.onclick = closeDialog));
  $("#impBack", dlg).onclick = step1;
  $("#impForm2", dlg).onsubmit = (e) => {
    e.preventDefault();
    withBusy($("#impSave", dlg), async () => {
      const res = await api("POST", `/classes/${S.cls.id}/students/import`, { rows: valid.map((r) => r.value) });
      await reloadClass();
      closeDialog();
      ui.render();
      toast(`Đã thêm ${res.inserted} học sinh`);
    }, $("#impErr2", dlg));
  };
}
