import { Student, Parent, Teacher, Batch, Attendance, Fee, Notification } from '../models/index.js';
import { HttpError, todayIST, isValidDate } from '../utils/index.js';
import { refreshOverdue } from '../services/fees.js';

/** Admin dashboard: headline counts, today's attendance, pending fees and recent activity. */
export async function dashboard(req, res) {
  await refreshOverdue();
  const today = todayIST();
  const month = today.slice(0, 7);

  const [students, teachers, parents, classes, batches, feeAgg, recentPayments, recentNotifications, attendanceToday] =
    await Promise.all([
      Student.countDocuments({ status: 'active' }),
      Teacher.countDocuments({ active: true }),
      Parent.countDocuments({ active: true }),
      Batch.distinct('classRef', { active: true }).then((ids) => ids.length),
      Batch.countDocuments({ active: true }),
      Fee.aggregate([
        { $match: { month } },
        { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Fee.find({ status: 'paid' })
        .sort({ updatedAt: -1 })
        .limit(6)
        .populate('student', 'name studentId')
        .populate('batch', 'name')
        .lean(),
      Notification.find().sort({ createdAt: -1 }).limit(6).lean(),
      Attendance.aggregate([{ $match: { date: today } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

  const pick = (arr, key, field) => arr.find((x) => x._id === key)?.[field] || 0;
  res.json({
    counts: { students, teachers, parents, classes, batches },
    attendanceToday: {
      date: today,
      present: pick(attendanceToday, 'present', 'count'),
      absent: pick(attendanceToday, 'absent', 'count'),
      late: pick(attendanceToday, 'late', 'count'),
    },
    fees: {
      month,
      paid: pick(feeAgg, 'paid', 'amount'),
      pending: pick(feeAgg, 'pending', 'amount'),
      overdue: pick(feeAgg, 'overdue', 'amount'),
      pendingCount: pick(feeAgg, 'pending', 'count') + pick(feeAgg, 'overdue', 'count'),
    },
    recentPayments,
    recentNotifications,
  });
}

/** Attendance report for a batch (or all batches) over a date range, per student. */
export async function attendanceReport(req, res) {
  const { batch, from, to } = req.query;
  if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, 'from and to must be YYYY-MM-DD');

  const match = { date: { $gte: from, $lte: to } };
  if (batch) match.batch = batch;

  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$student',
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    { $sort: { absent: -1 } },
  ]);

  const students = await Student.find({ _id: { $in: rows.map((r) => r._id) } })
    .select('name studentId grade')
    .populate('grade', 'name')
    .lean();
  const byId = new Map(students.map((s) => [String(s._id), s]));

  const items = rows.map((r) => {
    const s = byId.get(String(r._id)) || {};
    return {
      studentId: s.studentId,
      name: s.name,
      className: s.grade?.name,
      present: r.present,
      late: r.late,
      absent: r.absent,
      total: r.total,
      percentage: r.total ? Math.round(((r.present + r.late) / r.total) * 100) : 0,
    };
  });
  res.json({ from, to, items });
}

/** Simple monthly trend for the attendance chart: daily present/absent counts. */
export async function attendanceTrend(req, res) {
  const { from, to } = req.query;
  if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, 'from and to must be YYYY-MM-DD');
  const rows = await Attendance.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$date',
        present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  res.json(rows.map((r) => ({ date: r._id, present: r.present, absent: r.absent })));
}

/** Notification log for the admin. */
export async function notifications(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  res.json(await Notification.find().sort({ createdAt: -1 }).limit(limit).lean());
}
