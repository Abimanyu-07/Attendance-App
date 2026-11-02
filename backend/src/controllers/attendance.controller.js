import { Attendance, Batch, Student, Teacher } from '../models/index.js';
import { HttpError, todayIST, isValidDate, isValidMonth } from '../utils/index.js';
import { notifyAbsences } from '../services/notify.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayOf = (date) => DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];

// Teachers may only mark attendance for batches assigned to them; admins may mark any
async function assertCanMark(user, batch) {
  if (user.role === 'admin') return;
  const teacher = await Teacher.findOne({ user: user.id }).select('_id');
  if (!teacher || String(batch.teacher) !== String(teacher._id)) {
    throw new HttpError(403, 'This batch is not assigned to you');
  }
}

/** Students of a batch plus their status for a date (used by the teacher's mobile screen). */
export async function getBatchRoster(req, res) {
  const date = req.query.date || todayIST();
  if (!isValidDate(date)) throw new HttpError(400, 'Date must be YYYY-MM-DD');

  const batch = await Batch.findById(req.params.batchId).populate('classRef', 'name').populate('teacher', 'name');
  if (!batch) throw new HttpError(404, 'Batch not found');
  await assertCanMark(req.user, batch);

  const [students, records] = await Promise.all([
    Student.find({ batches: batch._id, status: 'active' }).select('name studentId').sort({ name: 1 }).lean(),
    Attendance.find({ batch: batch._id, date }).lean(),
  ]);
  const statusBy = new Map(records.map((r) => [String(r.student), r.status]));

  res.json({
    batch: { _id: batch._id, name: batch.name, subject: batch.subject, startTime: batch.startTime, endTime: batch.endTime, room: batch.room, className: batch.classRef?.name },
    date,
    marked: records.length > 0,
    students: students.map((s) => ({ ...s, status: statusBy.get(String(s._id)) || 'present' })),
  });
}

/** Saves attendance for a batch on a date (upsert, so teachers can correct it). */
export async function markAttendance(req, res) {
  const { date = todayIST(), records = [] } = req.body;
  if (!isValidDate(date)) throw new HttpError(400, 'Date must be YYYY-MM-DD');
  if (!Array.isArray(records) || !records.length) throw new HttpError(400, 'No attendance records supplied');

  const batch = await Batch.findById(req.params.batchId);
  if (!batch) throw new HttpError(404, 'Batch not found');
  await assertCanMark(req.user, batch);

  // Only students enrolled in this batch can be marked
  const enrolled = new Set(
    (await Student.find({ batches: batch._id, status: 'active' }).select('_id').lean()).map((s) => String(s._id))
  );
  const valid = records.filter((r) => enrolled.has(String(r.student)) && ['present', 'absent', 'late'].includes(r.status));

  await Attendance.bulkWrite(
    valid.map((r) => ({
      updateOne: {
        filter: { batch: batch._id, student: r.student, date },
        update: { $set: { status: r.status, markedBy: req.user.id } },
        upsert: true,
      },
    }))
  );

  // Notify parents about students who are absent and have not been notified yet
  const absentIds = valid.filter((r) => r.status === 'absent').map((r) => r.student);
  const pending = await Attendance.find({ batch: batch._id, date, student: { $in: absentIds }, parentNotified: false })
    .select('student')
    .lean();
  const notified = await notifyAbsences(batch, date, pending.map((p) => String(p.student)));

  res.json({
    message: 'Attendance saved',
    saved: valid.length,
    absent: absentIds.length,
    parentsNotified: notified,
  });
}

/** Admin dashboard: today's totals and how many of today's batches have been marked. */
export async function todaySummary(req, res) {
  const date = req.query.date || todayIST();
  const [counts, todaysBatches, marked] = await Promise.all([
    Attendance.aggregate([{ $match: { date } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Batch.find({ active: true, days: dayOf(date) }).select('_id name').lean(),
    Attendance.distinct('batch', { date }),
  ]);
  const get = (s) => counts.find((c) => c._id === s)?.count || 0;
  const markedSet = new Set(marked.map(String));
  res.json({
    date,
    present: get('present'),
    absent: get('absent'),
    late: get('late'),
    batchesToday: todaysBatches.length,
    batchesMarked: todaysBatches.filter((b) => markedSet.has(String(b._id))).length,
  });
}

/** Attendance history for one student, optionally for a month (YYYY-MM). */
export async function studentAttendance(req, res) {
  const { month } = req.query;
  const filter = { student: req.params.studentId };
  if (month) {
    if (!isValidMonth(month)) throw new HttpError(400, 'Month must be YYYY-MM');
    filter.date = { $regex: `^${month}` };
  }
  const records = await Attendance.find(filter).populate('batch', 'name subject').sort({ date: -1 }).lean();
  const totals = records.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1, total: acc.total + 1 }),
    { present: 0, absent: 0, late: 0, total: 0 }
  );
  const attended = totals.present + totals.late;
  res.json({
    records,
    totals,
    percentage: totals.total ? Math.round((attended / totals.total) * 100) : 0,
  });
}
