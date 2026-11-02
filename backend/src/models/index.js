import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const timestamps = { timestamps: true };

// Auto-increment counters for human-readable IDs (STU-0001, TCH-0001 ...)
const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = model('Counter', counterSchema);

// ---------- Login accounts (one per admin / teacher / parent) ----------
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'teacher', 'parent'], required: true },
    active: { type: Boolean, default: true },
  },
  timestamps
);
export const User = model('User', userSchema);

// ---------- Parent ----------
const parentSchema = new Schema(
  {
    parentId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    active: { type: Boolean, default: true },
  },
  timestamps
);
export const Parent = model('Parent', parentSchema);

// ---------- Teacher ----------
const teacherSchema = new Schema(
  {
    teacherId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    subjects: [{ type: String, trim: true }],
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    active: { type: Boolean, default: true },
  },
  timestamps
);
export const Teacher = model('Teacher', teacherSchema);

// ---------- Class (e.g. 10th Standard) ----------
const classSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  timestamps
);
export const ClassModel = model('Class', classSchema);

// ---------- Batch (a class can have many batches) ----------
const batchSchema = new Schema(
  {
    batchId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    classRef: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher' },
    subject: { type: String, required: true, trim: true },
    days: [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
    startTime: { type: String, required: true }, // "16:00"
    endTime: { type: String, required: true },   // "17:30"
    room: { type: String, trim: true, default: '' },
    monthlyFee: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  timestamps
);
batchSchema.index({ classRef: 1 });
batchSchema.index({ teacher: 1 });
export const Batch = model('Batch', batchSchema);

// ---------- Student ----------
const studentSchema = new Schema(
  {
    studentId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    grade: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    batches: [{ type: Schema.Types.ObjectId, ref: 'Batch' }],
    parent: { type: Schema.Types.ObjectId, ref: 'Parent', required: true },
    admissionDate: { type: String, required: true }, // YYYY-MM-DD
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  timestamps
);
studentSchema.index({ name: 'text', studentId: 'text' });
studentSchema.index({ grade: 1, status: 1 });
studentSchema.index({ batches: 1 });
studentSchema.index({ parent: 1 });
export const Student = model('Student', studentSchema);

// ---------- Attendance (one record per student, batch and date) ----------
const attendanceSchema = new Schema(
  {
    batch: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD (IST)
    status: { type: String, enum: ['present', 'absent', 'late'], required: true },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    parentNotified: { type: Boolean, default: false },
  },
  timestamps
);
attendanceSchema.index({ batch: 1, student: 1, date: 1 }, { unique: true });
attendanceSchema.index({ student: 1, date: 1 });
attendanceSchema.index({ date: 1 });
export const Attendance = model('Attendance', attendanceSchema);

// ---------- Monthly fee (one per student, batch and month) ----------
const feeSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    batch: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    month: { type: String, required: true }, // YYYY-MM
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: String, required: true }, // YYYY-MM-DD
    status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
    paymentDate: { type: String },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'bank', 'card', 'other'] },
    reference: { type: String, trim: true },
    remindersSent: { type: Number, default: 0 },
    lastReminderAt: { type: Date },
  },
  timestamps
);
feeSchema.index({ student: 1, batch: 1, month: 1 }, { unique: true });
feeSchema.index({ month: 1, status: 1 });
feeSchema.index({ batch: 1 });
export const Fee = model('Fee', feeSchema);

// ---------- Notification log (WhatsApp messages sent or attempted) ----------
const notificationSchema = new Schema(
  {
    phone: { type: String, required: true },
    type: { type: String, enum: ['absence', 'fee_reminder', 'payment_receipt', 'custom'], required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
    error: { type: String },
    student: { type: Schema.Types.ObjectId, ref: 'Student' },
    recipient: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  timestamps
);
notificationSchema.index({ createdAt: -1 });
export const Notification = model('Notification', notificationSchema);
