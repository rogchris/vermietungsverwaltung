# Vermietungsverwaltung

[Deutsch](README.md)

Vermietungsverwaltung is a German-language web app for managing rental contracts, monthly charges, payments and related documents. The [synthetic demo](docs/DEMO.md) follows a €900 monthly charge, a €600 payment and the €300 balance through to a PDF report.

## What it does

- Records properties, units and tenants, and keeps a history of lease terms.
- Generates monthly charges from the active lease terms and records partial payments and expenses. [Finance rules](docs/FINANCE.md)
- Stores uploads in private storage and runs PDF report jobs in a separate worker.
- Calculates acquisition scenarios and assembles a package for a lender. [Acquisition](docs/ACQUISITION.md) · [Lender package](docs/BANK_PACKAGE.md)

Next.js and TypeScript handle the UI and server-side actions. Prisma and PostgreSQL store business records and report jobs. [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md)

## Run locally

Use the Node.js version in `.node-version`, npm 11 and PostgreSQL 17. Docker Compose can start the local database.

1. Copy `.env.example` to `.env`. Set your own database password, the matching `DATABASE_URL` and a separate random `BETTER_AUTH_SECRET` of at least 32 characters. URL-encode special characters in the database password.
2. Run `docker compose up -d --wait postgres` or use a separate local PostgreSQL database.
3. Run `npm ci`, `npm run db:generate` and `npm run db:deploy`.
4. Run `npm run admin:create` and enter local test credentials.
5. Run `npm run dev -- --hostname 127.0.0.1`. Sign in at [localhost:3000](http://localhost:3000) and set up two-factor authentication.
6. Run `npm run worker` in a second terminal to process reports. See the [test guide](docs/TESTING.md) and [deployment guide](docs/DEPLOYMENT.md) for Chromium and PDF export requirements.

## Tests and deployment

After generating the Prisma client, run `npm run lint`, `npm run typecheck` and `npm test`. Integration and browser tests use a separate test database and synthetic data. [Test guide](docs/TESTING.md)

Use synthetic records and documents for demos. The app requires a session with two-factor authentication. Before handling real tenant data, review access controls, HTTPS, credentials and upload scanning, and verify that backups can be restored in the intended environment. [Security](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md) · [Backup and restore](docs/BACKUP_RESTORE.md)

This repository does not include a project license.
