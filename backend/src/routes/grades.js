const { Router } = require('express');
const { authenticate, requireRoles } = require('../middleware/authenticate');
const { getFirestore } = require('../config/firebase');

const router = Router();
router.use(authenticate);

router.get('/', async (request, response) => {
  const firestore = getFirestore();
  if (!firestore) return response.status(503).json({ error: 'Firestore is not configured.' });
  const requestedStudentId = request.query.studentId;
  const linkedStudents = request.schoolUser.studentIds || [];
  if (request.schoolUser.role === 'parent' && !linkedStudents.length) return response.json({ records: [] });
  if (request.schoolUser.role === 'parent' && requestedStudentId && !linkedStudents.includes(requestedStudentId)) {
    return response.status(403).json({ error: 'That student is not linked to your account.' });
  }
  const studentId = request.schoolUser.role === 'student'
    ? request.schoolUser.id
    : request.schoolUser.role === 'parent'
      ? requestedStudentId || null
      : requestedStudentId;

  try {
    let query = firestore.collection('grades');
    if (studentId) query = query.where('studentId', '==', String(studentId));
    else if (request.schoolUser.role === 'parent') query = query.where('studentId', 'in', linkedStudents.slice(0, 30));
    const results = await query.orderBy('createdAt', 'desc').limit(100).get();
    return response.json({ records: results.docs.map((document) => ({ id: document.id, ...document.data() })) });
  } catch (error) {
    console.error('Grades query failed:', error.message);
    return response.status(500).json({ error: 'Unable to load grades.' });
  }
});

router.post('/', requireRoles('teacher'), async (request, response) => {
  const firestore = getFirestore();
  if (!firestore) return response.status(503).json({ error: 'Firestore is not configured.' });
  const { studentId, subject, assessment, score, maxScore = 100, report } = request.body;
  if (typeof studentId !== 'string' || typeof subject !== 'string' || !subject.trim() ||
      typeof assessment !== 'string' || !assessment.trim() || !Number.isFinite(score) ||
      !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
    return response.status(400).json({ error: 'Provide a student, subject, assessment, and valid score.' });
  }

  try {
    const record = {
      studentId,
      subject: subject.trim(),
      assessment: assessment.trim(),
      score,
      maxScore,
      report: typeof report === 'string' ? report.trim().slice(0, 2000) : '',
      teacherId: request.schoolUser.id,
      createdAt: new Date().toISOString(),
    };
    const saved = await firestore.collection('grades').add(record);
    return response.status(201).json({ record: { id: saved.id, ...record } });
  } catch (error) {
    console.error('Grade upload failed:', error.message);
    return response.status(500).json({ error: 'Unable to save grade.' });
  }
});

module.exports = router;