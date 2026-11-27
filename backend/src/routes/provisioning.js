const { Router } = require('express');
const { authenticate, requireRoles } = require('../middleware/authenticate');
const { addTeacher, addStudent, addParent } = require('../services/firestoreService');

const router = Router();

function validateNameAndEmail(name, email) {
  return typeof name === 'string' && name.trim().length >= 2 &&
    typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function handleProvision(handler, label) {
  return async (request, response) => {
    try {
      const result = await handler(request, response);
      if (response.headersSent) return;
      if (result) return response.status(201).json({ [label]: result });
    } catch (error) {
      const status = error.message.includes('not configured') ? 503 : 400;
      console.error(`${label} provisioning failed:`, error.message);
      if (!response.headersSent) return response.status(status).json({ error: error.message || `Unable to add ${label}.` });
    }
  };
}

async function createTeacher(request, response) {
  const { name, email } = request.body;
  if (!validateNameAndEmail(name, email)) return response.status(400).json({ error: 'Enter a valid name and email.' });
  return addTeacher(name.trim(), email.trim());
}

async function createStudent(request, response) {
  const { uid, name, email } = request.body;
  if (typeof uid !== 'string' || !uid.trim() || !validateNameAndEmail(name, email)) return response.status(400).json({ error: 'Enter a valid Firebase UID, name, and email.' });
  return addStudent(uid.trim(), name.trim(), email.trim());
}

async function createParent(request, response) {
  const { name, email, linkedStudents } = request.body;
  if (!validateNameAndEmail(name, email) || !Array.isArray(linkedStudents)) return response.status(400).json({ error: 'Enter a valid name, email, and array of student UIDs.' });
  return addParent(name.trim(), email.trim(), linkedStudents);
}

router.post(['/addTeacher', '/api/addTeacher'], authenticate, requireRoles('admin'), handleProvision(createTeacher, 'teacher'));
router.post(['/addStudent', '/api/addStudent'], authenticate, requireRoles('admin'), handleProvision(createStudent, 'student'));
router.post(['/addParent', '/api/addParent'], authenticate, requireRoles('admin'), handleProvision(createParent, 'parent'));

module.exports = router;