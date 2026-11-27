# Hybrid School System Setup

## Requirements

- Node.js 20 or later
- MySQL 8 or later
- Firebase project with Email/Password Authentication enabled
- Paystack test keys for payment testing

## Local development

1. Create the database and tables with `backend/schema.sql`.
2. Copy `backend/.env.example` to `backend/.env`. Generate a strong JWT secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`; set MySQL and Firebase Admin credentials. Add a newly rotated Paystack secret only on the backend.
3. Copy `frontend/.env.example` to `frontend/.env`. Set the Firebase Web app values. The repository's local `frontend/.env` is ignored by Git and must not be deployed as a file.
4. Install and run each package in separate terminals:

```powershell
cd backend
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

The frontend is available at `http://localhost:5173`; the backend health check is `http://localhost:4000/api/health`.

## Account setup and data model

Firebase Auth handles registration and sign-in. The API verifies Firebase ID tokens with the Admin SDK, stores a role-specific record, and sets a Firebase custom `role` claim; it does not trust the role selector in the browser. Every Firebase login creates/repairs the matching role document. A new account defaults to student unless its UID is included in `ADMIN_UIDS`.

To bootstrap an administrator, create/sign in the admin account in Firebase Auth, copy its UID from the Firebase console, then set `ADMIN_UIDS` to that UID in the backend environment and restart the API. The first profile login will provision the admin role and claim. Additional admin UIDs may be comma-separated. Only admins can call `POST /addTeacher`, `POST /addStudent`, and `POST /addParent` (the `/api/...` aliases are also mounted).

Teacher/parent routes create Firebase Auth accounts when needed, write `teachers/{uid}` or `parents/{uid}` plus `users/{uid}`, and return a password setup link. Deliver that link through a private approved channel. Parent `linkedStudents` must contain existing Firebase student UIDs. Student signup writes `students/{uid}` using the authenticated Firebase UID.

Collections used by the API:

- `users/{uid}`: shared identity data and lookup profile.
- `students/{uid}`: `name`, `email`, `role`, `fcmTokens`, and timestamps.
- `teachers/{uid}`: `name`, `email`, `role`, and timestamps.
- `parents/{uid}`: `name`, `email`, `role`, and `linkedStudents` UID array.
- `attendance/{studentId_YYYY-MM-DD}`: `studentId`, `status`, `date`, `source`, and `markedBy`.
- `grades/{gradeId}`: `studentId`, `subject`, `assessment`, `score`, `maxScore`, `report`, and `teacherId`.
- `fees/{feeId}`: `studentId`, `title`, `amountKobo` (integer minor units), `dueDate`, and `status`.
- `payments/{reference}` and `announcements/{announcementId}`: written by the backend only.

Apply Firestore rules and indexes using the Firebase CLI from the repository root: `firebase deploy --only firestore:rules,firestore:indexes`. Rules use verified `request.auth.token.role` and `linkedStudents` claims, deny client writes to role records and transactional data, and grant admins the catch-all rule. Provisioning and data mutations go through the role-checked Express API. The `backend/schema.sql` MySQL table is only used by the optional JWT login/register fallback.

## Firebase configuration

Set the frontend `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID` from the Firebase Web app config. For web push, generate a Web Push certificate in Firebase and set `VITE_FIREBASE_VAPID_KEY`; deploy the included `frontend/public/firebase-messaging-sw.js` over HTTPS. Set backend `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` from a service account. Never commit service-account JSON or private keys.

For Render, add the Firebase JSON credential as a Secret File named exactly `serviceAccountKey.json`; Render mounts it at `/etc/secrets/serviceAccountKey.json`. Locally, the backend falls back to `backend/serviceAccountKey.json`. An optional `FIREBASE_SERVICE_ACCOUNT_PATH` overrides both paths. The credential filename pattern is ignored by Git.

## Paystack configuration

Set a newly rotated `PAYSTACK_SECRET_KEY` in the backend environment. The parent fee screen uses server-initialized hosted checkout, so the secret stays server-side; the public `pk_` key is not needed by this flow. Fee records must be provisioned in Firestore with integer `amountKobo`. Configure the Paystack webhook to `https://<render-host>/api/payments/webhook`; signature, amount, currency, and transaction reference are verified before a fee is marked paid. Use test keys until the full payment flow is tested.

## Deployment notes

- **Vercel:** select `frontend` as the project root; `frontend/vercel.json` rewrites SPA paths. Configure all required `VITE_*` values in project settings and set `VITE_API_URL` to the Render API origin.
- **Netlify:** `netlify.toml` configures the frontend build and SPA fallback. Set the same `VITE_*` values in Netlify.
- **Render:** `render.yaml` defines the API service, health check, and required environment variables. Set `CLIENT_ORIGIN` to the deployed frontend origin; do not upload `.env` files.
- **Heroku:** `backend/Procfile` starts the API with `npm start`; configure the same backend environment values in app settings.
- Provision a managed MySQL database only if using the optional JWT fallback, then apply `backend/schema.sql`.

The Paystack secret and Firebase service-account private key pasted into chat are compromised: revoke both in their respective consoles, create replacements, and set the new values directly in the backend hosting environment. Do not copy the exposed values into `.env` or source control. Firebase Web API keys and FCM VAPID keys are client-side values; restrict the Firebase API key to the required APIs and domains. Use `.env.example` as a key list, not as a place for real credentials.