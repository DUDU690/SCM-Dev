import { PrismaClient, Role, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);

async function upsertUser(email: string, passwordHash: string, role: Role) {
  return prisma.user.upsert({ where: { email }, update: {}, create: { email, passwordHash, role } });
}

async function main() {
  console.log('🌱 Seeding SAKA SMS database...\n');

  const [adminH, teacherH, studentH] = await Promise.all([
    hash('Admin@12345'), hash('Teacher@12345'), hash('Student@12345'),
  ]);

  // ── School Settings ─────────────────────────────────────────────────────────
  await prisma.schoolSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default', name: 'SAKA Academy',
      address: '1 School Lane, London, SW1A 1AA',
      phone: '+44 20 7946 0000', email: 'info@saka.edu',
      website: 'https://saka.edu', tagline: 'Inspiring Minds, Building Futures',
      principalName: 'Dr. Emma Clarke', establishedYear: 2010,
    },
  });

  // ── Admin ────────────────────────────────────────────────────────────────────
  await upsertUser('admin@saka.edu', adminH, Role.ADMIN);

  // ── Academic Year ─────────────────────────────────────────────────────────────
  const year = await prisma.academicYear.upsert({
    where: { name: '2024-2025' },
    update: {},
    create: { name: '2024-2025', startDate: new Date('2024-09-01'), endDate: new Date('2025-07-31'), isCurrent: true },
  });

  // ── Terms ─────────────────────────────────────────────────────────────────────
  for (const t of [
    { name: 'Autumn Term', startDate: '2024-09-01', endDate: '2024-12-20' },
    { name: 'Spring Term', startDate: '2025-01-06', endDate: '2025-04-11' },
    { name: 'Summer Term', startDate: '2025-04-28', endDate: '2025-07-18' },
  ]) {
    const existing = await prisma.term.findFirst({ where: { academicYearId: year.id, name: t.name } });
    if (!existing) await prisma.term.create({ data: { academicYearId: year.id, name: t.name, startDate: new Date(t.startDate), endDate: new Date(t.endDate) } });
  }

  // ── Grading Rules ─────────────────────────────────────────────────────────────
  for (const g of [
    { name: 'A*', minPercent: 90, maxPercent: 100, grade: 'A*', description: 'Outstanding' },
    { name: 'A',  minPercent: 80, maxPercent: 89,  grade: 'A',  description: 'Excellent' },
    { name: 'B',  minPercent: 70, maxPercent: 79,  grade: 'B',  description: 'Good' },
    { name: 'C',  minPercent: 60, maxPercent: 69,  grade: 'C',  description: 'Satisfactory' },
    { name: 'D',  minPercent: 50, maxPercent: 59,  grade: 'D',  description: 'Needs Improvement' },
    { name: 'F',  minPercent: 0,  maxPercent: 49,  grade: 'F',  description: 'Fail' },
  ]) {
    const existing = await prisma.gradingRule.findUnique({ where: { name: g.name } });
    if (!existing) await prisma.gradingRule.create({ data: g });
  }

  // ── Classes ───────────────────────────────────────────────────────────────────
  const getOrCreateClass = async (name: string, oldName?: string) => {
    let c = await prisma.class.findFirst({ where: { name, academicYearId: year.id } });
    if (c) return c;
    if (oldName) {
      const old = await prisma.class.findFirst({ where: { name: oldName, academicYearId: year.id } });
      if (old) return prisma.class.update({ where: { id: old.id }, data: { name } });
    }
    return prisma.class.create({ data: { name, academicYearId: year.id } });
  };
  const class7 = await getOrCreateClass('Standard 7', 'Year 7');
  const class8 = await getOrCreateClass('Standard 8', 'Year 8');
  const class9 = await getOrCreateClass('Standard 9', 'Year 9');

  // ── Sections ──────────────────────────────────────────────────────────────────
  const getOrCreateSection = async (classId: string, name: string) => {
    let s = await prisma.section.findFirst({ where: { classId, name } });
    if (!s) s = await prisma.section.create({ data: { classId, name, capacity: 30 } });
    return s;
  };
  const sec7A = await getOrCreateSection(class7.id, 'A');
  const sec7B = await getOrCreateSection(class7.id, 'B');
  const sec8A = await getOrCreateSection(class8.id, 'A');
  await getOrCreateSection(class9.id, 'A');

  // ── Subjects ──────────────────────────────────────────────────────────────────
  const upsertSubject = async (code: string, name: string) =>
    prisma.subject.upsert({ where: { code }, update: {}, create: { code, name } });

  const maths   = await upsertSubject('MATH', 'Mathematics');
  const english = await upsertSubject('ENG',  'English Language');
  const science = await upsertSubject('SCI',  'Science');
  await upsertSubject('HIST', 'History');
  await upsertSubject('CS',   'Computer Science');
  await upsertSubject('ART',  'Art & Design');

  // ── Faculty ───────────────────────────────────────────────────────────────────
  const makeFaculty = async (email: string, data: {
    employeeId: string; firstName: string; lastName: string;
    gender: Gender; designation: string; qualification?: string;
  }) => {
    const user = await upsertUser(email, teacherH, Role.FACULTY);
    let f = await prisma.faculty.findUnique({ where: { userId: user.id } });
    if (!f) f = await prisma.faculty.create({ data: { userId: user.id, joiningDate: new Date('2020-09-01'), ...data } });
    return f;
  };

  const fSarah = await makeFaculty('teacher@saka.edu', { employeeId: 'EMP001', firstName: 'Sarah',  lastName: 'Johnson', gender: Gender.FEMALE, designation: 'Mathematics Teacher', qualification: 'MSc Mathematics' });
  const fMark  = await makeFaculty('mark@saka.edu',    { employeeId: 'EMP002', firstName: 'Mark',   lastName: 'Davis',   gender: Gender.MALE,   designation: 'Science Teacher',     qualification: 'BSc Physics' });
  const fLaura = await makeFaculty('laura@saka.edu',   { employeeId: 'EMP003', firstName: 'Laura',  lastName: 'Wilson',  gender: Gender.FEMALE, designation: 'English Teacher',     qualification: 'BA English' });

  // ── ClassSubjects ──────────────────────────────────────────────────────────────
  const assignCS = async (classId: string, subjectId: string, facultyId?: string) => {
    const ex = await prisma.classSubject.findFirst({ where: { classId, subjectId } });
    if (!ex) await prisma.classSubject.create({ data: { classId, subjectId, facultyId } });
  };
  await assignCS(class7.id, maths.id,   fSarah.id);
  await assignCS(class7.id, english.id, fLaura.id);
  await assignCS(class7.id, science.id, fMark.id);
  await assignCS(class8.id, maths.id,   fSarah.id);
  await assignCS(class8.id, science.id, fMark.id);
  await assignCS(class8.id, english.id, fLaura.id);
  await assignCS(class9.id, maths.id,   fSarah.id);
  await assignCS(class9.id, science.id, fMark.id);

  // ── Students ───────────────────────────────────────────────────────────────────
  const makeStudent = async (
    email: string, admNo: string,
    profile: { firstName: string; lastName: string; gender: Gender; dateOfBirth: Date; bloodGroup?: string },
    guardian: { firstName: string; lastName: string; relationship: string; phone: string },
    sectionId: string, rollNumber: string,
  ) => {
    const user = await upsertUser(email, studentH, Role.STUDENT);
    let s = await prisma.student.findUnique({ where: { userId: user.id } });
    if (!s) s = await prisma.student.create({ data: { userId: user.id, admissionNumber: admNo, ...profile } });
    const g = await prisma.guardian.findFirst({ where: { studentId: s.id } });
    if (!g) await prisma.guardian.create({ data: { studentId: s.id, ...guardian } });
    const e = await prisma.studentEnrollment.findFirst({ where: { studentId: s.id, academicYearId: year.id } });
    if (!e) await prisma.studentEnrollment.create({ data: { studentId: s.id, sectionId, academicYearId: year.id, rollNumber } });
    return s;
  };

  const st1 = await makeStudent('student@saka.edu',  'ADM20240001', { firstName: 'James',    lastName: 'Williams', gender: Gender.MALE,   dateOfBirth: new Date('2012-05-15'), bloodGroup: 'A+' },  { firstName: 'Robert',  lastName: 'Williams', relationship: 'Father', phone: '+44 7700 900001' }, sec7A.id, '01');
  const st2 = await makeStudent('emma@saka.edu',     'ADM20240002', { firstName: 'Emma',     lastName: 'Thompson', gender: Gender.FEMALE, dateOfBirth: new Date('2012-08-22'), bloodGroup: 'B+' },  { firstName: 'Claire',  lastName: 'Thompson', relationship: 'Mother', phone: '+44 7700 900002' }, sec7A.id, '02');
  const st3 = await makeStudent('oliver@saka.edu',   'ADM20240003', { firstName: 'Oliver',   lastName: 'Brown',    gender: Gender.MALE,   dateOfBirth: new Date('2012-03-10') },                   { firstName: 'Thomas',  lastName: 'Brown',    relationship: 'Father', phone: '+44 7700 900003' }, sec7A.id, '03');
  await makeStudent('sophia@saka.edu',  'ADM20240004', { firstName: 'Sophia',   lastName: 'Jones',    gender: Gender.FEMALE, dateOfBirth: new Date('2012-11-30'), bloodGroup: 'O+' },  { firstName: 'Michael', lastName: 'Jones',    relationship: 'Father', phone: '+44 7700 900004' }, sec7B.id, '01');
  const st5 = await makeStudent('harry@saka.edu',    'ADM20240005', { firstName: 'Harry',    lastName: 'Taylor',   gender: Gender.MALE,   dateOfBirth: new Date('2011-06-18') },                   { firstName: 'Susan',   lastName: 'Taylor',   relationship: 'Mother', phone: '+44 7700 900005' }, sec8A.id, '01');
  await makeStudent('isabella@saka.edu','ADM20240006', { firstName: 'Isabella', lastName: 'Moore',    gender: Gender.FEMALE, dateOfBirth: new Date('2011-09-05'), bloodGroup: 'AB+' }, { firstName: 'David',   lastName: 'Moore',    relationship: 'Father', phone: '+44 7700 900006' }, sec8A.id, '02');

  // ── Timetable ──────────────────────────────────────────────────────────────────
  let tt7 = await prisma.timetable.findFirst({ where: { classId: class7.id, academicYearId: year.id } });
  if (!tt7) tt7 = await prisma.timetable.create({ data: { classId: class7.id, academicYearId: year.id, name: 'Year 7 Timetable 2024-25', isActive: true } });

  const addSlot = async (timetableId: string, data: {
    sectionId: string; subjectId: string; facultyId: string;
    dayOfWeek: any; startTime: string; endTime: string; room?: string;
  }) => {
    const ex = await prisma.timetableSlot.findFirst({ where: { timetableId, sectionId: data.sectionId, subjectId: data.subjectId, dayOfWeek: data.dayOfWeek } });
    if (!ex) await prisma.timetableSlot.create({ data: { timetableId, ...data } });
  };

  await addSlot(tt7.id, { sectionId: sec7A.id, subjectId: maths.id,   facultyId: fSarah.id, dayOfWeek: 'MONDAY',    startTime: '09:00', endTime: '10:00', room: '101' });
  await addSlot(tt7.id, { sectionId: sec7A.id, subjectId: english.id, facultyId: fLaura.id, dayOfWeek: 'MONDAY',    startTime: '10:15', endTime: '11:15', room: '102' });
  await addSlot(tt7.id, { sectionId: sec7A.id, subjectId: science.id, facultyId: fMark.id,  dayOfWeek: 'TUESDAY',   startTime: '09:00', endTime: '10:00', room: 'Lab1' });
  await addSlot(tt7.id, { sectionId: sec7A.id, subjectId: maths.id,   facultyId: fSarah.id, dayOfWeek: 'WEDNESDAY', startTime: '09:00', endTime: '10:00', room: '101' });
  await addSlot(tt7.id, { sectionId: sec7A.id, subjectId: english.id, facultyId: fLaura.id, dayOfWeek: 'THURSDAY',  startTime: '10:15', endTime: '11:15', room: '102' });
  await addSlot(tt7.id, { sectionId: sec7A.id, subjectId: science.id, facultyId: fMark.id,  dayOfWeek: 'FRIDAY',    startTime: '09:00', endTime: '10:00', room: 'Lab1' });
  await addSlot(tt7.id, { sectionId: sec7B.id, subjectId: maths.id,   facultyId: fSarah.id, dayOfWeek: 'MONDAY',    startTime: '11:30', endTime: '12:30', room: '101' });
  await addSlot(tt7.id, { sectionId: sec7B.id, subjectId: english.id, facultyId: fLaura.id, dayOfWeek: 'TUESDAY',   startTime: '11:30', endTime: '12:30', room: '102' });

  // ── Attendance (past 10 school days for Year 7A) ──────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let d = 10; d >= 1; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    let att = await prisma.attendance.findFirst({ where: { sectionId: sec7A.id, date } });
    if (!att) att = await prisma.attendance.create({
      data: { sectionId: sec7A.id, date, takenById: fSarah.id },
    });
    for (const st of [st1, st2, st3]) {
      const ex = await prisma.studentAttendance.findFirst({ where: { attendanceId: att.id, studentId: st.id } });
      if (!ex) await prisma.studentAttendance.create({
        data: { attendanceId: att.id, studentId: st.id, status: Math.random() > 0.15 ? 'PRESENT' : 'ABSENT' },
      });
    }
  }

  // ── Examination ────────────────────────────────────────────────────────────────
  let exam = await prisma.examination.findFirst({ where: { classId: class7.id, name: 'Mid-Term Test 1' } });
  if (!exam) exam = await prisma.examination.create({
    data: { classId: class7.id, academicYearId: year.id, name: 'Mid-Term Test 1', startDate: new Date('2024-11-15'), endDate: new Date('2024-11-20'), isPublished: false },
  });

  const addExamSubject = async (examinationId: string, subjectId: string, maxMarks: number, passingMarks: number) => {
    const ex = await prisma.examinationSubject.findFirst({ where: { examinationId, subjectId } });
    if (!ex) await prisma.examinationSubject.create({ data: { examinationId, subjectId, maxMarks, passingMarks } });
  };
  await addExamSubject(exam.id, maths.id,   100, 40);
  await addExamSubject(exam.id, english.id, 100, 40);
  await addExamSubject(exam.id, science.id, 100, 40);

  // ── Marks ──────────────────────────────────────────────────────────────────────
  for (const m of [
    { studentId: st1.id, subjectId: maths.id,   marks: 85, grade: 'A'  },
    { studentId: st1.id, subjectId: english.id, marks: 78, grade: 'B'  },
    { studentId: st1.id, subjectId: science.id, marks: 92, grade: 'A*' },
    { studentId: st2.id, subjectId: maths.id,   marks: 76, grade: 'B'  },
    { studentId: st2.id, subjectId: english.id, marks: 88, grade: 'A'  },
    { studentId: st2.id, subjectId: science.id, marks: 81, grade: 'A'  },
    { studentId: st3.id, subjectId: maths.id,   marks: 62, grade: 'C'  },
    { studentId: st3.id, subjectId: english.id, marks: 70, grade: 'B'  },
    { studentId: st3.id, subjectId: science.id, marks: 55, grade: 'D'  },
  ]) {
    const ex = await prisma.mark.findFirst({ where: { examinationId: exam.id, studentId: m.studentId, subjectId: m.subjectId } });
    if (!ex) await prisma.mark.create({ data: { examinationId: exam.id, studentId: m.studentId, subjectId: m.subjectId, facultyId: fSarah.id, marksObtained: m.marks, grade: m.grade } });
  }

  // ── Fee Structures ─────────────────────────────────────────────────────────────
  const makeFeeStructure = async (name: string, classId: string, amount: number, dueDate: Date) => {
    const ex = await prisma.feeStructure.findFirst({ where: { academicYearId: year.id, classId, name } });
    if (ex) return ex;
    return prisma.feeStructure.create({ data: { academicYearId: year.id, classId, name, amount, dueDate, isMandatory: true } });
  };
  const feeTermly7  = await makeFeeStructure('Termly Tuition Fee',   class7.id, 1500, new Date('2024-10-01'));
  const feeActivity = await makeFeeStructure('Activity & Trips Fee', class7.id, 200,  new Date('2024-10-15'));
  const feeTermly8  = await makeFeeStructure('Termly Tuition Fee',   class8.id, 1600, new Date('2024-10-01'));

  // ── Fee Invoices ──────────────────────────────────────────────────────────────
  const makeInvoice = async (studentId: string, items: { feeStructureId: string; description: string; amount: number }[]) => {
    const ex = await prisma.feeInvoice.findFirst({ where: { studentId } });
    if (ex) return ex;
    const total = items.reduce((s, i) => s + i.amount, 0);
    return prisma.feeInvoice.create({
      data: {
        invoiceNumber: `INV${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`,
        studentId, totalAmount: total, dueDate: new Date('2024-10-31'),
        items: { create: items },
      },
    });
  };

  const inv1 = await makeInvoice(st1.id, [
    { feeStructureId: feeTermly7.id,  description: 'Termly Tuition Fee', amount: 1500 },
    { feeStructureId: feeActivity.id, description: 'Activity & Trips',   amount: 200  },
  ]);
  await makeInvoice(st2.id, [{ feeStructureId: feeTermly7.id, description: 'Termly Tuition Fee', amount: 1500 }]);
  await makeInvoice(st5.id, [{ feeStructureId: feeTermly8.id, description: 'Year 8 Tuition Fee',  amount: 1600 }]);

  const adminUser = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  const exPayment = await prisma.feePayment.findFirst({ where: { invoiceId: inv1.id } });
  if (!exPayment && adminUser) {
    await prisma.feePayment.create({
      data: { invoiceId: inv1.id, amount: 800, paymentMethod: 'Bank Transfer', receiptNumber: `RCP${Date.now().toString().slice(-8)}`, recordedBy: adminUser.id },
    });
    await prisma.feeInvoice.update({ where: { id: inv1.id }, data: { paidAmount: 800, status: 'PARTIAL' } });
  }

  // ── Assignments ────────────────────────────────────────────────────────────────
  const makeAssignment = async (title: string, subjectId: string, facultyId: string, dueDate: Date, description: string) => {
    const ex = await prisma.assignment.findFirst({ where: { title, subjectId } });
    if (!ex) return prisma.assignment.create({ data: { title, subjectId, facultyId, description, dueDate, maxMarks: 20, isPublished: true } });
    return ex;
  };

  const asgn1 = await makeAssignment('Algebra Basics Worksheet',      maths.id,   fSarah.id, new Date('2024-11-01'), 'Complete exercises 1-20 on algebraic expressions.');
  const asgn2 = await makeAssignment('Essay: My Favourite Book',       english.id, fLaura.id, new Date('2024-11-05'), 'Write a 500-word essay about your favourite book.');
  await makeAssignment('Lab Report: Chemical Reactions',               science.id, fMark.id,  new Date('2024-11-08'), 'Write up your observations from the acid-base experiment.');
  await makeAssignment('Geometry Practice Set',                        maths.id,   fSarah.id, new Date(Date.now() + 7 * 86400000), 'Solve questions on angles, triangles, and circles.');

  const submitAssignment = async (assignmentId: string, studentId: string, notes: string) => {
    const ex = await prisma.assignmentSubmission.findFirst({ where: { assignmentId, studentId } });
    if (!ex) await prisma.assignmentSubmission.create({ data: { assignmentId, studentId, notes } });
  };
  await submitAssignment(asgn1.id, st1.id, 'Completed all 20 questions. Used substitution for the last 5.');
  await submitAssignment(asgn1.id, st2.id, 'Done. Please check Q15 as I used a different approach.');
  await submitAssignment(asgn2.id, st1.id, "Essay about Harry Potter and the Philosopher's Stone.");

  // ── Events ─────────────────────────────────────────────────────────────────────
  for (const ev of [
    { title: 'School Sports Day',      startDate: '2025-06-15', description: 'Annual inter-house sports competition.' },
    { title: 'Year 7 Parents Evening', startDate: '2024-11-21', description: 'Meeting with parents to discuss student progress.' },
    { title: 'Science Fair',           startDate: '2025-03-10', description: 'Students present science projects to judges.' },
    { title: 'Christmas Concert',      startDate: '2024-12-18', description: 'Annual Christmas concert by the school choir.' },
    { title: 'Mock Examination Week',  startDate: '2025-01-20', description: 'Full mock examinations for all year groups.' },
  ]) {
    const ex = await prisma.event.findFirst({ where: { title: ev.title } });
    if (!ex) await prisma.event.create({ data: { title: ev.title, description: ev.description, startDate: new Date(ev.startDate), status: 'PUBLISHED' as any } });
  }

  // ── Achievements ───────────────────────────────────────────────────────────────
  for (const ach of [
    { title: 'Mathematics Excellence Award',     studentName: 'James Williams', category: 'Academic',   description: 'Top marks in Mid-Term Mathematics examination.' },
    { title: 'Perfect Attendance - Autumn Term', studentName: 'Emma Thompson',  category: 'Attendance', description: '100% attendance throughout Autumn Term 2024.' },
    { title: 'Science Fair 1st Place',           studentName: 'Oliver Brown',   category: 'Science',    description: 'First place in the annual school science fair.' },
  ]) {
    const ex = await prisma.achievement.findFirst({ where: { title: ach.title } });
    if (!ex) await prisma.achievement.create({ data: { ...ach, date: new Date(), status: 'PUBLISHED' as any, consentGiven: true } });
  }

  // ── Holidays ──────────────────────────────────────────────────────────────────
  for (const h of [
    { name: 'Christmas Break',  date: '2024-12-25', description: 'Christmas Day' },
    { name: "New Year's Day",   date: '2025-01-01', description: "New Year's Day" },
    { name: 'Easter Break',     date: '2025-04-18', description: 'Good Friday' },
    { name: 'Bank Holiday',     date: '2025-05-05', description: 'Early May Bank Holiday' },
    { name: 'Half Term',        date: '2025-02-17', description: 'Spring Half Term' },
  ]) {
    const ex = await prisma.holiday.findFirst({ where: { academicYearId: year.id, name: h.name } });
    if (!ex) await prisma.holiday.create({ data: { academicYearId: year.id, name: h.name, date: new Date(h.date), description: h.description } });
  }

  // ── Notifications ─────────────────────────────────────────────────────────────
  const studentUser1 = await prisma.user.findUnique({ where: { email: 'student@saka.edu' } });
  const facultyUser1 = await prisma.user.findUnique({ where: { email: 'teacher@saka.edu' } });

  const makeNotif = async (userId: string, title: string, message: string, type: string) => {
    const ex = await prisma.notification.findFirst({ where: { userId, title } });
    if (!ex) await prisma.notification.create({ data: { userId, title, message, type } });
  };

  if (studentUser1) {
    await makeNotif(studentUser1.id, 'Exam Results Published',  'Your Mid-Term Test 1 results are now available.',                 'EXAM');
    await makeNotif(studentUser1.id, 'Assignment Due Reminder', 'Geometry Practice Set is due in 7 days.',                        'ASSIGNMENT');
    await makeNotif(studentUser1.id, 'Fee Reminder',            'Your fee invoice has an outstanding balance of £900.',            'FEE');
  }
  if (facultyUser1) {
    await makeNotif(facultyUser1.id, 'New Assignment Submission', 'James Williams submitted Algebra Basics Worksheet.',            'ASSIGNMENT');
    await makeNotif(facultyUser1.id, 'Parents Evening Reminder',  'Year 7 Parents Evening on 21 November. Prepare progress reports.', 'GENERAL');
  }

  // ── Admission Applications ─────────────────────────────────────────────────────
  for (const app of [
    { refNum: 'APP2025001', firstName: 'Liam',   lastName: 'Anderson', status: 'PENDING',      relation: 'Father' },
    { refNum: 'APP2025002', firstName: 'Amelia', lastName: 'Martinez', status: 'UNDER_REVIEW', relation: 'Mother' },
    { refNum: 'APP2025003', firstName: 'Noah',   lastName: 'Roberts',  status: 'APPROVED',     relation: 'Father' },
    { refNum: 'APP2025004', firstName: 'Mia',    lastName: 'Clark',    status: 'PENDING',      relation: 'Mother' },
  ]) {
    const ex = await prisma.admission.findFirst({ where: { referenceNumber: app.refNum } });
    if (!ex) await prisma.admission.create({
      data: {
        referenceNumber: app.refNum, firstName: app.firstName, lastName: app.lastName,
        status: app.status as any, classId: class7.id, academicYearId: year.id,
        gender: Gender.MALE, dateOfBirth: new Date('2013-03-01'),
        guardianName: `Parent of ${app.firstName}`, guardianPhone: '+44 7700 900099',
        guardianRelation: app.relation,
      },
    });
  }

  // ── Online Classes ─────────────────────────────────────────────────────────────
  for (const oc of [
    { title: 'Algebra Revision Session',  subjectId: maths.id,   delay: 2 },
    { title: 'Trigonometry Introduction', subjectId: maths.id,   delay: 9 },
    { title: 'Grammar & Comprehension',   subjectId: english.id, delay: 3 },
  ]) {
    const ex = await prisma.onlineClass.findFirst({ where: { title: oc.title } });
    if (!ex) await prisma.onlineClass.create({
      data: {
        title: oc.title, subjectId: oc.subjectId, facultyId: fSarah.id,
        meetingLink: 'https://meet.google.com/saka-001',
        scheduledAt: new Date(Date.now() + oc.delay * 86400000),
        duration: 60, isPublished: true,
      },
    });
  }

  // ── Gallery Albums ─────────────────────────────────────────────────────────────
  for (const album of [
    { title: 'Sports Day 2024',   description: 'Photos from our annual Sports Day.' },
    { title: 'Science Fair 2024', description: 'Highlights from the Science Fair.' },
    { title: 'Christmas Concert', description: 'Moments from the 2024 Christmas Concert.' },
  ]) {
    const ex = await prisma.galleryAlbum.findFirst({ where: { title: album.title } });
    if (!ex) await prisma.galleryAlbum.create({ data: { ...album, status: 'PUBLISHED' as any, isPublic: true } });
  }

  // ── Print Summary ──────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SAKA SMS — Seed Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Users:          Admin, 3 Faculty, 6 Students');
  console.log('  Classes:        Year 7, 8, 9  (4 sections)');
  console.log('  Subjects:       6  (Maths, English, Science, History, CS, Art)');
  console.log('  Timetable:      Year 7 active — Mon-Fri slots');
  console.log('  Attendance:     ~10 days x Year 7A (3 students)');
  console.log('  Examination:    Mid-Term Test 1  (marks entered)');
  console.log('  Assignments:    4  (3 with submissions)');
  console.log('  Fee Invoices:   3  (1 partial payment recorded)');
  console.log('  Events:         5');
  console.log('  Achievements:   3');
  console.log('  Admissions:     4  (pipeline)');
  console.log('  Online Classes: 3');
  console.log('  Gallery Albums: 3');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  admin@saka.edu   / Admin@12345');
  console.log('  teacher@saka.edu / Teacher@12345');
  console.log('  mark@saka.edu    / Teacher@12345');
  console.log('  laura@saka.edu   / Teacher@12345');
  console.log('  student@saka.edu / Student@12345');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
