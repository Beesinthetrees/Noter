# Noter

A local-first notes app. This is an early scaffold — the DB connection is wired
up and confirmed working, but there's no note-taking UI yet (no create/edit/delete,
no rich-text editor, no search or tags).

## Stack

- [Vite](https://vitejs.dev/) + React + TypeScript
- [Dexie.js](https://dexie.org/) over IndexedDB for local-first storage
- [TipTap](https://tiptap.dev/) for the rich-text editor (installed, not wired up yet)
- ESLint + Prettier

## Getting started

```bash
npm install
npm run dev
```

This starts the dev server (default [http://localhost:5173](http://localhost:5173)).
Open it in a browser — you should see a "Noter" page confirming the Dexie
database connected, plus buttons to add/clear a test note so you can verify
reads and writes against IndexedDB.

## Scripts

| Command           | Description                              |
| ------------------ | ----------------------------------------- |
| `npm run dev`       | Start the Vite dev server                 |
| `npm run build`     | Type-check and build for production       |
| `npm run preview`   | Preview the production build locally      |
| `npm run lint`      | Run ESLint                                |
| `npm run format`    | Format the codebase with Prettier         |

## Project structure

```
src/
  components/   UI components
  db/           Dexie schema and database logic
  hooks/        Custom React hooks
```

### Database schema

`src/db/db.ts` defines a single `notes` table:

```ts
interface Note {
  id: number
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}
```

## Status

Current state: scaffold only. DB connection is verified via
`src/hooks/useDbStatus.ts` and `src/components/DbStatusPanel.tsx`. Next up:
the actual note-taking UI, TipTap editor integration, search, and tags.
