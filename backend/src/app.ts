import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import studentRoutes from './routes/student.routes';
import facultyRoutes from './routes/faculty.routes';
import classRoutes from './routes/class.routes';
import subjectRoutes from './routes/subject.routes';
import academicYearRoutes from './routes/academicYear.routes';
import timetableRoutes from './routes/timetable.routes';
import holidayRoutes from './routes/holiday.routes';
import attendanceRoutes from './routes/attendance.routes';
import examinationRoutes from './routes/examination.routes';
import markRoutes from './routes/mark.routes';
import feeRoutes from './routes/fee.routes';
import admissionRoutes from './routes/admission.routes';
import onlineClassRoutes from './routes/onlineClass.routes';
import assignmentRoutes from './routes/assignment.routes';
import hostelRoutes from './routes/hostel.routes';
import eventRoutes from './routes/event.routes';
import achievementRoutes from './routes/achievement.routes';
import galleryRoutes from './routes/gallery.routes';
import notificationRoutes from './routes/notification.routes';
import reportRoutes from './routes/report.routes';
import settingsRoutes from './routes/settings.routes';
import auditRoutes from './routes/audit.routes';
import dashboardRoutes from './routes/dashboard.routes';

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URLS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(u => u.trim()).filter(Boolean);

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || FRONTEND_URLS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Static uploads ──────────────────────────────────────────────────────────
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API routes ──────────────────────────────────────────────────────────────
const api = '/api/v1';

app.use(`${api}/auth`, authRoutes);
app.use(`${api}/users`, userRoutes);
app.use(`${api}/students`, studentRoutes);
app.use(`${api}/faculty`, facultyRoutes);
app.use(`${api}/classes`, classRoutes);
app.use(`${api}/subjects`, subjectRoutes);
app.use(`${api}/academic-years`, academicYearRoutes);
app.use(`${api}/timetables`, timetableRoutes);
app.use(`${api}/holidays`, holidayRoutes);
app.use(`${api}/attendance`, attendanceRoutes);
app.use(`${api}/examinations`, examinationRoutes);
app.use(`${api}/marks`, markRoutes);
app.use(`${api}/fees`, feeRoutes);
app.use(`${api}/admissions`, admissionRoutes);
app.use(`${api}/online-classes`, onlineClassRoutes);
app.use(`${api}/assignments`, assignmentRoutes);
app.use(`${api}/hostel`, hostelRoutes);
app.use(`${api}/events`, eventRoutes);
app.use(`${api}/achievements`, achievementRoutes);
app.use(`${api}/gallery`, galleryRoutes);
app.use(`${api}/notifications`, notificationRoutes);
app.use(`${api}/reports`, reportRoutes);
app.use(`${api}/settings`, settingsRoutes);
app.use(`${api}/audit-logs`, auditRoutes);
app.use(`${api}/dashboard`, dashboardRoutes);

// ─── Error handling ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
import prisma from './lib/prisma';

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    try {
      await prisma.$connect();
      console.log('✅ Database connected');
    } catch (err: any) {
      console.error('❌ Database connection failed:', err.message);
      console.error('   Make sure PostgreSQL is running and DATABASE_URL in .env is correct.');
      console.error('   Then run: npx prisma migrate dev && npm run prisma:seed');
    }
  });
}

export default app;
