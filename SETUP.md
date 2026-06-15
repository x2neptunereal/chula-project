# FinTrack — Setup Guide

## 1. Install dependencies

Run this in the project root (the `node_modules` from before only has the original packages):

```bash
pnpm install
```

This installs the new dependencies added to `package.json`:
- `mongoose` — MongoDB ODM
- `bcryptjs` — Password hashing
- `jose` — JWT (works on both Node.js and Edge runtimes)
- `date-fns` — Date formatting
- `react-hook-form`, `@hookform/resolvers`, `zod` — Form validation
- `sonner` — Toast notifications
- `react-day-picker` — Calendar picker (v8)
- `tesseract.js` — Client-side OCR for bank slips

## 2. Create `.env.local`

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/fintrack?retryWrites=true&w=majority
JWT_SECRET=your-random-secret-at-least-32-characters-long
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**MongoDB Atlas** (free tier works fine):
1. Go to https://cloud.mongodb.com
2. Create a cluster → Get the connection string
3. Paste it as `MONGODB_URI`

**JWT_SECRET**: Any random string, e.g. run `openssl rand -base64 32`

## 3. Run locally

```bash
pnpm dev
```

Open http://localhost:3000 — it redirects to `/overview` (or `/login` if not authenticated).

## 4. Deploy to Vercel

1. Push to GitHub
2. Import the repo in Vercel
3. Add environment variables in Vercel dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`
4. Deploy

## Project structure

```
app/
  (auth)/          — Login & Signup pages
  (dashboard)/     — Protected dashboard with sidebar
    overview/      — Summary cards + filterable transaction list
    expenses/      — Manual entry + bank slip OCR upload
    income/        — Income entry form
  api/
    auth/          — Login, signup, logout, me
    transactions/  — CRUD for income/expense records
    slips/check/   — Duplicate slip detection + save
lib/
  mongodb.ts       — MongoDB connection
  auth.ts          — JWT sign/verify/cookie helpers
  slip-parser.ts   — Thai bank slip OCR text parser
  models/          — Mongoose schemas (User, Transaction, Slip)
middleware.ts      — Route protection (redirects unauthenticated users)
components/ui/     — Shadcn UI components (Zinc theme)
```

## Supported banks for slip OCR

- **Krungthai** — reads `หมายเลขทำรายการ`
- **TrueMoney** — reads `รหัสธุรกรรม`
- **K-Bank** — reads `เลขที่รายการ`

The OCR pipeline: OpenCV.js (loaded from CDN) preprocesses the image → Tesseract.js (Thai + English) extracts text → regex patterns parse the transaction number, amount, and date.
