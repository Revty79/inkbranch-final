# InkBranch

InkBranch is an interactive storytelling platform where:

- readers discover and play through living stories
- authors build worlds and narrative guardrails
- admins oversee access and platform operations

## Local Setup

1. Create a PostgreSQL database named `inkbranch`.
2. Create an application user such as `inkbranch_app`.
3. Copy `.env.example` to `.env.local` and set the password or full `DATABASE_URL`.
4. Run `npm install`.
5. Start the app with `npm run dev`.

The app creates the `users` table automatically on its first successful database connection. The same schema also lives in `db/schema.sql`.

## Auth Model

- public registration always creates `READER` accounts
- `AUTHOR` and `ADMIN` are elevated roles
- authentication uses hashed passwords plus an HttpOnly signed session cookie

## Promote Roles

Use the local helper script after a user has signed up:

```bash
npm run user:list
npm run user:role -- user@example.com AUTHOR
npm run user:role -- user@example.com ADMIN
npm run user:password:check -- user@example.com yourPassword
npm run user:password:set -- user@example.com newPassword
```

## Database Commands

Drizzle is wired to `.env.local` through [drizzle.config.ts](/d:/inkbranch-final/inkbranch-final/drizzle.config.ts:1).

```bash
npm run db:export
npm run db:push
npm run db:pull
npm run db:generate
npm run db:migrate
npm run db:studio
```

For this project right now:

- use `npm run db:push` while the schema is changing quickly in development
- use `npm run db:generate` and `npm run db:migrate` once you want tracked migration files
- use `npm run db:studio` when you want to inspect data visually

## Main Areas

- `Bookstore`: discover and purchase new stories
- `Library`: return to stories you already own
- `Writer's Desk`: author-only creation tools
- `Administration Office`: admin-only platform controls
