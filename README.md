# LuckyNorthStar — Sweepstakes Casino Skeleton

This is a minimal monorepo with **Next.js (web)** and **Express + Prisma (API)**.

## Quick start (local)

```bash
# 1) Install deps
npm i

# 2) Configure envs
# apps/api/.env
# DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
# JWT_SECRET=devsecret
# WEB_ORIGIN=http://localhost:3000

# apps/web/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000

# 3) Generate client & run migrations
npx prisma generate
npx prisma migrate dev --name init

# 4) Run API and Web in two terminals
npm run dev:api
npm run dev:web
```

## Push to GitHub

### Option A — GitHub CLI (easiest)
```bash
# inside repo folder
gh auth login           # if needed
git init
git add .
git commit -m "Initial commit: sweepstakes skeleton"
gh repo create LuckyNorthStar --public --source=. --remote=origin --push
```

### Option B — plain git + HTTPS
```bash
git init
git add .
git commit -m "Initial commit: sweepstakes skeleton"
git branch -M main
git remote add origin https://github.com/<your-username>/LuckyNorthStar.git
git push -u origin main
```

Then connect the web to **Vercel** and the API to **Railway** or your preferred host.
