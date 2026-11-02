import { Router } from 'express';
import { asyncHandler } from '../utils/index.js';
import { auth, authorize } from '../middleware/index.js';

import * as authC from '../controllers/auth.controller.js';
import * as people from '../controllers/people.controller.js';
import * as batches from '../controllers/batch.controller.js';
import * as att from '../controllers/attendance.controller.js';
import * as fees from '../controllers/fee.controller.js';
import * as reports from '../controllers/reports.controller.js';
import * as portal from '../controllers/portal.controller.js';

const router = Router();
const ADMIN = authorize('admin');
const STAFF = authorize('admin', 'teacher');
const PARENT = authorize('parent');
const TEACHER = authorize('teacher');

// wrap every handler so thrown errors reach the error middleware
const h = (fn) => asyncHandler(fn);

// ---------- Auth (public login) ----------
router.post('/auth/login', h(authC.login));
router.get('/auth/me', auth, h(authC.me));
router.post('/auth/change-password', auth, h(authC.changePassword));

// Everything below requires a valid token
router.use(auth);

// ---------- Admin: people ----------
router.get('/parents', ADMIN, h(people.listParents));
router.get('/parents/:id', ADMIN, h(people.getParent));
router.post('/parents', ADMIN, h(people.createParent));
router.put('/parents/:id', ADMIN, h(people.updateParent));

router.get('/teachers', ADMIN, h(people.listTeachers));
router.get('/teachers/:id', ADMIN, h(people.getTeacher));
router.post('/teachers', ADMIN, h(people.createTeacher));
router.put('/teachers/:id', ADMIN, h(people.updateTeacher));

router.get('/students', ADMIN, h(people.listStudents));
router.get('/students/:id', ADMIN, h(people.getStudent));
router.post('/students', ADMIN, h(people.createStudent));
router.put('/students/:id', ADMIN, h(people.updateStudent));
router.delete('/students/:id', ADMIN, h(people.deactivateStudent));
router.post('/students/:id/reactivate', ADMIN, h(people.reactivateStudent));

// ---------- Classes & batches ----------
router.get('/classes', STAFF, h(batches.listClasses));
router.post('/classes', ADMIN, h(batches.createClass));
router.put('/classes/:id', ADMIN, h(batches.updateClass));

router.get('/batches', STAFF, h(batches.listBatches));
router.get('/batches/:id', STAFF, h(batches.getBatch));
router.post('/batches', ADMIN, h(batches.createBatch));
router.put('/batches/:id', ADMIN, h(batches.updateBatch));
router.delete('/batches/:id', ADMIN, h(batches.deleteBatch));

// ---------- Attendance ----------
router.get('/attendance/batch/:batchId', STAFF, h(att.getBatchRoster));
router.post('/attendance/batch/:batchId', STAFF, h(att.markAttendance));
router.get('/attendance/summary', ADMIN, h(att.todaySummary));
router.get('/attendance/student/:studentId', ADMIN, h(att.studentAttendance));

// ---------- Fees ----------
router.get('/fees', ADMIN, h(fees.listFees));
router.get('/fees/summary', ADMIN, h(fees.feeSummary));
router.get('/fees/student/:studentId', ADMIN, h(fees.studentFees));
router.post('/fees/generate', ADMIN, h(fees.generateFees));
router.post('/fees/reminders', ADMIN, h(fees.sendReminders));
router.post('/fees/:id/pay', ADMIN, h(fees.recordPayment));
router.post('/fees/:id/reopen', ADMIN, h(fees.reopenFee));

// ---------- Reports & dashboard ----------
router.get('/dashboard', ADMIN, h(reports.dashboard));
router.get('/reports/attendance', ADMIN, h(reports.attendanceReport));
router.get('/reports/attendance-trend', ADMIN, h(reports.attendanceTrend));
router.get('/notifications', ADMIN, h(reports.notifications));

// ---------- Teacher ----------
router.get('/teacher/batches', TEACHER, h(portal.myBatches));

// ---------- Parent ----------
router.get('/parent/children', PARENT, h(portal.myChildren));
router.get('/parent/children/:studentId/attendance', PARENT, h(portal.childAttendance));
router.get('/parent/children/:studentId/fees', PARENT, h(portal.childFees));

export default router;
