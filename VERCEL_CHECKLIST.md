# Vercel Deployment Checklist

## Pre-Deployment ✅

- [x] Created `vercel.json` configuration
- [x] Updated `next.config.js` with Vercel optimizations
- [x] Added runtime configurations to API routes
- [x] Created `.env.example` template
- [x] Verified local build succeeds (`npm run build`)
- [x] All TypeScript types are valid
- [x] No build errors or warnings

## Deployment Steps

### Step 1: Push to Git
```bash
git add .
git commit -m "feat: Add Vercel deployment configuration"
git push origin main
```

### Step 2: Deploy to Vercel
Choose one method:

**Method A: Vercel Dashboard (Recommended)**
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Framework will auto-detect as Next.js
4. Add environment variables (see below)
5. Click "Deploy"

**Method B: Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Step 3: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

**Required:**
- `OPENAI_API_KEY` = (your OpenAI API key)
  - Get from: https://platform.openai.com/api-keys

**Optional (for database persistence):**
- `NEXT_PUBLIC_SUPABASE_URL` = (your Supabase project URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your Supabase anon key)
  - Get from: Supabase Dashboard → Settings → API

**Auto-configured:**
- `NEXT_PUBLIC_APP_URL` - Vercel will use VERCEL_URL automatically

⚠️ **Important**: Set variables for all environments (Production, Preview, Development)

### Step 4: Redeploy (if you added env vars after first deploy)
```bash
vercel --prod
```

## Post-Deployment Testing

### 1. Health Check
```bash
curl https://your-deployment-url.vercel.app/api/health
```

Expected: `{"success": true, "data": {"status": "healthy", ...}}`

### 2. Test Main Page
Open: `https://your-deployment-url.vercel.app`

### 3. Test Individual Mode
1. Go to main page
2. Click "Individual Practice"
3. Create a session
4. Upload resume
5. Start interview
6. Answer questions
7. Generate report

### 4. Test College Mode
1. Go to `/college/register`
2. Create college account
3. Login at `/college/login`
4. Create job template
5. Upload candidate CSV
6. View dashboard

### 5. Test API Endpoints
```bash
# Create session
curl -X POST https://your-app.vercel.app/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "individual",
    "role": "Software Engineer",
    "level": "mid",
    "resumeText": "Experienced software engineer with 5 years in web development..."
  }'

# Extract skills
curl -X POST https://your-app.vercel.app/api/skills/extract \
  -H "Content-Type: application/json" \
  -d '{
    "jdText": "Looking for a senior React developer with TypeScript experience..."
  }'
```

## Verify Key Features

- [ ] Question generation works (60s timeout)
- [ ] Answer evaluation works (60s timeout)
- [ ] Report generation works (60s timeout)
- [ ] Skills extraction works (30s timeout)
- [ ] Resume upload and parsing works
- [ ] College mode dashboard loads
- [ ] Share links work
- [ ] No CORS errors in browser console
- [ ] No timeout errors

## Monitoring

### Vercel Dashboard
- **Deployments**: Check build logs
- **Functions**: Monitor execution time
- **Runtime Logs**: View real-time function logs

### Check for Issues
```bash
# View logs for specific deployment
vercel logs https://your-app.vercel.app
```

## Common Issues & Quick Fixes

### Issue: "Task timed out after 10 seconds"
- **Cause**: Free tier has 10s limit
- **Fix**: Upgrade to Hobby/Pro plan ($20/mo)
- Our config needs 60s timeouts for OpenAI calls

### Issue: "OPENAI_API_KEY is not configured"
- **Cause**: Environment variable not set
- **Fix**: Add in Vercel Dashboard → Settings → Environment Variables
- Remember to redeploy after adding

### Issue: Build fails
- **Cause**: TypeScript errors or dependencies
- **Fix**: Run `npm run build` locally first to debug

### Issue: API returns 404
- **Cause**: Incorrect file structure
- **Fix**: Ensure routes are in `src/app/api/` with `route.ts` naming

### Issue: Slow first request
- **Cause**: Cold start (normal for serverless)
- **Fix**: This is expected behavior, subsequent requests are fast

## Performance Tips

1. **Function Regions**: Already set to `iad1` (US East)
2. **Caching**: Disabled for API routes (as intended)
3. **Build Optimization**: SWC minification enabled
4. **Image Optimization**: Configured for Supabase

## Security Checklist

- [ ] Environment variables are set in Vercel (not in code)
- [ ] `.env.local` is in `.gitignore`
- [ ] API keys are rotated if exposed
- [ ] Production domain uses HTTPS (automatic on Vercel)
- [ ] Rate limiting is enabled (already in code)

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate (automatic)
5. Update `NEXT_PUBLIC_APP_URL` if using custom domain

## Rollback (if needed)

```bash
# List deployments
vercel ls

# Promote a previous deployment to production
vercel promote [deployment-url]
```

## Next Steps

- [ ] Set up monitoring/alerts (if on Pro plan)
- [ ] Configure custom domain
- [ ] Set up Vercel Analytics (optional)
- [ ] Enable deployment protection for production
- [ ] Review function execution logs regularly

---

## Quick Commands Reference

```bash
# Deploy to production
vercel --prod

# View logs
vercel logs

# List deployments
vercel ls

# Remove deployment
vercel remove [deployment-name]

# Set environment variable
vercel env add OPENAI_API_KEY

# Pull environment variables locally
vercel env pull
```

---

**Deployment Date**: _________________
**Deployment URL**: _________________
**Status**: ⬜ Pending | ⬜ Deployed | ⬜ Verified
**Plan**: ⬜ Hobby (Free) | ⬜ Pro | ⬜ Enterprise

**Notes**:
_______________________________________________________
_______________________________________________________
_______________________________________________________
