# Stone Tracker

A mobile-friendly, Google-Material-styled project & task tracker web app backed by Google Sheets as the database.

## Stack
- Frontend: React (Vite) + Tailwind CSS, Material Design-inspired UI, fully responsive/mobile-first, PWA-ready
- Backend: Node.js + Express, googleapis (Google Sheets API), JWT auth, bcrypt password hashing
- Data store: Google Sheets (Projects, Tasks, Users tabs)
- Deployment target: GitHub -> Hostinger (Node.js Web App / VPS)

## Auth model
- Admin account is seeded manually (see backend/.env.example: ADMIN_USERNAME / ADMIN_PASSWORD_HASH)
- Admin logs in and creates user accounts (username + temp password) via Admin > Manage Users
- Regular users CANNOT reset or change their own password — only admin can update/reset a user's password
- JWT-based sessions, role field (admin / user) controls access to Admin routes

## Google Sheet structure required
Create one Google Sheet named "Stone Tracker DB" with 3 tabs:

**Users**
| id | username | passwordHash | role | createdAt |

**Projects**
| id | name | client | startDate | deadline | status |

**Tasks**
| id | projectId | taskName | description | assignee | taskOwner | priority | status | startDate | dueDate | notes |

## Setup

### 1. Google Cloud
1. Create a Google Cloud project, enable "Google Sheets API".
2. Create a Service Account, generate a JSON key.
3. Share your "Stone Tracker DB" sheet with the service account email (Editor access).
4. Put the JSON key contents into backend/.env as GOOGLE_SERVICE_ACCOUNT_KEY (base64 or path).

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

### 4. Deploy
- Push this repo to a new GitHub repository.
- In Hostinger hPanel > Websites, create the subdomain (e.g. tracker.yourdomain.com).
- Use Hostinger's "Node.js Web App" or GitHub auto-deploy to point to this repo.
- Set the same environment variables in Hostinger's Node.js app config.
- Build frontend (`npm run build`) and serve the `dist/` folder via backend static middleware or Hostinger static hosting.
