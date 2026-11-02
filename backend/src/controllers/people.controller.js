// Handles Parents, Teachers and Students (admin management)
import bcrypt from 'bcryptjs';
import { User, Parent, Teacher, Student, Batch, Attendance, Fee } from '../models/index.js';
import { HttpError, nextId, escapeRegex, paginate, isValidDate } from '../utils/index.js';

async function createLogin({ name, phone, email, password, role }) {
  if (!phone) throw new HttpError(400, 'Phone number is required');
  const exists = await User.exists({ phone });
  if (exists) throw new HttpError(409, 'A login with this phone number already exists');
  const passwordHash = await bcrypt.hash(password || process.env.DEFAULT_PASSWORD || 'changeme123', 10);
  return User.create({ name, phone, email, passwordHash, role });
}

// ================= PARENTS =================
export async function listParents(req, res) {
  const { search = '' } = req.query;
  const { page, limit, skip } = paginate(req.query);
  const filter = search
    ? { $or: [{ name: new RegExp(escapeRegex(search), 'i') }, { phone: new RegExp(escapeRegex(search)) }, { parentId: new RegExp(escapeRegex(search), 'i') }] }
    : {};
  const [items, total] = await Promise.all([
    Parent.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Parent.countDocuments(filter),
  ]);
  // attach linked children to each parent
  const ids = items.map((p) => p._id);
  const children = await Student.find({ parent: { $in: ids } }).select('name studentId parent status').lean();
  const withChildren = items.map((p) => ({ ...p, children: children.filter((c) => String(c.parent) === String(p._id)) }));
  res.json({ items: withChildren, total, page, pages: Math.ceil(total / limit) });
}

export async function getParent(req, res) {
  const parent = await Parent.findById(req.params.id).lean();
  if (!parent) throw new HttpError(404, 'Parent not found');
  const children = await Student.find({ parent: parent._id }).populate('grade', 'name').populate('batches', 'name subject').lean();
  res.json({ ...parent, children });
}

export async function createParent(req, res) {
  const { name, phone, email, password } = req.body;
  if (!name) throw new HttpError(400, 'Name is required');
  const user = await createLogin({ name, phone, email, password, role: 'parent' });
  try {
    const parent = await Parent.create({
      parentId: await nextId('parent', 'PAR'),
      name,
      phone,
      email,
      user: user._id,
    });
    res.status(201).json(parent);
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // roll back login if profile failed
    throw err;
  }
}

export async function updateParent(req, res) {
  const { name, phone, email, active, password } = req.body;
  const parent = await Parent.findById(req.params.id);
  if (!parent) throw new HttpError(404, 'Parent not found');
  Object.assign(parent, { name, phone, email, active });
  await parent.save();
  const update = { name, phone, active };
  if (password) update.passwordHash = await bcrypt.hash(password, 10);
  await User.updateOne({ _id: parent.user }, update);
  res.json(parent);
}

// ================= TEACHERS =================
export async function listTeachers(req, res) {
  const { search = '', status } = req.query;
  const filter = {};
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');
  if (status === 'active') filter.active = true;
  if (status === 'inactive') filter.active = false;
  const teachers = await Teacher.find(filter).sort({ name: 1 }).lean();
  const batches = await Batch.find({ teacher: { $in: teachers.map((t) => t._id) } }).select('name teacher subject').lean();
  res.json(teachers.map((t) => ({ ...t, batches: batches.filter((b) => String(b.teacher) === String(t._id)) })));
}

export async function getTeacher(req, res) {
  const teacher = await Teacher.findById(req.params.id).lean();
  if (!teacher) throw new HttpError(404, 'Teacher not found');
  const batches = await Batch.find({ teacher: teacher._id }).populate('classRef', 'name').lean();
  res.json({ ...teacher, batches });
}

export async function createTeacher(req, res) {
  const { name, phone, email, subjects = [], password } = req.body;
  if (!name) throw new HttpError(400, 'Name is required');
  const user = await createLogin({ name, phone, email, password, role: 'teacher' });
  try {
    const teacher = await Teacher.create({
      teacherId: await nextId('teacher', 'TCH'),
      name,
      phone,
      email,
      subjects,
      user: user._id,
    });
    res.status(201).json(teacher);
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }
}

export async function updateTeacher(req, res) {
  const { name, phone, email, subjects, active, password } = req.body;
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) throw new HttpError(404, 'Teacher not found');
  Object.assign(teacher, { name, phone, email, subjects, active });
  await teacher.save();
  const update = { name, phone, active };
  if (password) update.passwordHash = await bcrypt.hash(password, 10);
  await User.updateOne({ _id: teacher.user }, update);
  // deactivating a teacher keeps history but they can no longer log in
  res.json(teacher);
}

// ================= STUDENTS =================
export async function listStudents(req, res) {
  const { search = '', grade, batch, status, parent } = req.query;
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { studentId: rx }];
  }
  if (grade) filter.grade = grade;
  if (batch) filter.batches = batch;
  if (parent) filter.parent = parent;
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Student.find(filter)
      .populate('grade', 'name')
      .populate('batches', 'name subject')
      .populate('parent', 'name phone')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Student.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}

export async function getStudent(req, res) {
  const student = await Student.findById(req.params.id)
    .populate('grade', 'name')
    .populate('batches', 'name subject startTime endTime days room monthlyFee')
    .populate('parent', 'name phone email')
    .lean();
  if (!student) throw new HttpError(404, 'Student not found');
  const [attendanceSummary, fees] = await Promise.all([
    Attendance.aggregate([
      { $match: { student: student._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Fee.find({ student: student._id }).populate('batch', 'name').sort({ month: -1 }).lean(),
  ]);
  res.json({ ...student, attendanceSummary, fees });
}

export async function createStudent(req, res) {
  const { name, grade, batches = [], parent, admissionDate, status = 'active' } = req.body;
  if (!name || !grade || !parent) throw new HttpError(400, 'Name, class and parent are required');
  if (admissionDate && !isValidDate(admissionDate)) throw new HttpError(400, 'Admission date must be YYYY-MM-DD');
  const student = await Student.create({
    studentId: await nextId('student', 'STU'),
    name,
    grade,
    batches,
    parent,
    admissionDate: admissionDate || new Date().toISOString().slice(0, 10),
    status,
  });
  res.status(201).json(student);
}

export async function updateStudent(req, res) {
  const allowed = ['name', 'grade', 'batches', 'parent', 'admissionDate', 'status'];
  const student = await Student.findById(req.params.id);
  if (!student) throw new HttpError(404, 'Student not found');
  for (const key of allowed) if (req.body[key] !== undefined) student[key] = req.body[key];
  await student.save();
  res.json(student);
}

// Soft delete: students with attendance/fee history are deactivated, not removed
export async function deactivateStudent(req, res) {
  const student = await Student.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
  if (!student) throw new HttpError(404, 'Student not found');
  res.json({ message: 'Student deactivated', student });
}

export async function reactivateStudent(req, res) {
  const student = await Student.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
  if (!student) throw new HttpError(404, 'Student not found');
  res.json(student);
}
