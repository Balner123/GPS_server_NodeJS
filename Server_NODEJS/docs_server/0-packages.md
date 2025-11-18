Below is a human-friendly summary of the main dependencies used by the project. For exact versions see `package.json`.

Dependencies:

- `bcryptjs` — password hashing
- `connect-flash` — flash messages for web UI
- `cors` — Cross-Origin Resource Sharing helper
- `dotenv` — load env vars from `.env`
- `ejs` — server-side view templates
- `express` — web framework
- `express-rate-limit` — rate limiting middleware
- `express-session` — session management
- `express-validator` — request validation
- `mysql2` — MySQL driver for Sequelize
- `nodemailer` — sending emails (verification, notifications)
- `passport` — authentication framework
- `passport-github2` — GitHub OAuth strategy
- `passport-google-oauth20` — Google OAuth strategy
- `sequelize` — ORM for MySQL
- `swagger-jsdoc` — JSDoc -> OpenAPI generation
- `swagger-ui-express` — serve Swagger UI

DevDependencies:

- `nodemon` — automatic server restart during development

Scripts (from `package.json`):

- `npm run start` — `node server.js` (production/runtime)
- `npm run dev` — `nodemon server.js` (development)

Tip: Always consult `package.json` for the authoritative, up-to-date dependency list and versions.