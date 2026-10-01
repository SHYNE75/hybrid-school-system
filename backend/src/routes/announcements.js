const { Router } = require('express');
const { authenticate, requireRoles } = require('../middleware/authenticate');
const { getFirebaseAdmin, getFirestore } = require('../config/firebase');

const router = Router();
router.use(authenticate);

router.get('/', async (_request, response) => {
  const firestore = getFirestore();
  if (!firestore) return response.status(503).json({ error: 'Firestore is not configured.' });
  try {
    const results = await firestore.collection('announcements').orderBy('createdAt', 'desc').limit(50).get();
    return response.json({ records: results.docs.map((document) => ({ id: document.id, ...document.data() })) });
  } catch (error) {
    console.error('Announcements query failed:', error.message);
    return response.status(500).json({ error: 'Unable to load announcements.' });
  }
});

router.post('/', requireRoles('teacher'), async (request, response) => {
  const firestore = getFirestore();
  const firebaseAdmin = getFirebaseAdmin();
  if (!firestore || !firebaseAdmin) return response.status(503).json({ error: 'Firestore and Firebase Cloud Messaging are not configured.' });
  const { title, body, audience = 'all' } = request.body;
  if (typeof title !== 'string' || title.trim().length < 3 || typeof body !== 'string' || body.trim().length < 3 || !['all', 'students', 'parents', 'teachers'].includes(audience)) {
    return response.status(400).json({ error: 'Provide a title, message, and valid audience.' });
  }

  try {
    const announcement = { title: title.trim().slice(0, 120), body: body.trim().slice(0, 2000), audience, authorId: request.schoolUser.id, createdAt: new Date().toISOString() };
    const saved = await firestore.collection('announcements').add(announcement);
    const profiles = await firestore.collection('users').get();
    const tokens = profiles.docs
      .filter((profile) => audience === 'all' || profile.data().role === audience.slice(0, -1))
      .flatMap((profile) => profile.data().fcmTokens || [])
      .slice(0, 500);
    if (tokens.length) {
      await firebaseAdmin.messaging().sendEachForMulticast({
        tokens,
        notification: { title: announcement.title, body: announcement.body.slice(0, 180) },
        data: { announcementId: saved.id },
      });
    }
    return response.status(201).json({ announcement: { id: saved.id, ...announcement }, pushRecipients: tokens.length });
  } catch (error) {
    console.error('Announcement publish failed:', error.message);
    return response.status(500).json({ error: 'Unable to publish announcement.' });
  }
});

module.exports = router;