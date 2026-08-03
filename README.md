# ControlOne

Desktop business management app for sales, inventory, services, finance, and reports.

## Stack

- Electron + React + TypeScript + Vite
- Tailwind CSS + shadcn/ui-style components
- Prisma + SQLite
- TanStack Query, React Hook Form, Zod, Recharts

## Requirements

- Node.js 20+
- Windows 10/11

## Setup

```bash
npm install
npx prisma generate
```

## Development

```bash
npm run dev
```

Starts Vite on port 5173 and opens Electron with hot reload.

## Build

```bash
npm run build
npm run dist
```

The Windows installer is generated under `release/`.

## Architecture

- `src/main` — main process, Prisma, services, and IPC
- `src/preload.ts` — secure `contextBridge`
- `src/renderer` — React UI
- `src/shared` — shared types, Zod schemas, and constants

The renderer never talks to the database directly. All persistence goes through the main process via Zod-validated IPC.

## Local data

- Database: under Electron `userData` (`%APPDATA%/controlone/`)
- Images: `images` folder inside the app data directory
- Backups: configurable folder or default `backups`
