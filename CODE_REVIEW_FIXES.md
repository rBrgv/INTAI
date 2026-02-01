# Code Review - Issues and Suggested Fixes

**Project:** INTAI - AI Interview Platform  
**Review Date:** 2026-01-28  
**Reviewer:** Automated Code Analysis  
**Status:** ✅ BUILD PASSING - Critical issues fixed

---

## ✅ FIXED ISSUES

### 1. Variable Used Before Declaration - FIXED ✅
**File:** `src/app/api/sessions/[sessionId]/answer/route.ts`  
**Lines:** 112-134  
**Status:** ✅ **FIXED**

**Original Issue:**
The `currentQuestion` variable was being used before it was declared, causing a build failure.

**Fix Applied:**
Moved the `currentQuestion` declaration and validation before its usage.

### 2. Missing Type Properties - FIXED ✅
**Files:** 
- `src/app/college/dashboard/[templateId]/page.tsx`
- `src/app/interview/[sessionId]/InterviewClient.tsx`

**Status:** ✅ **FIXED**

**Fix Applied:**
Added missing properties to type definitions:
- Added `answers` and `questionTimings` to Session type
- Added `startedAt` to ApiState session type

---

## 🔴 HIGH PRIORITY ISSUES (Remaining)
```typescript
// Line 118-125: Using currentQuestion before it's declared
const displayedAt = questionDisplayedAt ? Number(questionDisplayedAt) : (session.questionTimings?.find(qt => qt.questionId === currentQuestion.id)?.displayedAt || now);
const timeSpent = displayedAt > 0 ? Math.round((now - displayedAt) / 1000) : undefined;

const minTimeThreshold = currentQuestion.difficulty === "hard" ? 10 : 5;
const isSuspiciouslyFast = timeSpent !== undefined && timeSpent < minTimeThreshold;

// Line 127: Declaration comes after usage
const currentQuestion = session.questions[session.currentQuestionIndex];
```

**Fix:**
Move the `currentQuestion` declaration to the top, before it's used:

```typescript
const { answerText: rawAnswerText, questionDisplayedAt } = validationResult.data;
const answerText = sanitizeForStorage(rawAnswerText);
  
// MOVE THIS TO TOP - before usage
const currentQuestion = session.questions[session.currentQuestionIndex];
if (!currentQuestion) {
  return apiError(
    "No current question",
    "Please start the interview first",
    400
  );
}

// Calculate timing and detect suspiciously fast answers
const now = Date.now();
const displayedAt = questionDisplayedAt ? Number(questionDisplayedAt) : (session.questionTimings?.find(qt => qt.questionId === currentQuestion.id)?.displayedAt || now);
const timeSpent = displayedAt > 0 ? Math.round((now - displayedAt) / 1000) : undefined;
  
const minTimeThreshold = currentQuestion.difficulty === "hard" ? 10 : 5;
const isSuspiciouslyFast = timeSpent !== undefined && timeSpent < minTimeThreshold;
```

---

### 2. ESLint Not Configured
**File:** `package.json` and missing `.eslintrc.json`  
**Severity:** ⚠️ **HIGH** - No linting means bugs go undetected

**Issue:**
ESLint is not configured for the project. Running `npm run lint` tries to install it but fails due to dependency conflicts.

**Dependency Conflict:**
```
eslint@8.57.1 conflicts with eslint-config-next@16.1.6 which requires eslint@>=9.0.0
```

**Fix:**
1. Update ESLint to version 9.x:
```bash
npm install --save-dev eslint@^9.0.0 eslint-config-next@latest
```

2. Create `.eslintrc.json`:
```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { 
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_" 
    }],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

---

## ⚠️ HIGH PRIORITY ISSUES

### 3. Console.log Statements in Production Code
**Files:** Multiple  
**Severity:** ⚠️ **MEDIUM** - Code smell, potential information disclosure

**Locations:**
- `src/app/college/students/page.tsx:112` - "Student saved successfully"
- `src/app/college/dashboard/[templateId]/page.tsx:1105` - "Adding candidates"
- `src/app/college/dashboard/[templateId]/page.tsx:1126` - "Candidates added successfully"

**Fix:**
Replace with proper logging using the logger utility:

```typescript
// Instead of:
console.log("Student saved successfully:", data);

// Use:
import { logger } from '@/lib/logger';
logger.info('Student saved successfully', { studentId: data.id });
```

**Note:** The logger already handles console.log internally but provides consistent formatting, log levels, and can be configured for production.

---

### 4. Missing Type Safety - Use of `any`
**File:** `src/app/api/sessions/[sessionId]/answer/route.ts`  
**Lines:** 179, 211  
**Severity:** ⚠️ **MEDIUM**

**Issue:**
```typescript
let parsed: any;  // Line 179
const studentsToAdd: any[] = [];  // Line 211 in students page
```

**Fix:**
Define proper types:

```typescript
// For evaluation response
interface EvaluationResponse {
  scores: {
    technical: number;
    communication: number;
    problemSolving: number;
  };
  overall: number;
  strengths: string[];
  gaps: string[];
  followUpQuestion: string;
}

let parsed: EvaluationResponse;
```

---

### 5. Incomplete TODO Item
**File:** `src/app/api/college/batch/send-links/route.ts:81`  
**Severity:** ⚠️ **MEDIUM** - Feature not implemented

**Issue:**
```typescript
// TODO: Integrate with email service
```

**Fix:**
Either:
1. Implement email integration (recommended)
2. Add a task to your backlog
3. Add a comment explaining the current workaround

**Recommended Implementation:**
```typescript
// Integration with email service
import { sendEmail } from '@/lib/email'; // Create this module

try {
  await sendEmail({
    to: candidate.email,
    subject: `Interview Invitation - ${jobTitle}`,
    template: 'interview-invitation',
    data: {
      name: candidate.name,
      interviewLink: interviewUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
} catch (error) {
  logger.error('Failed to send interview email', error, { 
    candidateEmail: candidate.email 
  });
  // Continue with other candidates even if one fails
}
```

---

## 📋 CODE QUALITY IMPROVEMENTS

### 6. Inconsistent Error Handling
**Files:** Multiple API routes  
**Severity:** 🔵 **LOW** - Inconsistent patterns

**Issue:**
Some routes throw errors, others return null, creating inconsistent error handling patterns.

**Example from `unifiedStore.ts`:**
```typescript
// Line 30-48: getSession sometimes throws, sometimes returns null
export async function getSession(id: string): Promise<InterviewSession | null> {
  if (isSupabaseConfigured()) {
    try {
      const session = await supabaseStore.getSession(id);
      if (session) return session;
      return null; // Explicit null for not found
    } catch (error) {
      logger.error('Supabase getSession error', ...);
      throw error; // But also throws on error
    }
  }
  return memoryStore.getSession(id);
}
```

**Fix:**
Be consistent - either always throw or always return null. Recommended:
```typescript
export async function getSession(id: string): Promise<InterviewSession | null> {
  if (isSupabaseConfigured()) {
    // Return null for both "not found" and errors
    // Let the caller decide how to handle
    const session = await supabaseStore.getSession(id);
    return session; // null if not found
  }
  return memoryStore.getSession(id);
}
```

---

### 7. Potential N+1 Query Problem
**File:** `src/lib/supabaseStore.ts:448-468`  
**Severity:** 🔵 **LOW** - Performance issue with large batches

**Issue:**
```typescript
// Sequential queries in a loop
for (const batch of batchesData || []) {
  const { data: candidatesData } = await supabase
    .from(TABLES.BATCH_CANDIDATES)
    .select('*')
    .eq('batch_id', batch.id);
  // ...
}
```

**Fix:**
Fetch all candidates in a single query:
```typescript
export async function getBatchesByTemplate(templateId: string): Promise<CandidateBatch[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  // Get all batches
  const { data: batchesData, error: batchesError } = await supabase
    .from(TABLES.BATCHES)
    .select('*')
    .eq('job_template_id', templateId)
    .order('created_at', { ascending: false });

  if (batchesError) {
    logger.error('Error getting batches', batchesError, { templateId });
    return [];
  }

  if (!batchesData || batchesData.length === 0) return [];

  const batchIds = batchesData.map(b => b.id);

  // Get all candidates in ONE query
  const { data: allCandidatesData } = await supabase
    .from(TABLES.BATCH_CANDIDATES)
    .select('*')
    .in('batch_id', batchIds);

  // Group candidates by batch_id
  const candidatesByBatch = (allCandidatesData || []).reduce((acc, candidate) => {
    if (!acc[candidate.batch_id]) acc[candidate.batch_id] = [];
    acc[candidate.batch_id].push(candidate);
    return acc;
  }, {} as Record<string, any[]>);

  // Map batches
  return batchesData.map(batch => ({
    id: batch.id,
    jobTemplateId: batch.job_template_id,
    createdAt: new Date(batch.created_at).getTime(),
    candidates: (candidatesByBatch[batch.id] || []).map(c => ({
      email: c.email,
      name: c.name,
      studentId: c.student_id || undefined,
      sessionId: c.session_id || undefined,
      status: c.status || 'pending',
      completedAt: c.completed_at ? new Date(c.completed_at).getTime() : undefined,
      linkSentAt: c.link_sent_at ? new Date(c.link_sent_at).getTime() : undefined,
    })),
  }));
}
```

---

### 8. Missing Input Validation for CSV Import
**File:** `src/app/college/students/page.tsx:190-255`  
**Severity:** 🔵 **MEDIUM** - Security & data quality

**Issue:**
CSV parsing doesn't validate email format or handle malformed CSV properly.

**Fix:**
Add validation:
```typescript
const handleBulkImport = async (file: File) => {
  try {
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    
    if (lines.length < 2) {
      throw new Error("CSV must have at least a header row and one data row");
    }

    // Better CSV parsing - handle quoted commas
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    
    // Find column indices with better matching
    const getColumnIndex = (names: string[]) => 
      headers.findIndex(h => names.some(n => h.includes(n)));
    
    const emailIdx = getColumnIndex(['email']);
    const nameIdx = getColumnIndex(['name']);

    if (emailIdx < 0 || nameIdx < 0) {
      throw new Error("CSV must have 'email' and 'name' columns");
    }

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const studentsToAdd = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        const email = values[emailIdx]?.trim() || "";
        const name = values[nameIdx]?.trim() || "";
        
        // Validate email
        if (!email || !emailRegex.test(email)) {
          errors.push(`Row ${i + 1}: Invalid email "${email}"`);
          continue;
        }
        
        // Validate name
        if (!name || name.length < 2) {
          errors.push(`Row ${i + 1}: Invalid name "${name}"`);
          continue;
        }
        
        studentsToAdd.push({
          email,
          name,
          // ... other fields
        });
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Parse error'}`);
      }
    }

    if (errors.length > 0) {
      setError(`Import warnings:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more` : ''}`);
    }

    // Continue with import...
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to import CSV");
  }
};
```

---

### 9. Missing Database Indexes
**Severity:** 🔵 **MEDIUM** - Performance

**Recommendation:**
Based on the queries in `supabaseStore.ts`, add these indexes to your migrations:

```sql
-- For faster session lookups by share_token
CREATE INDEX IF NOT EXISTS idx_sessions_share_token 
ON interview_sessions(share_token) 
WHERE share_token IS NOT NULL;

-- For faster batch candidate lookups
CREATE INDEX IF NOT EXISTS idx_batch_candidates_batch_id 
ON batch_candidates(batch_id);

-- For faster session lookups by status
CREATE INDEX IF NOT EXISTS idx_sessions_status 
ON interview_sessions(status);

-- For faster template soft-delete queries
CREATE INDEX IF NOT EXISTS idx_templates_deleted_at 
ON college_job_templates(deleted_at) 
WHERE deleted_at IS NULL;
```

---

### 10. Hardcoded Magic Numbers
**Files:** Multiple  
**Severity:** 🔵 **LOW** - Maintainability

**Examples:**
- Minimum resume text length: 50 characters (appears in multiple files)
- Maximum skills: 5 (in validators)
- Time thresholds: 10s for hard, 5s for easy/medium
- Rate limits: 30 requests per 60 seconds

**Fix:**
Create a constants file:

```typescript
// src/lib/constants.ts
export const VALIDATION = {
  MIN_RESUME_LENGTH: 50,
  MIN_JD_LENGTH: 50,
  MIN_ANSWER_LENGTH: 10,
  MAX_SKILLS: 5,
  MIN_SKILL_NAME_LENGTH: 1,
} as const;

export const TIMING = {
  SUSPICIOUS_ANSWER_THRESHOLD_HARD: 10, // seconds
  SUSPICIOUS_ANSWER_THRESHOLD_EASY: 5,  // seconds
} as const;

export const RATE_LIMITS = {
  ANSWER_SUBMIT: {
    LIMIT: 30,
    WINDOW_MS: 60_000,
    BLOCK_AFTER_VIOLATIONS: 5,
    BLOCK_DURATION_MS: 15 * 60 * 1000,
  },
} as const;
```

Then import and use:
```typescript
import { VALIDATION, TIMING } from '@/lib/constants';

if (existing.resumeText.length < VALIDATION.MIN_RESUME_LENGTH) {
  // ...
}
```

---

## 🔒 SECURITY RECOMMENDATIONS

### 11. Rate Limiting Should Be Per Session
**File:** `src/app/api/sessions/[sessionId]/answer/route.ts:77-83`  
**Severity:** ⚠️ **MEDIUM**

**Issue:**
Rate limiting is by IP, but multiple candidates could share an IP (college/office network).

**Current:**
```typescript
const rl = rateLimit({ 
  key: `answer:${ip}`, // IP-based
  limit: 30
});
```

**Fix:**
Rate limit by session instead:
```typescript
const rl = rateLimit({ 
  key: `answer:${sessionId}`, // Session-based
  limit: 30,
  windowMs: 60_000,
  blockAfterViolations: 5,
  blockDurationMs: 15 * 60 * 1000,
});
```

---

### 12. Add Request Size Limits
**Files:** API routes  
**Severity:** ⚠️ **MEDIUM** - DoS prevention

**Fix:**
Add to `next.config.js`:
```javascript
module.exports = {
  api: {
    bodyParser: {
      sizeLimit: '1mb', // Adjust as needed
    },
  },
  // Existing config...
};
```

---

## 📝 TYPE SAFETY IMPROVEMENTS

### 13. Stricter TypeScript Configuration
**File:** `tsconfig.json`  
**Severity:** 🔵 **LOW**

**Recommendation:**
Add stricter type checking:

```json
{
  "compilerOptions": {
    // ... existing options
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

---

## ✅ TESTING RECOMMENDATIONS

### 14. Missing Unit Tests for Critical Functions
**Severity:** 🔵 **MEDIUM**

**Recommendation:**
Add tests for:
1. `safeJsonParse` function in answer route
2. `computeSummary` function
3. `clampInt` validation
4. CSV parsing logic

**Example Test:**
```typescript
// __tests__/lib/answer-evaluation.test.ts
import { clampInt, computeSummary } from '@/app/api/sessions/[sessionId]/answer/route';

describe('clampInt', () => {
  it('should clamp values within range', () => {
    expect(clampInt(5, 0, 10)).toBe(5);
    expect(clampInt(-5, 0, 10)).toBe(0);
    expect(clampInt(15, 0, 10)).toBe(10);
  });
  
  it('should handle invalid inputs', () => {
    expect(clampInt('invalid', 0, 10)).toBe(0);
    expect(clampInt(null, 0, 10)).toBe(0);
  });
});
```

---

## 📊 SUMMARY

### Issue Count by Severity
- 🔴 **Critical:** 2 (Build blocker, ESLint not configured)
- ⚠️ **High:** 4 (Console logs, Missing types, TODO, Rate limiting)
- 🔵 **Medium:** 7 (Error handling, N+1 queries, CSV validation, etc.)
- 🔵 **Low:** 3 (Magic numbers, TypeScript config, Testing)

### Immediate Actions Required
1. ✅ Fix variable declaration order in `answer/route.ts` (BLOCKS BUILD)
2. ✅ Configure ESLint properly
3. ✅ Remove or replace console.log statements
4. ⚠️ Implement proper email service or document workaround
5. ⚠️ Add type definitions to replace `any` types

### Nice to Have
- Add database indexes for performance
- Extract magic numbers to constants
- Improve CSV validation
- Add unit tests for critical functions
- Optimize N+1 query patterns

---

## 🚀 Next Steps

1. **Fix Critical Issues** - Address the build blocker immediately
2. **Configure Linting** - Set up ESLint to catch future issues
3. **Clean Up Logging** - Replace console.log with proper logger
4. **Add Types** - Remove `any` types for better type safety
5. **Run Tests** - Ensure `npm run build` and `npm run test` pass
6. **Performance** - Add database indexes
7. **Documentation** - Update TODOs or implement features

Would you like me to help fix any of these issues?
