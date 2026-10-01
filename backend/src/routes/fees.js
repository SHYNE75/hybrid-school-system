const { Router } = require('express');
const { authenticate, requireRoles } = require('../middleware/authenticate');
const { getFirestore } = require('../config/firebase');

const router = Router();
router.use(authenticate, requireRoles('parent'));

router.get('/', async (request, response) => {
  const firestore = getFirestore();
  if (!firestore) return response.status(503).json({ error: 'Firestore is not configured.' });
  try {
    const linkedStudents = request.schoolUser.studentIds || [];
    if (!linkedStudents.length) return response.json({ records: [] });
    const records = await firestore.collection('fees').where('studentId', 'in', linkedStudents.slice(0, 30)).orderBy('dueDate', 'desc').get();
    return response.json({ records: records.docs.map((document) => ({ id: document.id, ...document.data() })) });
  } catch (error) {
    console.error('Fees query failed:', error.message);
    return response.status(500).json({ error: 'Unable to load fee records.' });
  }
});

module.exports = router;