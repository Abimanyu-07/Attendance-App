import { Fee, Student, Batch } from '../models/index.js';
import { todayIST } from '../utils/index.js';

/**
 * Creates one fee per (active student × batch they attend) for the given month.
 * Safe to run repeatedly: existing fees are never overwritten.
 * Fees are due on the 5th of the month.
 */
export async function generateFeesForMonth(month) {
  const students = await Student.find({ status: 'active', batches: { $exists: true, $ne: [] } }).select('batches');
  const batches = await Batch.find({ active: true }).select('monthlyFee');
  const feeByBatch = new Map(batches.map((b) => [String(b._id), b.monthlyFee]));

  const ops = [];
  for (const student of students) {
    for (const batchId of student.batches) {
      const amount = feeByBatch.get(String(batchId));
      if (amount === undefined) continue; // batch inactive or missing
      ops.push({
        updateOne: {
          filter: { student: student._id, batch: batchId, month },
          update: {
            $setOnInsert: {
              student: student._id,
              batch: batchId,
              month,
              amount,
              dueDate: `${month}-05`,
              status: 'pending',
            },
          },
          upsert: true,
        },
      });
    }
  }
  if (!ops.length) return { created: 0 };
  const result = await Fee.bulkWrite(ops);
  return { created: result.upsertedCount };
}

/** Marks pending fees whose due date has passed as overdue. */
export async function refreshOverdue() {
  await Fee.updateMany({ status: 'pending', dueDate: { $lt: todayIST() } }, { $set: { status: 'overdue' } });
}
