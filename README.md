# SAKA School Management System

A complete, secure, full-stack School Management System for real-world school operations.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (httpOnly cookies) + Argon2 password hashing |
| State | Redux Toolkit |
| Validation | Zod (frontend + backend) |

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm 9+

## Quick Start

### 1. Clone and install dependencies

```bash
cd "School_Management_System"
npm run install:all
```

### 2. Set up the backend environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set your PostgreSQL connection string:

```
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/saka_sms?schema=public"
JWT_ACCESS_SECRET="your-strong-random-secret-min-32-chars"
JWT_REFRESH_SECRET="your-strong-random-refresh-secret"
```

### 3. Create the database

In PostgreSQL, create a database:

```sql
CREATE DATABASE saka_sms;
```

### 4. Run migrations and seed

```bash
# From project root:
npm run prisma:migrate
npm run prisma:seed
```

### 5. Start development servers

```bash
# From project root (starts both backend on :5000 and frontend on :5173):
npm run dev
```

Or start them separately:

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 6. Access the application

Open http://localhost:5173 in your browser.

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sakasms.com | Admin@1234 |
| Faculty | faculty@sakasms.com | Faculty@1234 |
| Student | student@sakasms.com | Student@1234 |

## Project Structure

```
School_Management_System/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   └── src/
│       ├── app.ts             # Express app entry point
│       ├── lib/
│       │   └── prisma.ts      # Prisma client
│       ├── middlewares/       # Auth, error handling, rate limiting
│       ├── routes/            # API route handlers (one file per module)
│       ├── services/          # Business logic
│       ├── utils/             # Shared utilities (pagination, audit logs)
│       └── prisma/
│           └── seed.ts        # Development seed data
├── frontend/
│   └── src/
│       ├── App.tsx            # Root router
│       ├── layouts/           # AppLayout with sidebar + header
│       ├── pages/             # Admin, Faculty, Student page components
│       ├── components/        # Reusable UI components
│       ├── store/             # Redux Toolkit slices
│       └── lib/               # API client, utilities
└── README.md
```

## Application Modules

| # | Module | Status |
|---|--------|--------|
| 1 | Authentication & User Management | ✅ |
| 2 | Role-Based Dashboards | ✅ |
| 3 | Student Management | ✅ |
| 4 | Faculty Management | ✅ |
| 5 | Classes, Subjects, Academic Years | ✅ |
| 6 | Timetable | ✅ |
| 7 | Attendance | ✅ |
| 8 | Examinations & Results | ✅ |
| 9 | Fees & Payments | ✅ |
| 10 | Admissions Portal | ✅ |
| 11 | Online Classes & Assignments | ✅ |
| 12 | Hostel Management | ✅ |
| 13 | Events & Achievements | ✅ |
| 14 | Photo Gallery | ✅ |
| 15 | Notifications | ✅ |
| 16 | Reports & Exports | ✅ |
| 17 | Audit Logs | ✅ |
| 18 | School Settings | ✅ |

## API Documentation

Base URL: `http://localhost:5000/api/v1`

All protected endpoints require authentication via the `accessToken` cookie (set automatically on login).

### Auth Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | /auth/login | Public | Login |
| POST | /auth/logout | Any | Logout |
| POST | /auth/refresh | Any | Refresh access token |
| GET | /auth/me | Any | Get current user |
| POST | /auth/change-password | Any | Change password |

### Main Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /students | Admin/Faculty | List students |
| POST | /students | Admin | Create student |
| GET | /faculty | Admin | List faculty |
| POST | /faculty | Admin | Create faculty |
| GET | /classes | Any | List classes |
| GET | /attendance/section/:id | Admin/Faculty | Section attendance |
| POST | /attendance | Faculty | Take attendance |
| GET | /examinations | Any | List exams |
| POST | /marks/bulk | Faculty | Enter marks |
| GET | /dashboard/admin | Admin | Admin dashboard stats |
| GET | /dashboard/faculty | Faculty | Faculty dashboard stats |
| GET | /dashboard/student | Student | Student dashboard stats |

See the full OpenAPI spec at `/api/v1/docs` (when implemented).

## Security Features

- Argon2id password hashing
- JWT access tokens (15 min) + refresh tokens (7 days) in httpOnly cookies
- Rate limiting on auth endpoints (10 req/15 min)
- CSRF protection via SameSite cookie policy
- Helmet.js security headers
- Role-based access control on every endpoint
- Record-level access checks (students see only their data)
- Input validation with Zod on all endpoints
- Parameterized queries via Prisma (no SQL injection)
- Audit logs for sensitive operations

## Database Backup

```bash
# Backup
pg_dump -U postgres saka_sms > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres saka_sms < backup_YYYYMMDD.sql
```

## Environment Variables Reference

See `backend/.env.example` for all available configuration options.

## Outstanding Work / External Integrations Required

- [ ] Email notifications (SMTP configuration in .env)
- [ ] SMS notifications (Twilio or similar)
- [ ] Payment gateway integration (Stripe recommended)
- [ ] Video conferencing (Zoom/Google Meet API for online classes)
- [ ] Document storage (S3/Cloudinary for production)
- [ ] Full-text search (PostgreSQL full-text or Elasticsearch)
- [ ] PDF export for report cards (Puppeteer/PDFKit)
- [ ] Automated test suite expansion
- [ ] OpenAPI/Swagger documentation
