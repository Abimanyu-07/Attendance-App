import jwt from 'jsonwebtoken';
import { HttpError } from '../utils/index.js';
import { User } from '../models/index.js';

// Verifies the JWT and attaches req.user = { id, role, name }
export async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please log in to continue'));

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new HttpError(401, 'Your session has expired. Please log in again'));
  }

  try {
    const user = await User.findById(payload.sub).select('name role active');
    if (!user || !user.active) return next(new HttpError(401, 'This account is inactive'));
    req.user = { id: user._id, role: user.role, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}

// Role-based access: authorize('admin') or authorize('admin', 'teacher')
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to perform this action'));
    }
    next();
  };

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid value for ${err.path}` });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ message: `Duplicate value for ${field}` });
  }
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Something went wrong on the server' : err.message });
}
