# Onusandhan — PhD Thesis Evaluator
**Firebase Project:** `onusandhan-prod` | **Hosting:** Hostinger Node.js

AI-powered thesis evaluation · 9 criterion groups · 52 criteria · UGC 2022 · Shodhganga · DRC/RAC

---

## Quick Setup (15 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Create `.env.local` from template
```bash
cp .env.example .env.local
```
Fill in these values in `.env.local`:

| Variable | Where to get it |
|---|---|
| Firebase client vars | Already in `.env.example` — your `onusandhan-prod` config |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Console → Project Settings → Service Accounts → Generate key |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Same JSON file — copy the `private_key` value |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `GOOGLE_GEMINI_API_KEY` | aistudio.google.com → Get API Key |
| `NEXT_PUBLIC_APP_URL` | Your Hostinger domain |

### 3. Run locally
```bash
npm run dev
# Visit http://localhost:3000
```

### 4. Deploy Firestore indexes
```bash
npm install -g firebase-tools
firebase login
firebase use onusandhan-prod
firebase deploy --only firestore:indexes
```
> Rules are already deployed (confirmed in your screenshots)

---

## Hostinger Deployment

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Initial deployment — Onusandhan PhD Thesis Evaluator"
git push origin main
```

### Step 2: Connect in hPanel
1. Login → Websites → Add Website → **Node.js Web App**
2. Connect GitHub → select `bcicomputerpoint-web/thesis-evaluator` → branch `main`
3. Build command: `npm run build`
4. Start command: `npm run start`
5. Node.js version: **18.x**

### Step 3: Add Environment Variables in hPanel
Go to: Website → Node.js → Environment Variables

Add ALL variables from `.env.example`:
- Firebase client vars (already filled — just copy)
- `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` from service account JSON
- `ANTHROPIC_API_KEY` from Anthropic Console
- `GOOGLE_GEMINI_API_KEY` from Google AI Studio
- `NEXT_PUBLIC_APP_URL` = your Hostinger domain URL

**Important for `FIREBASE_ADMIN_PRIVATE_KEY`:**  
In Hostinger env vars, the key must be on ONE LINE with `\n` literals:
```
-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n
```

### Step 4: Add domain to Firebase Auth
Firebase Console → Authentication → Settings → Authorized Domains → Add your domain

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── evaluate/route.ts      ← AI evaluation (Claude/Gemini/Hybrid)
│   │   ├── report/route.ts        ← PDF generation
│   │   └── save-evaluation/route.ts ← Firestore save
│   ├── (auth)/
│   │   ├── login/page.tsx         ← Login (email + Google)
│   │   └── register/page.tsx      ← Register with role selection
│   ├── dashboard/page.tsx         ← Scholar/Supervisor/RAC/DRC dashboard
│   ├── evaluate/page.tsx          ← Full evaluation wizard
│   ├── layout.tsx                 ← Root layout with AuthProvider
│   └── globals.css
├── lib/
│   ├── firebase.ts                ← Client SDK (onusandhan-prod config)
│   ├── firebase-admin.ts          ← Server-only Admin SDK
│   ├── auth-context.tsx           ← Auth provider + hooks
│   └── db.ts                      ← Firestore operations
└── types/index.ts                 ← All TypeScript types
```

---

## Firebase Project: onusandhan-prod

| Service | Status |
|---|---|
| Authentication | Enable Email/Password + Google in Firebase Console |
| Firestore | Rules already deployed ✅ |
| Storage | Rules already deployed ✅ |
| Project ID | `onusandhan-prod` |
| Storage bucket | `onusandhan-prod.firebasestorage.app` |

### Set yourself as DRC Admin
1. Register on the app with your email
2. Firebase Console → Firestore → `users` collection → find your document
3. Change `role` field from `"scholar"` to `"drc_admin"`

---

## User Roles

| Role | Access |
|---|---|
| `scholar` | Run evaluations, view own results, download reports |
| `supervisor` | View scholars' evaluations, add supervisor notes |
| `rac_member` | View all evaluations in department |
| `drc_admin` | Full university-wide access, can manage all data |

---

## Cost Estimate

| Service | Cost |
|---|---|
| Hostinger Business hosting | ~₹450/month |
| Firebase (Firestore + Auth + Storage) | Free tier covers ~500 evaluations/day |
| Claude API | ~₹0.25 per evaluation |
| Gemini API | Free tier (60 req/min) |
| **Total** | **~₹450/month + AI usage** |
