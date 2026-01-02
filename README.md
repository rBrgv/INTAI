# AI Interview MVP

Interview-first MVP. No login. No white-label. Create a session and start an interview.

## Project Structure

```
INTAI/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── sessions/
│   │   │       └── route.ts      # POST /api/sessions
│   │   ├── company/              # Company Mode form
│   │   ├── open/                 # Open Market form
│   │   ├── mode/                 # Mode selection
│   │   ├── interview/
│   │   │   └── [sessionId]/      # Dynamic interview session page
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Landing page
│   │   └── globals.css
│   └── lib/
│       ├── types.ts              # TypeScript types
│       └── sessionStore.ts       # In-memory session store
├── package.json
├── tsconfig.json
└── next.config.js
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Chunk 1 Status

✅ Project scaffold with Next.js 14 (App Router) using `src/` directory
✅ Landing page → Mode selection → Company/Open forms
✅ Text paste input (no file parsing yet)
✅ API route `/api/sessions` with validation
✅ In-memory session store
✅ Dynamic interview session page `/interview/[sessionId]`

## Flow

1. Landing page (`/`) → Click "Start"
2. Mode selection (`/mode`) → Choose Company or Open Market
3. Form page:
   - Company Mode (`/company`): Paste Resume + JD text
   - Open Market (`/open`): Paste Resume + Select Role/Level
4. Submit → Creates session via API → Redirects to `/interview/[sessionId]`
5. Interview page shows session details + placeholder for questions

## Next Steps (Chunk 2)

- Interview session engine (state machine)
- Question generation API using OpenAI
- Answer submission handling
