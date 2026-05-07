# Electrical BIM Progress Tracker — Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase project (free tier works)
- An IFC model converted to XKT + JSON metadata

---

## 1. Install dependencies

```bash
cd bim-electrical-dashboard
npm install
```

---

## 2. Supabase setup

1. Go to https://supabase.com and create a project
2. Open **SQL Editor** and run the full contents of `src/lib/supabase/schema.sql`
3. Go to **Storage** → New Bucket → name it `execution-photos` → set as **Public**
4. Copy your project URL and keys from **Settings → API**

---

## 3. Configure environment

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_PROJECT_ID=<uuid from projects table>
```

Create your first project row in Supabase:
```sql
insert into projects (name, description) values ('My Building', 'Electrical tracking');
```
Then copy the generated UUID into `NEXT_PUBLIC_PROJECT_ID`.

---

## 4. Convert IFC to XKT

Using the official ifc2gltf + gltf2xkt pipeline:

```bash
# Install converters
npm install -g @xeokit/xeokit-convert

# Convert IFC → XKT
ifc2gltf -i model.ifc -o model.glb
gltf2xkt -s model.glb -o model.xkt -m model.json
```

Place `model.xkt` and `model.json` in `public/models/`.

Alternatively use the online converter at https://xeokit.io/demo.html#converting.

---

## 5. Run dev server

```bash
npm run dev
```

Open http://localhost:3000

---

## Architecture Overview

```
src/
├── app/
│   ├── page.tsx                  ← Main page — orchestrates everything
│   └── api/execution/route.ts    ← REST endpoint (optional, for external access)
│
├── components/
│   ├── viewer/
│   │   ├── BIMViewer.tsx         ← xeokit canvas wrapper
│   │   └── ViewerControls.tsx    ← search, floor isolator, camera reset
│   ├── panel/
│   │   ├── ElementPanel.tsx      ← side panel (info + form)
│   │   ├── ProgressForm.tsx      ← status/qty/team/hours/photo form
│   │   └── ProductivityCard.tsx  ← real-time productivity calculation
│   ├── filters/
│   │   └── FilterBar.tsx         ← status/level/type filter chips
│   └── ui/
│       └── ProgressSummary.tsx   ← stacked progress bar header
│
├── hooks/
│   ├── useXeokit.ts              ← xeokit lifecycle, picking, colorizing
│   └── useExecution.ts           ← CRUD + photo upload state
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             ← browser + server Supabase clients
│   │   └── schema.sql            ← full DB schema with RLS
│   ├── api/
│   │   └── execution.ts          ← API layer (getRecord, upsert, upload)
│   └── viewer/
│       ├── colorizer.ts          ← xeokit object color helpers
│       └── elementMapper.ts      ← GlobalId ↔ ObjectId mapping
│
└── types/
    └── index.ts                  ← shared types + STATUS_COLORS constant
```

---

## Status color mapping (xeokit RGBA)

| Status       | Color  | RGBA              |
|-------------|--------|-------------------|
| NOT_STARTED | Gray   | [0.5, 0.5, 0.5, 1] |
| IN_PROGRESS | Yellow | [1, 0.85, 0, 1]   |
| COMPLETED   | Green  | [0.2, 0.75, 0.2, 1]|
| ISSUE       | Red    | [0.9, 0.2, 0.2, 1] |

---

## Extending the platform

- **Multi-project**: replace `NEXT_PUBLIC_PROJECT_ID` with a project selector
- **Auth**: Supabase Auth is already wired via RLS — add `@supabase/auth-ui-react`
- **PDF reports**: query `project_summary` view → generate PDF via `@react-pdf/renderer`
- **Offline**: add a service worker + IndexedDB queue for field use
