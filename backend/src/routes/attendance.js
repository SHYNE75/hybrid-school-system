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
    let query = firestore.collection('attendance');
    if (studentId) query = query.where('studentId', '==', String(studentId));
    else if (request.schoolUser.role === 'parent') query = query.where('studentId', 'in', linkedStudents.slice(0, 30));
    const records = await query.orderBy('date', 'desc').limit(100).get();
    return response.json({ records: records.docs.map((document) => ({ id: document.id, ...document.data() })) });
  } catch (error) {
    console.error('Attendance query failed:', error.message);
    return response.status(500).json({ error: 'Unable to load attendance.' });
  }
});

router.post('/', requireRoles('student', 'teacher'), async (request, response) => {
  const firestore = getFirestore();
  if (!firestore) return response.status(503).json({ error: 'Firestore is not configured.' });

  const { studentId, status = 'present', date, source = 'online' } = request.body;
  const markedAt = date || new Date().toISOString().slice(0, 10);
  if (typeof studentId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(markedAt) || !['present', 'late', 'absent'].includes(status) || !['online', 'qr'].includes(source)) {
    return response.status(400).json({ error: 'Provide a student ID, valid date, status, and source.' });
  }
  if (request.schoolUser.role === 'student' && studentId !== request.schoolUser.id) {
    return response.status(403).json({ error: 'Students may only mark their own attendance.' });
  }

  try {
    const record = {
      studentId,
      status,
      date: markedAt,
      source,
      markedBy: request.schoolUser.id,
      updatedAt: new Date().toISOString(),
    };
    const id = `${studentId}_${markedAt}`;
    await firestore.collection('attendance').doc(id).set(record, { merge: true });
    return response.status(201).json({ record: { id, ...record } });
  } catch (error) {
    console.error('Attendance save failed:', error.message);
    return response.status(500).json({ error: 'Unable to save attendance.' });
  }
});

module.exports = router;