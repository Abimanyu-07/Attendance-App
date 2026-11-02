import { Fee, Batch, Student } from '../models/index.js';
import { HttpError, isValidMonth, isValidDate, paginate, todayIST, currentMonthIST, escapeRegex } from '../utils/index.js';
import { generateFeesForMonth, refreshOverdue } from '../services/fees.js';
import { sendFeeReminders, sendWhatsApp } from '../services/notify.js';

/** Create this month's fees for all active students (idempotent). */
export async function generateFees(req, res) {
  const month = req.body.month || currentMonthIST();
  if (!isValidMonth(month)) throw new HttpError(400, 'Month must be YYYY-MM');
  const result = await generateFeesForMonth(month);
  res.json({ month, ...result, message: `${result.created} new fee record(s) created` });
}

/**
 * List fees. Filters: status (pending|paid|overdue), batch, month, student, search.
 * "overdue" is computed from the due date so it is always up to date.
 */
export async function listFees(req, res) {
  await refreshOverdue();
  const { status, batch, month, student, from, to } = req.query;
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (status) filter.status = status;
  if (batch) filter.batch = batch;
  if (month) filter.month = month;
  if (student) filter.student = student;
  if (from || to) {
    filter.dueDate = {};
    if (from) filter.dueDate.$gte = from;
    if (to) filter.dueDate.$lte = to;
  }
  if (req.query.search) {
    const ids = (await Student.find({ name: new RegExp(escapeRegex(req.query.search), 'i') }).select('_id')).map((s) => s._id);
    filter.student = { $in: ids };
  }

  const [items, total, totals] = await Promise.all([
    Fee.find(filter)
      .populate({ path: 'student', select: 'name studentId parent', populate: { path: 'parent', select: 'name phone' } })
      .populate('batch', 'name subject')
      .sort({ dueDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Fee.countDocuments(filter),
    Fee.aggregate([
      { $match: filter },
      { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);
  const summary = { paid: 0, pending: 0, overdue: 0, paidCount: 0, pendingCount: 0, overdueCount: 0 };
  for (const t of totals) {
    summary[t._id] = t.amount;
    summary[`${t._id}Count`] = t.count;
  }
  res.json({ items, total, page, pages: Math.ceil(total / limit), summary });
}

/** Full payment history for one student. */
export async function studentFees(req, res) {
  const fees = await Fee.find({ student: req.params.studentId }).populate('batch', 'name subject').sort({ month: -1 }).lean();
  res.json(fees);
}

/** Record a payment against a fee. */
export async function recordPayment(req, res) {
  const { paymentDate = todayIST(), paymentMethod, reference = '' } = req.body;
  if (!paymentMethod) throw new HttpError(400, 'Payment method is required');
  if (!isValidDate(paymentDate)) throw new HttpError(400, 'Payment date must be YYYY-MM-DD');

  const fee = await Fee.findById(req.params.id).populate({ path: 'student', select: 'name parent', populate: { path: 'parent', select: 'name phone' } }).populate('batch', 'name');
  if (!fee) throw new HttpError(404, 'Fee record not found');
  if (fee.status === 'paid') throw new HttpError(400, 'This fee is already paid');

  Object.assign(fee, { status: 'paid', paymentDate, paymentMethod, reference });
  await fee.save();

  // Send a receipt to the parent (logged as skipped when WhatsApp is not configured)
  const parent = fee.student?.parent;
  if (parent?.phone) {
    await sendWhatsApp({
      to: parent.phone,
      type: 'payment_receipt',
      student: fee.student._id,
      message: `Payment received: Rs.${fee.amount} for ${fee.student.name} (${fee.batch.name}, ${fee.month}) on ${paymentDate}. Ref: ${reference || '-'}. Thank you!`,
    });
  }
  res.json(fee);
}

/** Admin can undo a wrongly recorded payment. */
export async function reopenFee(req, res) {
  const fee = await Fee.findByIdAndUpdate(
    req.params.id,
    { status: 'pending', paymentDate: undefined, paymentMethod: undefined, reference: undefined },
    { new: true }
  );
  if (!fee) throw new HttpError(404, 'Fee record not found');
  await refreshOverdue();
  res.json(fee);
}

/** Send WhatsApp reminders to parents for pending/overdue fees. */
export async function sendReminders(req, res) {
  const { month, feeIds } = req.body;
  if (month && !isValidMonth(month)) throw new HttpError(400, 'Month must be YYYY-MM');
  await refreshOverdue();
  const result = await sendFeeReminders({ month, feeIds });
  res.json({ ...result, message: `Reminders sent to ${result.sent} of ${result.targeted} parent(s)` });
}

/** Per-batch collection report for a month. */
export async function feeSummary(req, res) {
  await refreshOverdue();
  const month = req.query.month || currentMonthIST();
  if (!isValidMonth(month)) throw new HttpError(400, 'Month must be YYYY-MM');
  const rows = await Fee.aggregate([
    { $match: { month } },
    {
      $group: {
        _id: { batch: '$batch', status: '$status' },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);
  const batches = await Batch.find().select('name subject').lean();
  const byBatch = new Map(batches.map((b) => [String(b._id), { batch: b.name, subject: b.subject, paid: 0, pending: 0, overdue: 0, total: 0 }]));
  for (const r of rows) {
    const row = byBatch.get(String(r._id.batch));
    if (!row) continue;
    row[r._id.status] += r.amount;
    row.total += r.amount;
  }
  res.json({ month, batches: [...byBatch.values()].filter((b) => b.total > 0) });
}
