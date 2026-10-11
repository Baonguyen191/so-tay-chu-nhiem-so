// Báo cáo tuần/tháng của một lớp (Excel) và bảng tổng hợp toàn trường cho Ban giám hiệu.
import { Router } from "express";
import ExcelJS from "exceljs";
import { getAccessibleClass, requireAdmin, requireAuth } from "../auth.js";
import { badRequest, idParam } from "../http.js";
import { isISODate } from "../../public/js/shared/validate.js";
import { buildAttendance } from "../../public/js/shared/stats.js";
import { classReport, periodRange } from "../../public/js/shared/report.js";
import { reportFileName, reportWorkbook } from "../../public/js/shared/report-xlsx.js";
import { classBundle } from "./classes.js";

function readPeriod(query) {
  const kind = query.kind === "week" ? "week" : query.kind === "month" ? "month" : null;
  if (!kind) throw badRequest("Kỳ báo cáo phải là tuần hoặc tháng");
  if (!isISODate(query.date)) throw badRequest("Ngày không hợp lệ");
  return periodRange(kind, query.date);
}

function reportFor(bundle, period) {
  const att = buildAttendance(bundle.days, bundle.absences);
  return classReport({ students: bundle.students, att, comments: bundle.comments, stars: bundle.stars }, period.from, period.to);
}

export function reportRoutes() {
  const r = Router();

  r.get("/classes/:cid/report.xlsx", requireAuth, async (req, res) => {
    const { db } = req.app.locals;
    const cls = getAccessibleClass(db, req.user, idParam(req.params.cid));
    const period = readPeriod(req.query);
    const bundle = classBundle(db, cls.id);
    const t = bundle.class.teacher;
    const buf = await reportWorkbook(ExcelJS, {
      cls: bundle.class,
      teacher: t ? `${t.title} ${t.fullName}` : "",
      period,
      report: reportFor(bundle, period),
    });
    res.attachment(reportFileName(bundle.class.name, period))
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .send(Buffer.from(buf));
  });

  // Tổng hợp mọi lớp trong kỳ. today: ngày hôm nay theo máy người xem, để biết lớp nào chưa điểm danh.
  r.get("/admin/overview", requireAdmin, (req, res) => {
    const { db } = req.app.locals;
    const period = readPeriod(req.query);
    const today = isISODate(req.query.today) ? req.query.today : null;
    const ids = db.prepare("SELECT id FROM classes ORDER BY school_year DESC, grade, name").pluck().all();
    const takenToday = new Set(today ? db.prepare("SELECT class_id FROM attendance_days WHERE date = ?").pluck().all(today) : []);

    const classes = ids.map((id) => {
      const bundle = classBundle(db, id);
      const t = reportFor(bundle, period).totals;
      return { ...bundle.class, report: t, takenToday: today ? takenToday.has(id) : null };
    });

    const sum = (k) => classes.reduce((a, c) => a + c.report[k], 0);
    const slots = classes.reduce((a, c) => a + c.report.days * c.report.students, 0);
    res.json({
      period,
      classes,
      totals: {
        classes: classes.length,
        students: sum("students"),
        present: sum("present"),
        P: sum("P"),
        K: sum("K"),
        care: sum("care"),
        rate: slots ? Math.round((sum("present") / slots) * 1000) / 10 : null,
        notTakenToday: today ? classes.filter((c) => c.studentCount > 0 && !c.takenToday).length : null,
      },
    });
  });

  return r;
}
