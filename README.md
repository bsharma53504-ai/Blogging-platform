# Inkwell — Full-Stack Blogging Platform

Inkwell is a responsive blogging platform built with React, Vite, Tailwind CSS, Flask, and MongoDB. It includes a reader experience, publishing tools, user accounts, and role-protected administration. Blog content, categories, users, comments, and likes are loaded from MongoDB; the interface does not use seeded/fake blog posts.

## Requirements

- Python 3.10 or newer
- Node.js 20.13 or newer and npm (for the frontend)
- MongoDB Community Server or a MongoDB Atlas connection string
- SMTP credentials to send password-reset emails

## Quick start

1. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`. Set `MONGODB_URI` and replace `JWT_SECRET` with a random secret of at least 32 characters.
2. Install backend and frontend dependencies:

   ```sh
   python -m venv .venv
   # Windows PowerShell: .venv\Scripts\Activate.ps1
   # macOS/Linux: source .venv/bin/activate
   pip install -r backend/requirements.txt
   npm install --prefix frontend
   npm install
   ```

3. Start MongoDB. The backend creates the configured database collections as needed and inserts the seven starter categories if they do not already exist.
4. Start Flask and the frontend together:

   ```sh
   npm run dev
   ```

   The frontend is served at `http://localhost:5173`; the Flask API listens at `http://localhost:5000`.

To run either side individually, use `python backend/app.py` or `npm run dev --prefix frontend`. For production, build the frontend with `npm run build` and start the API with `npm start`.

Run the backend smoke tests with `python -m unittest discover -s backend -p "test_*.py"`.

## Environment

`backend/.env.example` documents the Flask API settings:

- `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`
- `CLIENT_URL`, `PORT`
- `UPLOAD_DIR`, `MAX_FILE_SIZE_MB`
- Optional `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` for password reset

Install Python dependencies from `backend/requirements.txt`. `frontend/.env.example` documents `VITE_API_URL`. Configure the frontend and backend origins consistently when deploying. Uploaded images are stored on the API server under `backend/uploads` by default; use persistent storage or an object-storage service when deploying to ephemeral hosts.

## First administrator

Registration always creates a regular user. Create or promote an administrator from the repository root:

```sh
python backend/scripts/create_admin.py admin@example.com "Site Admin" "a-long-unique-password"
```

The command requires the backend environment file and enforces a 12-character minimum password. It hashes the password before saving it.

## Features

- Email/password registration and login, JWT sessions, bcrypt password hashing, protected routes, and admin role authorization
- Profile and password updates; expiring, single-use password reset links delivered through SMTP
- Published stories and drafts, ownership-protected editing/deletion, categories, tags, excerpts, image uploads, and estimated reading time
- Search across title, excerpt, body, and tags; category filtering, latest/oldest sorting, and pagination
- Likes, comments, related stories, and profile photos
- Personal writing dashboard and admin dashboards for users, stories, categories, and platform statistics
- Responsive reader interface, light/dark theme, loading/error states, and toast notifications

## API overview

All routes are prefixed with `/api`.

| Area | Routes |
| --- | --- |
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/profile`, `PATCH /auth/password`, `POST /auth/forgot-password`, `POST /auth/reset-password/:token` |
| Stories | `GET /blogs`, `GET /blogs/:slug`, `POST /blogs`, `PATCH /blogs/:id`, `DELETE /blogs/:id`, `POST /blogs/:slug/like` |
| Comments | `GET /blogs/:slug/comments`, `POST /blogs/:slug/comments`, `DELETE /blogs/comments/:id` |
| Categories | `GET /categories`; admin-only `POST`, `PATCH /:id`, and `DELETE /:id` |
| Uploads | Authenticated `POST /uploads` with multipart field `image` |
| Administration | Admin-only `GET /admin/stats`, `/admin/users`, `/admin/blogs`; user role and deletion routes |
| Health | `GET /health` |

`GET /blogs` accepts `search`, `category`, `sort=latest|oldest`, `page`, and `limit`. Authenticated requests may use `mine=true` and `status=draft|published|all` to list their own stories.

## Project layout

```text
backend/
  app.py            Flask REST API and MongoDB integration
  requirements.txt  Python dependencies
  scripts/          Administrator setup command
  uploads/         Local image uploads
frontend/
  src/
    components/    Shared navigation, cards, and loading UI
    context/       Authentication and toast contexts
    pages/         Reader, author, authentication, and admin screens
    services/      Axios API client
```

## Notes

- Reset-password emails are unavailable until SMTP is configured; the API returns a clear service-configuration error rather than exposing reset tokens.
- The default upload handler accepts JPEG, PNG, WebP, and GIF files up to 5 MB. Configure limits using `MAX_FILE_SIZE_MB`.
- The health endpoint verifies that the API process is responsive; database connectivity and starter categories are checked during API startup.
