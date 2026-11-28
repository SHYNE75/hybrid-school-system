const { getFirebaseAdmin, getFirestore } = require('../config/firebase');

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function findOrCreateAuthUser(admin, name, email) {
  const normalizedEmail = normalizeEmail(email);
  try {
    return await admin.auth().getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    return admin.auth().createUser({ email: normalizedEmail, displayName: String(name).trim() });
  }
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

  const roleRef = firestore.collection(`${role}s`).doc(uid);
  const userRef = firestore.collection('users').doc(uid);
  const [existingRole, existingProfile] = await Promise.all([roleRef.get(), userRef.get()]);
  if (existingProfile.exists && existingProfile.data().role !== role) {
    throw new Error('This account already has a different school role.');
  }

  const now = new Date().toISOString();
  const createdAt = existingProfile.data()?.createdAt || existingRole.data()?.createdAt || now;
  const roleRecord = {
    uid,
    name: String(name).trim(),
    email: normalizedEmail,
    role,
    createdAt,
    updatedAt: now,
  };
  if (role === 'parent') roleRecord.linkedStudents = [...new Set(linkedStudents)];

  const batch = firestore.batch();
  batch.set(roleRef, roleRecord, { merge: true });
  batch.set(userRef, {
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
  const userRecord = await findOrCreateAuthUser(admin, name, normalizedEmail);
  const teacher = await saveRoleProfile({ uid: userRecord.uid, name, email: normalizedEmail, role: 'teacher' });
  const passwordSetupLink = await admin.auth().generatePasswordResetLink(normalizedEmail);
  return { ...teacher, passwordSetupLink };
}

async function addStudent(name, email) {
  const admin = getFirebaseAdmin();
  if (!admin) throw new Error('Firebase Admin credentials are not configured.');
  const normalizedEmail = normalizeEmail(email);
  const userRecord = await findOrCreateAuthUser(admin, name, normalizedEmail);
  const student = await saveRoleProfile({ uid: userRecord.uid, name, email: normalizedEmail, role: 'student' });
  const passwordSetupLink = await admin.auth().generatePasswordResetLink(normalizedEmail);
  return { ...student, passwordSetupLink };
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
  const userRecord = await findOrCreateAuthUser(admin, name, normalizedEmail);
  const parent = await saveRoleProfile({ uid: userRecord.uid, name, email: normalizedEmail, role: 'parent', linkedStudents: uniqueStudentIds });
  const passwordSetupLink = await admin.auth().generatePasswordResetLink(normalizedEmail);
  return { ...parent, passwordSetupLink };
}

module.exports = { addTeacher, addStudent, addParent, saveRoleProfile };