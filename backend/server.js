require('dotenv').config();

const cors = require('cors');
const express = require('express');
const authRoutes = require('./src/routes/auth');
const attendanceRoutes = require('./src/routes/attendance');
const gradesRoutes = require('./src/routes/grades');
const feesRoutes = require('./src/routes/fees');
const { router: paymentRoutes, webhookRouter } = require('./src/routes/payments');
const announcementRoutes = require('./src/routes/announcements');
const adminRoutes = require('./src/routes/admin');
const provisioningRoutes = require('./src/routes/provisioning');

const app = express();
const port = Number(process.env.PORT) || 4000;
const allowedOrigins = new Set([
  ...(process.env.CLIENT_ORIGIN || '').split(',').map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean),
  'https://hybrid-school-system.onrender.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
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
app.use(adminRoutes);
app.use(provisioningRoutes);

app.use((request, response) => {
  response.status(404).json({ error: 'API route not found.', path: request.originalUrl });
});

app.use((error, _request, response, _next) => {
  console.error('Unhandled API error:', error.message);
  response.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
});

app.listen(port, () => {
  console.log(`Hybrid School API listening on port ${port}`);
});