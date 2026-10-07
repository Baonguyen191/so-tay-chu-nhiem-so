// Ghép bản giáo viên (chạy trong trình duyệt, không cần máy chủ) vào thư mục dist-pages/ để đưa lên GitHub Pages.
// Dùng lại giao diện của public/, thay public/js/api.js và app.js bằng bản trong pages/.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../server/config.js";
import { templateCsv, templateXlsx } from "../server/lib/template.js";

const OUT = path.join(ROOT, "dist-pages");
const pub = (...p) => path.join(ROOT, "public", ...p);
const out = (...p) => path.join(OUT, ...p);
const copy = (from, to) => fs.cpSync(from, to, { recursive: true });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(out("js", "views"), { recursive: true });

copy(pub("css"), out("css"));
copy(pub("js", "shared"), out("js", "shared"));
for (const f of ["theme.js", "util.js", "store.js"]) copy(pub("js", f), out("js", f));
for (const v of ["home", "att", "cmt", "star", "msg", "student", "import"]) copy(pub("js", "views", v + ".js"), out("js", "views", v + ".js"));

// Phần riêng của bản giáo viên (ghi đè lên phần trên).
copy(path.join(ROOT, "pages"), OUT);

fs.mkdirSync(out("mau"));
fs.writeFileSync(out("mau", "mau-nhap-hoc-sinh.xlsx"), await templateXlsx());
fs.writeFileSync(out("mau", "mau-nhap-hoc-sinh.csv"), templateCsv());
fs.writeFileSync(out(".nojekyll"), "");

console.log("Đã tạo bản giáo viên trong", OUT);
