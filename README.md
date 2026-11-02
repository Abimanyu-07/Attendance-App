# Smart Tuition Centre — Attendance & Fee Management System

A mobile-first MERN application for a tuition centre. Teachers mark attendance from their phones, admins manage students/parents/teachers/batches and fees, parents view their child's records, and WhatsApp alerts go out for absences and fee reminders.

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios, Recharts, PWA (vite-plugin-pwa) |
| Backend | Node.js, Express, REST API, JWT auth, bcrypt, role-based authorization |
| Database | MongoDB Atlas (Mongoose) |
| Hosting | Frontend → Vercel, Backend → Render (free tiers) |

## Roles

| Role | Access |
|---|---|
| **Admin** | Dashboard, students, parents, teachers, classes, batches, fees, reports, notification log |
| **Teacher** | Their assigned batches; mark attendance (mobile-optimised) |
| **Parent** | Their own children's attendance and fee status (read-only) |

There is intentionally no student login.

## Project structure

```
smart-tuition-centre/
├── backend/
│   ├── server.js                  # Express app entry
│   ├── scripts/seed.js            # Demo data
│   └── src/
│       ├── config/db.js           # Mongo connection
│       ├── models/index.js        # User, Parent, Teacher, Class, Batch, Student, Attendance, Fee, Notification
│       ├── middleware/index.js    # JWT auth, role guard, error handling
│       ├── routes/index.js        # All API routes
│       ├── controllers/           # auth, people, batch, attendance, fee, reports, portal
│       ├── services/notify.js     # WhatsApp (Meta Cloud API) + absence/fee reminder logic
│       ├── services/fees.js       # Monthly fee generation, overdue detection
│       └── utils/index.js
└── frontend/
    ├── vite.config.js             # PWA manifest + caching
    ├── vercel.json                # SPA rewrites
    └── src/
        ├── api.js                 # Axios instance (JWT attached automatically)
        ├── auth.jsx               # Auth context
        ├── App.jsx                # Routes + role guards
        ├── components/            # Layout, UI kit
        └── pages/
            ├── Login.jsx
            ├── admin/             # Dashboard, Students, People, Batches, Fees, Reports
            ├── teacher/           # Home (my batches), Attendance (tap to mark)
            └── parent/Home.jsx
```

## Key business rules

- **Attendance**: one record per student, batch and date. Teachers can only mark batches assigned to them. Saving again updates the record (corrections are allowed).
- **Absence alerts**: when a student is saved as *absent*, the parent receives a WhatsApp message. Each absence is notified only once.
- **Fees**: `POST /fees/generate` creates one fee per student per batch they attend, using the batch's monthly fee, due on the 5th. It is idempotent, so running it twice does not duplicate fees.
- **Overdue**: a pending fee past its due date is automatically marked overdue.
- **Payments**: recording a payment sends a receipt to the parent. Mistakes can be undone.
- **Deletion**: students, batches and teachers are *deactivated* rather than deleted, so history is preserved.
- **IDs**: `STU-0001`, `PAR-0001`, `TCH-0001`, `BAT-0001`, generated atomically.
- **Time zone**: all "today" logic uses IST (UTC+05:30).

## Local setup

### 1. Backend

```bash
cd backend
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET
npm install
npm run seed                # creates demo data
npm run dev                 # http://localhost:5000
```

If the MongoDB username or password contains reserved URL characters (for example, `@`), URL-encode those credentials in `MONGO_URI` (`@` becomes `%40`).

### 2. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                 # http://localhost:5173
```

### Demo logins (password: `password123`)

| Role | Phone |
|---|---|
| Admin | 9000000001 |
| Teacher (Ramesh – Maths) | 9000000002 |
| Teacher (Priya – Physics/Chemistry) | 9000000003 |
| Parent (Suresh Iyer) | 9100000001 |
| Parent (Lakshmi Raman – 2 children) | 9100000002 |

## Free-tier deployment

### MongoDB Atlas
1. Create a free **M0** cluster.
2. Create a database user and allow network access (`0.0.0.0/0` for Render).
3. Copy the connection string into `MONGO_URI`.

### Backend on Render
1. New **Web Service** → connect the repo → root directory `backend`.
2. Build command: `npm install` · Start command: `npm start`.
3. Environment variables: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` (your Vercel URL), `CENTRE_NAME`, and optionally the WhatsApp variables.
4. Run the seed once from the Render shell: `npm run seed` (demo only).

Free Render instances sleep after inactivity. The first request after a pause can take ~30 seconds. Open `/api/health` before a demo to wake it.

### Frontend on Vercel
1. Import the repo → root directory `frontend`. Framework preset: **Vite**.
2. Environment variable: `VITE_API_URL=https://<your-render-service>.onrender.com/api`.
3. Deploy. Then add the Vercel URL to the backend's `CLIENT_URL` (comma-separated) and redeploy the backend.

## WhatsApp notifications

The app uses the **Meta WhatsApp Cloud API**.

1. Create a Meta developer app with the WhatsApp product and get a permanent token and a phone number ID.
2. Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_ID` on the backend.

Without these variables the app runs in **dry-run mode**: messages are printed to the server log and stored as `skipped` in the Notifications log. This is useful for the PBL demo when WhatsApp is not yet approved.

> Note: Meta only allows free-form text messages within 24 hours of a parent's last message to your business number. For production, create approved **message templates** (for example, "absence alert" and "fee reminder") and switch `sendWhatsApp` to send template messages. The message-building logic in `services/notify.js` is already separated for this.

## API overview

| Method | Endpoint | Role |
|---|---|---|
| POST | `/api/auth/login` | public |
| GET | `/api/auth/me` | any |
| GET/POST/PUT | `/api/students`, `/api/students/:id` | admin |
| DELETE | `/api/students/:id` (deactivate) · POST `/:id/reactivate` | admin |
| GET/POST/PUT | `/api/parents`, `/api/teachers` | admin |
| GET/POST/PUT/DELETE | `/api/batches`, `/api/classes` | admin (read: staff) |
| GET | `/api/attendance/batch/:batchId?date=` | admin, teacher (own) |
| POST | `/api/attendance/batch/:batchId` | admin, teacher (own) |
| POST | `/api/fees/generate` · `/api/fees/:id/pay` · `/api/fees/reminders` | admin |
| GET | `/api/fees?status&batch&month&search` | admin |
| GET | `/api/dashboard` · `/api/reports/attendance` · `/api/reports/attendance-trend` | admin |
| GET | `/api/teacher/batches` | teacher |
| GET | `/api/parent/children` (+ `/:id/attendance`, `/:id/fees`) | parent (own children) |

## Testing checklist for the PBL demo

- [ ] Log in as admin → dashboard counts and charts load.
- [ ] Add a class, a batch and a teacher; assign the teacher to the batch.
- [ ] Add a student, link to a parent, assign to the batch.
- [ ] Log in as the teacher on a phone-sized browser → mark one student absent → save.
- [ ] Check Notifications on the admin dashboard (absence alert logged).
- [ ] Generate fees for the month → record a payment → verify it moves to Paid.
- [ ] Send fee reminders → check the log.
- [ ] Log in as the parent → see the child's attendance and outstanding fees.
- [ ] Install the app to the home screen (PWA) from the browser menu.
