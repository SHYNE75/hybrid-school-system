const { Router } = require('express');
const { authenticate, requireRoles } = require('../middleware/authenticate');
const { getFirestore } = require('../config/firebase');

const router = Router();

router.get('/api/admin/overview', authenticate, requireRoles('admin'), async (_request, response) => {
  const firestore = getFirestore();
  if (!firestore) return response.status(503).json({ error: 'Firestore is not configured.' });

  try {
    const [schoolSnapshot, usersSnapshot] = await Promise.all([
      firestore.collection('schools').doc('main').get(),
      firestore.collection('users').get(),
    ]);
    const accounts = usersSnapshot.docs.map((document) => {
      const profile = document.data();
      return {
        uid: document.id,
        name: profile.name || '',
        email: profile.email || '',
        role: profile.role || 'unknown',
        createdAt: profile.createdAt || null,
        linkedStudentCount: Array.isArray(profile.linkedStudents)
          ? profile.linkedStudents.length
          : Array.isArray(profile.studentIds) ? profile.studentIds.length : 0,
      };
    }).sort((left, right) =>
      left.role.localeCompare(right.role) || left.name.localeCompare(right.name));

    const counts = { total: accounts.length, admins: 0, teachers: 0, students: 0, parents: 0 };
    for (const account of accounts) {
      const key = `${account.role}s`;
      if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
    }

    return response.json({
      schoolName: schoolSnapshot.exists ? schoolSnapshot.data().name || '' : '',
      counts,
      accounts,
    });
  } catch (error) {
    console.error('Admin overview failed:', error.message);
    return response.status(500).json({ error: 'Unable to load school accounts.' });
  }
});

module.exports = router;
