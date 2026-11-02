// Classes (10th Standard ...) and Batches (Batch A, B, C of a class)
import { ClassModel, Batch, Student } from '../models/index.js';
import { HttpError, nextId } from '../utils/index.js';

// ================= CLASSES =================
export async function listClasses(req, res) {
  const classes = await ClassModel.find().sort({ order: 1, name: 1 }).lean();
  const counts = await Student.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$grade', students: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.students]));
  res.json(classes.map((c) => ({ ...c, students: byId.get(String(c._id)) || 0 })));
}

export async function createClass(req, res) {
  const { name, order = 0 } = req.body;
  if (!name) throw new HttpError(400, 'Class name is required');
  res.status(201).json(await ClassModel.create({ name, order }));
}

export async function updateClass(req, res) {
  const cls = await ClassModel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!cls) throw new HttpError(404, 'Class not found');
  res.json(cls);
}

// ================= BATCHES =================
export async function listBatches(req, res) {
  const { classId, teacher, active } = req.query;
  const filter = {};
  if (classId) filter.classRef = classId;
  if (teacher) filter.teacher = teacher;
  if (active === 'true') filter.active = true;
  if (active === 'false') filter.active = false;

  const batches = (await Batch.find(filter).populate('classRef', 'name order').populate('teacher', 'name phone').lean())
    .sort((a, b) => (a.classRef?.order ?? 0) - (b.classRef?.order ?? 0) || a.name.localeCompare(b.name));

  const enrolments = await Student.aggregate([
    { $match: { status: 'active' } },
    { $unwind: '$batches' },
    { $group: { _id: '$batches', students: { $sum: 1 } } },
  ]);
  const byId = new Map(enrolments.map((e) => [String(e._id), e.students]));
  res.json(batches.map((b) => ({ ...b, students: byId.get(String(b._id)) || 0 })));
}

export async function getBatch(req, res) {
  const batch = await Batch.findById(req.params.id).populate('classRef', 'name').populate('teacher', 'name phone').lean();
  if (!batch) throw new HttpError(404, 'Batch not found');
  const students = await Student.find({ batches: batch._id, status: 'active' }).select('name studentId').sort({ name: 1 }).lean();
  res.json({ ...batch, students });
}

export async function createBatch(req, res) {
  const { name, classRef, teacher, subject, days = [], startTime, endTime, room, monthlyFee } = req.body;
  if (!name || !classRef || !subject || !startTime || !endTime || monthlyFee === undefined) {
    throw new HttpError(400, 'Name, class, subject, start/end time and monthly fee are required');
  }
  const batch = await Batch.create({
    batchId: await nextId('batch', 'BAT'),
    name,
    classRef,
    teacher: teacher || undefined,
    subject,
    days,
    startTime,
    endTime,
    room,
    monthlyFee,
  });
  res.status(201).json(batch);
}

export async function updateBatch(req, res) {
  const batch = await Batch.findById(req.params.id);
  if (!batch) throw new HttpError(404, 'Batch not found');
  const fields = ['name', 'classRef', 'teacher', 'subject', 'days', 'startTime', 'endTime', 'room', 'monthlyFee', 'active'];
  for (const f of fields) if (req.body[f] !== undefined) batch[f] = req.body[f] || undefined;
  await batch.save();
  res.json(batch);
}

// A batch with students or fee history is deactivated instead of deleted
export async function deleteBatch(req, res) {
  const batch = await Batch.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!batch) throw new HttpError(404, 'Batch not found');
  res.json({ message: 'Batch deactivated', batch });
}
