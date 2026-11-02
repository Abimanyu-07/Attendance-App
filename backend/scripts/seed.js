// Run with: npm run seed   (creates demo data for the PBL demonstration)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { User, Parent, Teacher, ClassModel, Batch, Student, Counter, Attendance, Fee } from '../src/models/index.js';
import { generateFeesForMonth } from '../src/services/fees.js';
import { currentMonthIST } from '../src/utils/index.js';

await connectDB();
console.log('Clearing existing data...');
await Promise.all([
  User.deleteMany({}), Parent.deleteMany({}), Teacher.deleteMany({}), ClassModel.deleteMany({}),
  Batch.deleteMany({}), Student.deleteMany({}), Counter.deleteMany({}), Attendance.deleteMany({}), Fee.deleteMany({}),
]);

const pw = await bcrypt.hash('password123', 10);

// ---- Admin ----
await User.create({ name: 'Centre Admin', phone: '9000000001', email: 'admin@centre.test', passwordHash: pw, role: 'admin' });

// ---- Classes ----
const [c10, c11, c12] = await ClassModel.create([
  { name: '10th Standard', order: 1 },
  { name: '11th Standard', order: 2 },
  { name: '12th Standard', order: 3 },
]);

// ---- Teachers ----
const teacherData = [
  { name: 'Ramesh Kumar', phone: '9000000002', subjects: ['Mathematics'] },
  { name: 'Priya Sharma', phone: '9000000003', subjects: ['Physics', 'Chemistry'] },
];
const teachers = [];
for (const [i, t] of teacherData.entries()) {
  const user = await User.create({ name: t.name, phone: t.phone, passwordHash: pw, role: 'teacher' });
  teachers.push(await Teacher.create({ teacherId: `TCH-${String(i + 1).padStart(4, '0')}`, ...t, user: user._id }));
}
await Counter.updateOne({ _id: 'teacher' }, { seq: teachers.length }, { upsert: true });

// ---- Batches ----
const batchSpecs = [
  { name: 'Batch A', classRef: c10, teacher: teachers[0], subject: 'Mathematics', days: ['Mon', 'Wed', 'Fri'], startTime: '16:00', endTime: '17:30', room: 'Room 1', monthlyFee: 1200 },
  { name: 'Batch B', classRef: c10, teacher: teachers[1], subject: 'Physics', days: ['Tue', 'Thu'], startTime: '18:00', endTime: '19:30', room: 'Room 2', monthlyFee: 1000 },
  { name: 'Batch A', classRef: c12, teacher: teachers[1], subject: 'Chemistry', days: ['Mon', 'Wed', 'Sat'], startTime: '17:00', endTime: '18:30', room: 'Room 3', monthlyFee: 1500 },
];
const batches = [];
for (const [i, b] of batchSpecs.entries()) {
  batches.push(await Batch.create({ batchId: `BAT-${String(i + 1).padStart(4, '0')}`, ...b }));
}
await Counter.updateOne({ _id: 'batch' }, { seq: batches.length }, { upsert: true });

// ---- Parents + students ----
const families = [
  { parent: 'Suresh Iyer', phone: '9100000001', kids: [{ name: 'Arjun Iyer', grade: c10, batchIdx: [0, 1] }] },
  { parent: 'Lakshmi Raman', phone: '9100000002', kids: [{ name: 'Meera Raman', grade: c10, batchIdx: [0] }, { name: 'Vikram Raman', grade: c12, batchIdx: [2] }] },
  { parent: 'Anand Menon', phone: '9100000003', kids: [{ name: 'Sneha Menon', grade: c12, batchIdx: [2] }] },
];
let stuSeq = 0;
let parSeq = 0;
for (const fam of families) {
  const user = await User.create({ name: fam.parent, phone: fam.phone, passwordHash: pw, role: 'parent' });
  const parent = await Parent.create({ parentId: `PAR-${String(++parSeq).padStart(4, '0')}`, name: fam.parent, phone: fam.phone, user: user._id });
  for (const kid of fam.kids) {
    await Student.create({
      studentId: `STU-${String(++stuSeq).padStart(4, '0')}`,
      name: kid.name,
      grade: kid.grade._id,
      batches: kid.batchIdx.map((i) => batches[i]._id),
      parent: parent._id,
      admissionDate: '2026-04-01',
    });
  }
}
await Counter.updateOne({ _id: 'student' }, { seq: stuSeq }, { upsert: true });
await Counter.updateOne({ _id: 'parent' }, { seq: parSeq }, { upsert: true });

// ---- Fees for the current month ----
await generateFeesForMonth(currentMonthIST());

console.log('Seed complete. Demo logins (password: password123):');
console.log('  Admin   : 9000000001');
console.log('  Teacher : 9000000002 (Ramesh) / 9000000003 (Priya)');
console.log('  Parent  : 9100000001 / 9100000002 / 9100000003');
await mongoose.disconnect();
process.exit(0);
