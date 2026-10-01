const { Router } = require('express');
const crypto = require('node:crypto');
const { authenticate, requireRoles } = require('../middleware/authenticate');
const { getFirestore } = require('../config/firebase');

const router = Router();

router.post('/initialize', authenticate, requireRoles('parent'), async (request, response) => {
  const firestore = getFirestore();
  if (!firestore) return response.status(503).json({ error: 'Firestore is not configured.' });
  if (!process.env.PAYSTACK_SECRET_KEY) return response.status(503).json({ error: 'Paystack is not configured.' });
  const { feeId } = request.body;
  if (typeof feeId !== 'string') return response.status(400).json({ error: 'A fee record is required.' });

  try {
    const feeRef = firestore.collection('fees').doc(feeId);
    const feeSnapshot = await feeRef.get();
    if (!feeSnapshot.exists) return response.status(404).json({ error: 'Fee record was not found.' });
    const fee = feeSnapshot.data();
    const linkedStudents = request.schoolUser.studentIds || [];
    if (!linkedStudents.includes(fee.studentId) || fee.status === 'paid' || !Number.isInteger(fee.amountKobo) || fee.amountKobo <= 0) {
      return response.status(403).json({ error: 'This fee cannot be paid from your account.' });
    }

    const reference = `school_${crypto.randomUUID()}`;
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: request.schoolUser.email,
        amount: fee.amountKobo,
        reference,
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
        metadata: { feeId, studentId: fee.studentId, parentId: request.schoolUser.id },
      }),
    });
    const result = await paystackResponse.json();
    if (!paystackResponse.ok || !result.status) return response.status(502).json({ error: result.message || 'Paystack could not initialize payment.' });

    await firestore.collection('payments').doc(reference).set({
      reference,
      feeId,
      studentId: fee.studentId,
      parentId: request.schoolUser.id,
      amountKobo: fee.amountKobo,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    return response.json({ authorizationUrl: result.data.authorization_url, reference });
  } catch (error) {
    console.error('Payment initialization failed:', error.message);
    return response.status(500).json({ error: 'Unable to initialize payment.' });
  }
});

router.get('/verify/:reference', authenticate, requireRoles('parent'), async (request, response) => {
  const firestore = getFirestore();
  if (!firestore || !process.env.PAYSTACK_SECRET_KEY) return response.status(503).json({ error: 'Payments are not configured.' });
  try {
    const paymentRef = firestore.collection('payments').doc(request.params.reference);
    const paymentSnapshot = await paymentRef.get();
    if (!paymentSnapshot.exists || paymentSnapshot.data().parentId !== request.schoolUser.id) return response.status(404).json({ error: 'Payment was not found.' });

    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(request.params.reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const result = await paystackResponse.json();
    if (!paystackResponse.ok || !result.status) return response.status(502).json({ error: result.message || 'Unable to verify payment.' });
    if (result.data.status === 'success') {
      const payment = paymentSnapshot.data();
      if (result.data.amount !== payment.amountKobo || result.data.currency !== 'NGN') {
        return response.status(400).json({ error: 'Verified payment amount does not match the fee.' });
      }
      await paymentRef.update({ status: 'paid', verifiedAt: new Date().toISOString() });
      await firestore.collection('fees').doc(payment.feeId).update({ status: 'paid', paidAt: new Date().toISOString(), paymentReference: request.params.reference });
    }
    return response.json({ status: result.data.status, reference: request.params.reference });
  } catch (error) {
    console.error('Payment verification failed:', error.message);
    return response.status(500).json({ error: 'Unable to verify payment.' });
  }
});

module.exports = { router, webhookRouter: createWebhookRouter() };

function createWebhookRouter() {
  const webhook = Router();
  webhook.post('/', async (request, response) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = request.get('x-paystack-signature');
    if (!secret || !signature || !Buffer.isBuffer(request.rawBody)) return response.sendStatus(401);
    const expected = crypto.createHmac('sha512', secret).update(request.rawBody).digest('hex');
    if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return response.sendStatus(401);
    if (request.body.event !== 'charge.success') return response.sendStatus(200);

    const firestore = getFirestore();
    if (!firestore) return response.sendStatus(503);
    const transaction = request.body.data || {};
    try {
      const paymentRef = firestore.collection('payments').doc(transaction.reference);
      const snapshot = await paymentRef.get();
      if (!snapshot.exists) return response.sendStatus(200);
      const payment = snapshot.data();
      if (payment.amountKobo !== transaction.amount || transaction.currency !== 'NGN') return response.sendStatus(400);
      await paymentRef.update({ status: 'paid', verifiedAt: new Date().toISOString() });
      await firestore.collection('fees').doc(payment.feeId).update({ status: 'paid', paidAt: new Date().toISOString(), paymentReference: transaction.reference });
      return response.sendStatus(200);
    } catch (error) {
      console.error('Paystack webhook failed:', error.message);
      return response.sendStatus(500);
    }
  });
  return webhook;
}