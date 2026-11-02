import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './src/config/db.js';
import apiRouter from './src/routes/index.js';
import { errorHandler, notFound } from './src/middleware/index.js';

const app = express();

// CLIENT_URL can be a comma-separated list, e.g. "http://localhost:5173,https://app.vercel.app"
const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.json({ name: 'Smart Tuition Centre API', status: 'ok' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`API running on port ${PORT}`)))
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
