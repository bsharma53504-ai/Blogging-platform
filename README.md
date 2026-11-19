# Inkwell — Full-Stack Blogging Platform

Inkwell is a responsive blogging platform built with React, Vite, Tailwind CSS, Express, MongoDB, and Mongoose. It includes a reader experience, publishing tools, user accounts, and role-protected administration. Blog content, categories, users, comments, and likes are loaded from MongoDB; the interface does not use seeded/fake blog posts.

## Requirements

- Node.js 20.13 or newer and npm
- MongoDB Community Server or a MongoDB Atlas connection string
- SMTP credentials to send password-reset emails

## Quick start

1. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`. Set `MONGODB_URI` and replace `JWT_SECRET` with a long random secret.
2. Install dependencies from the repository root:

   ```sh
   npm install
   npm install --prefix backend
   npm install --prefix frontend
   ```

3. Start MongoDB. The backend creates the configured database collections as needed and inserts the seven starter categories if they do not already exist.
4. Start the frontend and API together:

   ```sh
   npm run dev
   ```

   The frontend is served at `http://localhost:5173`; the API listens at `http://localhost:5000`.

To run either side individually, use `npm run dev --prefix backend` or `npm run dev --prefix frontend`. For production, build the frontend with `npm run build` and start the API with `npm start`.

## Environment

`backend/.env.example` documents the API settings:

- `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`
- `CLIENT_URL`, `PORT`
- `UPLOAD_DIR`, `MAX_FILE_SIZE_MB`
- Optional `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` for password reset

`frontend/.env.example` documents `VITE_API_URL`. Configure the frontend and backend origins consistently when deploying. Uploaded images are stored on the API server under `backend/uploads` by default; use persistent storage or an object-storage service when deploying to ephemeral hosts.

## First administrator

Registration always creates a regular user. Create or promote an administrator explicitly from the backend directory:

```sh
npm run seed:admin -- admin@example.com "Site Admin" "a-long-unique-password"
```

The admin command requires the backend environment file and enforces a 12-character minimum password. It hashes the password before saving it.

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
  config/          MongoDB connection and starter categories
  controllers/     Authentication, blog, category, comment, and admin handlers
  middleware/      JWT authorization, async wrapper, and API error handling
  models/          Mongoose User, Blog, Comment, and Category models
  routes/          REST API routes
  scripts/         Administrator setup command
  uploads/         Local image uploads
  server.js
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
- The health endpoint verifies that the API process is responsive; database connectivity is checked during API startup.
