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
npm run db:push:review
npm run db:pull
npm run db:generate
npm run db:migrate
npm run db:studio
```

For this project right now:

- use `npm run db:push` while the schema is changing quickly in development
: this repo runs in non-interactive shells, so `db:push` is configured with `--force`
- use `npm run db:push:review` when you specifically want the interactive safety prompt
- use `npm run db:generate` and `npm run db:migrate` once you want tracked migration files
- use `npm run db:studio` when you want to inspect data visually

## Main Areas

- `Bookstore`: discover and purchase new stories
- `Library`: return to stories you already own
- `Writer's Desk`: author-only creation tools
- `Administration Office`: admin-only platform controls

## AI Story Generation

Set these environment values in `.env.local`:

- `GEMINI_API_KEY=<your_key>`
- `GEMINI_MODEL=gemini-flash-latest` (or another available Gemini model)

Backend endpoint:

- `POST /api/ai/generate-story` (authenticated session required)
- request body: `{ "prompt": "..." }` (optional `"model"` override)
- response body: `{ "text": "...", "model": "..." }`

## Reader Runtime (Library)

The reader flow is chapter-based:

- books are added to `Library` first
- creator books are auto-added to the creator's own library
- readers start from library and generate chapter 1
- each next chapter is generated from selected suggestion or custom direction input

Runtime tables:

- `library_books`
- `story_sessions`
- `story_turns`

Reader endpoints:

- `GET /api/reader/library`
- `POST /api/reader/library`
- `GET /api/reader/worlds`
- `GET /api/reader/sessions`
- `POST /api/reader/sessions`
- `GET /api/reader/sessions/:sessionId`
- `POST /api/reader/sessions/:sessionId/turns`

## Writer's Desk Foundation

The first authoring pass is now focused on the core contract:

- author defines world truth and constraints
- reader makes choices inside those boundaries
- AI generates scenes while preserving the authored spine

Current authoring tables:

- `story_worlds`: world-level metadata and high-level author intent
- `world_spine_versions`: versioned narrative spine guidance
- `world_rules`: categorized constraints (`CANON`, `CHARACTER_TRUTH`, `REQUIRED_EVENT`, `OUTCOME`)

The Writer's Desk UI writes to `/api/author/worlds` and creates:

- one world draft
- spine version `1`
- initial rule entries by category
