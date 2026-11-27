const { getFirebaseAdmin, getFirestore } = require('../config/firebase');

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function saveRoleProfile({ uid, name, email, role, linkedStudents = [] }) {
  const admin = getFirebaseAdmin();
  const firestore = getFirestore();
  if (!admin || !firestore) throw new Error('Firebase Admin credentials are not configured.');

  const normalizedEmail = normalizeEmail(email);
  const userRecord = await admin.auth().getUser(uid);
  if (userRecord.email && normalizeEmail(userRecord.email) !== normalizedEmail) {
    throw new Error('The email does not match the Firebase account.');
  }

  const roleRecord = {
    uid,
    name: String(name).trim(),
    email: normalizedEmail,
    role,
    updatedAt: new Date().toISOString(),
  };
  if (role === 'parent') roleRecord.linkedStudents = [...new Set(linkedStudents)];

  const roleRef = firestore.collection(`${role}s`).doc(uid);
  const existingRole = await roleRef.get();
  if (role === 'student') roleRecord.createdAt = existingRole.data()?.createdAt || new Date().toISOString();

  const batch = firestore.batch();
  batch.set(roleRef, roleRecord, { merge: true });
  batch.set(firestore.collection('users').doc(uid), {
    ...roleRecord,
    ...(role === 'parent' ? { studentIds: roleRecord.linkedStudents } : {}),
  }, { merge: true });
  await batch.commit();

  const claims = { ...userRecord.customClaims, role };
  delete claims.linkedStudents;
  if (role === 'parent') claims.linkedStudents = roleRecord.linkedStudents;
  await admin.auth().setCustomUserClaims(uid, claims);

  return roleRecord;
}

async function addTeacher(name, email) {
  const admin = getFirebaseAdmin();
  if (!admin) throw new Error('Firebase Admin credentials are not configured.');
  const normalizedEmail = normalizeEmail(email);
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    userRecord = await admin.auth().createUser({ email: normalizedEmail, displayName: String(name).trim() });
  }
  const teacher = await saveRoleProfile({ uid: userRecord.uid, name, email: normalizedEmail, role: 'teacher' });
  const passwordSetupLink = await admin.auth().generatePasswordResetLink(normalizedEmail);
  return { ...teacher, passwordSetupLink };
}

async function addStudent(uid, name, email) {
  if (typeof uid !== 'string' || !uid.trim()) throw new Error('A Firebase UID is required.');
  return saveRoleProfile({ uid: uid.trim(), name, email, role: 'student' });
}

async function addParent(name, email, linkedStudents) {
  const admin = getFirebaseAdmin();
  const firestore = getFirestore();
  if (!admin || !firestore) throw new Error('Firebase Admin credentials are not configured.');
  if (!Array.isArray(linkedStudents) || !linkedStudents.length || linkedStudents.length > 20 || linkedStudents.some((uid) => typeof uid !== 'string' || !uid.trim())) {
    throw new Error('Link between 1 and 20 valid student UIDs.');
  }

  const uniqueStudentIds = [...new Set(linkedStudents.map((uid) => uid.trim()))];
  const students = await Promise.all(uniqueStudentIds.map((uid) => firestore.collection('students').doc(uid).get()));
  if (students.some((student) => !student.exists)) throw new Error('Every linked UID must belong to an existing student.');

  const normalizedEmail = normalizeEmail(email);
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    userRecord = await admin.auth().createUser({ email: normalizedEmail, displayName: String(name).trim() });
  }
  const parent = await saveRoleProfile({ uid: userRecord.uid, name, email: normalizedEmail, role: 'parent', linkedStudents: uniqueStudentIds });
  const passwordSetupLink = await admin.auth().generatePasswordResetLink(normalizedEmail);
  return { ...parent, passwordSetupLink };
}

module.exports = { addTeacher, addStudent, addParent, saveRoleProfile };