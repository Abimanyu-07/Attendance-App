import { Counter } from '../models/index.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wraps async route handlers so errors reach the error middleware
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// The centre operates in India, so "today" is computed in IST (UTC+05:30)
export const todayIST = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
export const currentMonthIST = () => todayIST().slice(0, 7);
export const isValidMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

// Generates IDs like STU-0001, TCH-0002 using an atomic counter
export async function nextId(key, prefix) {
  const c = await Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${prefix}-${String(c.seq).padStart(4, '0')}`;
}

// Escape user input before using it inside a RegExp
export const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Parse ?page=&limit= safely
export function paginate(query, defaultLimit = 20) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 200);
  return { page, limit, skip: (page - 1) * limit };
}
