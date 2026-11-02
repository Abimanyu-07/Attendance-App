// Parent and teacher self-service endpoints
import { Parent, Student, Teacher, Batch, Attendance, Fee } from '../models/index.js';
import { HttpError, todayIST, isValidMonth } from '../utils/index.js';

// ---------- PARENT ----------

// A parent may only see their own children
async function ownChild(user, studentId) {
  const parent = await Parent.findOne({ user: user.id }).select('_id name');
  if (!parent) throw new HttpError(403, 'No parent profile linked to this account');
  const student = await Student.findOne({ _id: studentId, parent: parent._id })
    .populate('grade', 'name')
    .populate('batches', 'name subject startTime endTime days room monthlyFee')
    .lean();
  if (!student) throw new HttpError(404, 'Child not found');
  return { parent, student };
}

export async function myChildren(req, res) {
  const parent = await Parent.findOne({ user: req.user.id }).select('_id name phone');
  if (!parent) throw new HttpError(403, 'No parent profile linked to this account');
  const students = await Student.find({ parent: parent._id })
    .populate('grade', 'name')
    .populate('batches', 'name subject startTime endTime days')
    .sort({ name: 1 })
    .lean();
  res.json({ parent, children: students });
}

export async function childAttendance(req, res) {
  const { student } = await ownChild(req.user, req.params.studentId);
  const { month } = req.query;
  const filter = { student: student._id };
  if (month) {
    if (!isValidMonth(month)) throw new HttpError(400, 'Month must be YYYY-MM');
    filter.date = { $regex: `^${month}` };
  }
  const records = await Attendance.find(filter).populate('batch', 'name subject').sort({ date: -1 }).limit(200).lean();
  const present = records.filter((r) => r.status !== 'absent').length;
  res.json({
    student: { _id: student._id, name: student.name, studentId: student.studentId },
    records,
    percentage: records.length ? Math.round((present / records.length) * 100) : 0,
  });
}

export async function childFees(req, res) {
  const { student } = await ownChild(req.user, req.params.studentId);
  const fees = await Fee.find({ student: student._id }).populate('batch', 'name subject').sort({ month: -1 }).lean();
  const today = todayIST();
  res.json({
    student: { _id: student._id, name: student.name },
    fees: fees.map((f) => ({
      ...f,
      status: f.status === 'paid' ? 'paid' : f.dueDate < today ? 'overdue' : 'pending',
    })),
    outstanding: fees.filter((f) => f.status !== 'paid').reduce((sum, f) => sum + f.amount, 0),
  });
}

// ---------- TEACHER ----------

export async function myBatches(req, res) {
  const teacher = await Teacher.findOne({ user: req.user.id }).select('_id name subjects');
  if (!teacher) throw new HttpError(403, 'No teacher profile linked to this account');
  const today = todayIST();
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${today}T00:00:00Z`).getUTCDay()];

  const batches = await Batch.find({ teacher: teacher._id, active: true })
    .populate('classRef', 'name')
    .sort({ startTime: 1 })
    .lean();
  const marked = new Set((await Attendance.distinct('batch', { date: today, batch: { $in: batches.map((b) => b._id) } })).map(String));

  res.json({
    teacher,
    today,
    batches: batches.map((b) => ({
      ...b,
      classroom: b.classRef?.name,
      meetsToday: b.days.includes(dayName),
      markedToday: marked.has(String(b._id)),
    })),
  });
}
