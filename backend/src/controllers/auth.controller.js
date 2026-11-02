import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Teacher, Parent } from '../models/index.js';
import { HttpError } from '../utils/index.js';

const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Returns the teacher/parent profile linked to a login account (if any)
async function profileFor(user) {
  if (user.role === 'teacher') return Teacher.findOne({ user: user._id }).select('_id teacherId');
  if (user.role === 'parent') return Parent.findOne({ user: user._id }).select('_id parentId');
  return null;
}

export async function login(req, res) {
  const { phone, password } = req.body;
  if (!phone || !password) throw new HttpError(400, 'Phone and password are required');

  const user = await User.findOne({ phone: String(phone).trim() }).select('+passwordHash');
  if (!user || !user.active) throw new HttpError(401, 'Invalid phone number or password');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'Invalid phone number or password');

  const profile = await profileFor(user);
  res.json({
    token: signToken(user),
    user: {
      id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      profileId: profile?._id,
    },
  });
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  const profile = await profileFor(user);
  res.json({
    id: user._id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    profileId: profile?._id,
  });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) throw new HttpError(400, 'New password must be at least 6 characters');

  const user = await User.findById(req.user.id).select('+passwordHash');
  const ok = await bcrypt.compare(currentPassword || '', user.passwordHash);
  if (!ok) throw new HttpError(400, 'Current password is incorrect');

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: 'Password updated' });
}
