# NuviGo server

Serves the NuviGo demo and runs NuviGo accounts (sign-up, sign-in and sync).

## Railway setup
1. New Project -> Deploy from GitHub repo -> this repo.
2. Add a Postgres database to the project (New -> Database -> PostgreSQL).
3. In this service's Variables add:
   - `DATABASE_URL` = reference the Postgres service's `DATABASE_URL` (use the "Add reference" option)
   - `JWT_SECRET` = a long random string (for example 64 random characters). Keep it private; changing it signs everyone out and makes synced logins unreadable.
   - `TMDB_API_KEY` (optional) = real posters in the demo
   - `OMDB_API_KEY` (optional) = IMDb and Rotten Tomatoes ratings and descriptions in the demo
4. Settings -> Networking -> Generate Domain. Put that address in the app's `Config.swift` as `serverURL`.

Without `DATABASE_URL` and `JWT_SECRET` the demo still runs and the account routes answer 503.

## Account API
- `POST /api/auth/register`, `POST /api/auth/login` with `{email, password}` -> `{token, user}`
- `GET /api/me`, `DELETE /api/me` (body `{password}`)
- `GET /api/sync`, `PUT /api/sync/{addons|progress|settings|links}` with `{data}`

Passwords are hashed with bcrypt. Synced logins (`links`) are encrypted at rest with a key derived from `JWT_SECRET`.
There's no password reset yet (that needs an email service).

`npm test` runs the account tests against an in-memory database.

## Error reports

The app sends short anonymous error messages to `POST /api/report` (no account, email, watch history or links). They are printed in the Railway logs and, if `DATABASE_URL` is set, saved to an `error_reports` table.

To read them, set an `ADMIN_KEY` variable on Railway and open `/api/reports?key=YOUR_KEY` (or send it as an `x-admin-key` header). Without `ADMIN_KEY` the list is disabled and you can still read reports in the logs.
