require('dotenv').config();

const cors = require('cors');
const express = require('express');
const authRoutes = require('./src/routes/auth');
const attendanceRoutes = require('./src/routes/attendance');
const gradesRoutes = require('./src/routes/grades');
const feesRoutes = require('./src/routes/fees');
const { router: paymentRoutes, webhookRouter } = require('./src/routes/payments');
const announcementRoutes = require('./src/routes/announcements');

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({
  limit: '20kb',
  verify(request, _response, buffer) {
    if (request.originalUrl.startsWith('/api/payments/webhook')) request.rawBody = Buffer.from(buffer);
  },
}));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'hybrid-school-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/payments/webhook', webhookRouter);
app.use('/api/payments', paymentRoutes);
app.use('/api/announcements', announcementRoutes);

app.listen(port, () => {
  console.log(`Hybrid School API listening on port ${port}`);
});