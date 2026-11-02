import axios from 'axios';
import { Notification, Attendance, Fee, Student } from '../models/index.js';
import { todayIST } from '../utils/index.js';

const CENTRE = () => process.env.CENTRE_NAME || 'Smart Tuition Centre';

// Indian mobile numbers are stored as 10 digits; WhatsApp needs country code 91
export function normalisePhone(phone = '') {
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

/**
 * Sends a WhatsApp text via Meta's WhatsApp Cloud API.
 * If credentials are not configured (local development), the message is
 * logged and stored as "skipped" so the rest of the app still works.
 */
export async function sendWhatsApp({ to, message, type, student, recipient }) {
  const phone = normalisePhone(to);
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_ID } = process.env;
  let status = 'skipped';
  let error;

  if (WHATSAPP_TOKEN && WHATSAPP_PHONE_ID && phone) {
    try {
      await axios.post(
        `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
        { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }, timeout: 10000 }
      );
      status = 'sent';
    } catch (err) {
      status = 'failed';
      error = err.response?.data?.error?.message || err.message;
    }
  } else {
    console.log(`[WhatsApp dry-run] -> ${phone}: ${message}`);
  }

  await Notification.create({ phone, type, message, status, error, student, recipient });
  return status;
}

/** Tell the parent(s) that their child was absent. Only notifies once per record. */
export async function notifyAbsences(batch, date, studentIds) {
  if (!studentIds.length) return 0;
  const students = await Student.find({ _id: { $in: studentIds } }).populate('parent', 'phone name');
  let count = 0;
  for (const s of students) {
    if (!s.parent?.phone) continue;
    const message =
      `Dear ${s.parent.name}, ${s.name} was marked ABSENT from ${batch.name} (${batch.subject}) on ${date}. ` +
      `Please contact us if this is unexpected. - ${CENTRE()}`;
    await sendWhatsApp({ to: s.parent.phone, message, type: 'absence', student: s._id });
    count += 1;
  }
  await Attendance.updateMany({ batch: batch._id, date, student: { $in: studentIds } }, { parentNotified: true });
  return count;
}

/** Send fee reminders for pending or overdue fees (optionally limited to a list of fee IDs). */
export async function sendFeeReminders({ month, feeIds } = {}) {
  const filter = { status: { $in: ['pending', 'overdue'] } };
  if (month) filter.month = month;
  if (feeIds?.length) filter._id = { $in: feeIds };

  const fees = await Fee.find(filter)
    .populate({ path: 'student', select: 'name parent', populate: { path: 'parent', select: 'phone name' } })
    .populate('batch', 'name');

  let sent = 0;
  for (const fee of fees) {
    const parent = fee.student?.parent;
    if (!parent?.phone) continue;
    const overdue = fee.dueDate < todayIST();
    const message =
      `Dear ${parent.name}, this is a ${overdue ? 'reminder that the fee is OVERDUE' : 'friendly reminder'} ` +
      `for ${fee.student.name} (${fee.batch.name}) for ${fee.month}. ` +
      `Amount: Rs.${fee.amount}. Due date: ${fee.dueDate}. Thank you. - ${CENTRE()}`;
    const status = await sendWhatsApp({ to: parent.phone, message, type: 'fee_reminder', student: fee.student._id });
    if (status !== 'failed') {
      fee.remindersSent += 1;
      fee.lastReminderAt = new Date();
      await fee.save();
      sent += 1;
    }
  }
  return { targeted: fees.length, sent };
}
