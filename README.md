# Stone Tracker

A mobile-friendly, Google-Material-styled project & task tracker web app backed by Supabase (Postgres) as the database.

## Stack
- Frontend: React (Vite) + Tailwind CSS, Material Design-inspired UI, fully responsive/mobile-first, PWA-ready
- Backend: Node.js + Express, @supabase/supabase-js, JWT auth, bcrypt password hashing
- Data store: Supabase Postgres (projects, tasks, users tables)
- Deployment target: GitHub -> Vercel

## Auth model
- Admin account is seeded manually (see backend/.env.example: ADMIN_USERNAME / ADMIN_PASSWORD_HASH)
- Admin logs in and creates user accounts (username + temp password) via Admin > Manage Users
- Regular users CANNOT reset or change their own password — only admin can update/reset a user's password
- JWT-based sessions, role field (admin / user) controls access to Admin routes

## Supabase schema
Run `supabase/schema.sql` once in your Supabase project's SQL Editor. It creates three tables:

**users**
| id | username | passwordHash | role | createdAt |

**projects**
| id | name | client | startDate | deadline | status |

**tasks**
| id | projectId | taskName | description | assignee | taskOwner | priority | status | startDate | dueDate | notes |

The backend talks to Supabase using the service_role key (server-side only), so Row Level Security stays enabled and locked down from any other client.

## Setup

### 1. Supabase
1. Create a new project at supabase.com.
2. Open the SQL Editor and run `supabase/schema.sql`.
3. Go to Project Settings > API and copy the Project URL and the `service_role` secret key.
4. Put these into `backend/.env` as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### 2. Backend
```
cd backend
npm install
cp .env.example .env   # fill in values
npm run dev
```

### 3. Frontend
```
cd frontend
npm install
npm run dev
```

### 4. Deploy to Vercel
1. Push this repo to GitHub (already done if you're reading this there).
2. In Vercel, "Add New... > Project" and import this GitHub repo.
3. Vercel will pick up `vercel.json` at the repo root, which builds the Express backend as a serverless function (routed under `/api/*`) and the Vite frontend as a static site.
4. In the Vercel project's Settings > Environment Variables, set: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`.
5. Deploy. Every push to `main` will auto-redeploy.
