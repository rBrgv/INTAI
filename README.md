# AI Interview Platform (INTAI)

A comprehensive AI-powered interview platform supporting multiple interview modes with automated question generation, answer evaluation, and detailed reporting.

## 🚀 Features

### Core Capabilities
- **Multi-Mode Interviews**: Company, Individual, and College modes
- **AI-Powered Questions**: Automated question generation using OpenAI GPT-4o-mini
- **Voice & Text Input**: Voice recording with transcription and text input
- **Real-Time Evaluation**: Instant scoring and feedback after each answer
- **Comprehensive Reports**: Detailed candidate evaluation with shareable links
- **Anti-Cheating**: Tab switch detection and presence verification
- **File Processing**: PDF and DOCX upload with automatic text extraction
- **Cohort Analytics**: Bulk candidate management and analytics (College mode)

### User Experience
- **Stepper Flow**: Guided multi-step setup with state persistence
- **Auto-Save**: Draft answers and form state saved automatically
- **Keyboard Shortcuts**: Ctrl+Enter to submit, Esc to cancel
- **Time Tracking**: Real-time interview duration tracking
- **Progress Indicators**: Visual progress bars and question timelines
- **Toast Notifications**: User-friendly success/error messages

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key
- Supabase account (optional, for database persistence)

## 🛠️ Setup

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Create `.env.local` file:**
```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional (for database persistence)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Run database migrations (if using Supabase):**
```bash
# Apply migrations from supabase/migrations/001_initial_schema.sql
# via Supabase dashboard or CLI
```

4. **Start development server:**
```bash
npm run dev
```

5. **Open [http://localhost:3000](http://localhost:3000)**

## 📁 Project Structure

```
INTAI/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── sessions/    # Session management
│   │   │   ├── college/     # College mode APIs
│   │   │   ├── skills/      # Skill extraction
│   │   │   └── health/      # Health check
│   │   ├── company/         # Company mode setup
│   │   ├── individual/      # Individual mode setup
│   │   ├── college/         # College mode setup
│   │   ├── interview/       # Interview session pages
│   │   └── share/           # Shareable report pages
│   ├── components/          # Reusable React components
│   └── lib/                 # Utilities and helpers
│       ├── types.ts         # TypeScript type definitions
│       ├── validators.ts    # Zod validation schemas
│       ├── apiResponse.ts   # Standardized API responses
│       ├── env.ts           # Environment validation
│       ├── unifiedStore.ts  # Data store (Supabase/memory)
│       └── prompts.ts       # AI prompt templates
├── supabase/
│   └── migrations/          # Database migrations
└── package.json
```

## 🎯 Interview Modes

### Company Mode
For recruiters conducting interviews:
1. Upload Job Description (PDF/DOCX or paste text)
2. Add Top 5 Skills (auto-extracted from JD)
3. Upload Candidate Resume
4. Configure interview settings
5. Start interview and evaluate candidate

### Individual Mode
For self-practice interviews:
1. Select role and level (junior/mid/senior)
2. Upload your resume
3. Configure interview settings
4. Practice answering questions
5. View candidate-friendly report

### College Mode
For placement offices managing bulk interviews:
1. Create job template (JD + skills + config)
2. Upload candidate CSV
3. Send bulk interview links
4. Track all candidates in dashboard
5. View cohort analytics

## 🔌 API Endpoints

### Sessions
- `POST /api/sessions` - Create interview session
- `GET /api/sessions/[sessionId]` - Get session details
- `POST /api/sessions/[sessionId]/start` - Start interview (generate questions)
- `POST /api/sessions/[sessionId]/answer` - Submit answer
- `POST /api/sessions/[sessionId]/next` - Move to next question
- `POST /api/sessions/[sessionId]/previous` - Move to previous question
- `GET /api/sessions/[sessionId]/report` - Get report
- `POST /api/sessions/[sessionId]/report` - Generate report

### College
- `POST /api/college/templates` - Create job template
- `GET /api/college/templates?templateId=...` - Get template
- `POST /api/college/batch` - Create candidate batch

### Utilities
- `POST /api/skills/extract` - Extract skills from job description
- `GET /api/health` - Health check endpoint

## 🗄️ Database Schema

The platform uses Supabase (PostgreSQL) with the following main tables:
- `interview_sessions` - Interview session data
- `college_job_templates` - Job templates for college mode
- `candidate_batches` - Bulk candidate management
- `resumes` - Resume file metadata
- `session_history` - Change history tracking
- `audit_logs` - Action audit trail

See `supabase/migrations/001_initial_schema.sql` for full schema.

## 🧪 Development

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## 🔒 Security Features

- Rate limiting on answer submissions
- Tab switch detection and logging
- Input validation with Zod
- Environment variable validation
- Secure file upload handling
- XSS protection in API responses

## 📊 Monitoring

- Health check endpoint: `GET /api/health`
- Audit logging for all significant actions
- Session history tracking
- Error boundaries for graceful error handling

## 🤝 Contributing

This is a private project. For questions or issues, contact the maintainer.

## 📝 License

Private - All rights reserved

## 🎉 Status

✅ **P0 Features**: Complete
✅ **P1 Features**: Complete (Database persistence, History tracking, Analytics)
🚧 **Ongoing**: Performance optimizations, Testing infrastructure

See `FEATURES_LIST.md` for complete feature documentation.
