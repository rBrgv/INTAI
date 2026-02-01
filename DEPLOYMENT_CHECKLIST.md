# 🚀 Production Deployment Checklist

## 1. Environment Variables (Critical)
Configure these in your production environment (e.g., Vercel Project Settings > Environment Variables).
**Note:** `RESEND_API_KEY` is case-sensitive!

| Variable Name | Value / Notes |
| :--- | :--- |
| `OPENAI_API_KEY` | `sk-...` (Your Production OpenAI Key) |
| `RESEND_API_KEY` | `re_...` (Your Production Resend Key) |
| `RESEND_FROM_EMAIL` | `AI Interview <noreply@sbconsulting.cloud>` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ey...` (Your Supabase Anon Key) |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` (Optional, good for absolute links) |

## 2. Infrastructure Setup
- [ ] **Resend**: Ensure `sbconsulting.cloud` is **Verified** in Resend Dashboard (DNS records: DKIM, SPF, DMARC).
- [ ] **Supabase**: Ensure the `candidate_batches` and `interview_sessions` tables exist in your production database. (If using UnifiedStore toggle, ensure generic fallback is active or DB is synced).

## 3. Feature Verification (Post-Deploy)
Once deployed, perform a "Smoke Test":
1.  **Login**: Access `/college/login`.
2.  **Create Template**: Go to `/college` wizard.
3.  **Bulk Upload**: Test uploading a small CSV of candidates.
4.  **Send Email**: Trigger an email invite and check if it arrives from `sbconsulting.cloud`.
5.  **Start Interview**: Click the link, verify **Fullscreen** request and **Security Warnings** (Copy/Paste detection).
6.  **Complete Interview**: Submit answers and check if **Dashboard** status updates to "Completed".

## 4. Recent Code Changes Summary
- **Email System**: Rewritten to use dynamic imports and support custom domains.
- **UX Improvements**: Hidden Session IDs, Loading Tips, Report Generation Progress.
- **Security**: Added strict Fullscreen enforcement and Copy/Paste monitoring.
- **Navigation**: Fixed broken "Back" buttons and 404 redirects.

## 5. Troubleshooting
- **500 Error on Email**: Check `RESEND_API_KEY` casing and validity.
- **Pending Status**: If dashboard stays "Pending", ensure the session completed successfully and refresh.
- **404s**: Check if you are navigating to `/mode` (removed) - should go to `/college/dashboard`.

🚀 **Ready for Takeoff!**
