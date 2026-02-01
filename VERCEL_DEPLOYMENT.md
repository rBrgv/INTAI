# Vercel Deployment Guide for INTAI

## ✅ Changes Made for Vercel Compatibility

### 1. **Vercel Configuration (`vercel.json`)**
Created a `vercel.json` file with the following optimizations:
- **Function Timeouts**: Set `maxDuration: 60` seconds for all API routes to handle OpenAI API calls
- **Environment Variables**: Configured proper environment variable mapping
- **Caching Headers**: Disabled caching for API routes to prevent stale data
- **Regions**: Set to `iad1` (US East) for optimal performance

### 2. **Next.js Configuration Updates (`next.config.js`)**
Enhanced the Next.js configuration with:
- **SWC Minification**: Enabled for faster builds
- **Image Optimization**: Configured for Supabase remote patterns
- **Webpack Configuration**: Added externals for serverless compatibility
- **Environment Variables**: Auto-detect Vercel URL for `NEXT_PUBLIC_APP_URL`
- **CORS Headers**: Added proper headers for API routes

### 3. **API Route Optimizations**
Added Vercel serverless function configurations to critical API routes:

**Routes with 60-second timeout** (for OpenAI calls):
- `/api/sessions/[sessionId]/start` - Question generation
- `/api/sessions/[sessionId]/answer` - Answer evaluation
- `/api/sessions/[sessionId]/report` - Report generation

**Routes with 30-second timeout**:
- `/api/skills/extract` - Skills extraction

All routes now have:
```typescript
export const maxDuration = 60; // or 30
export const dynamic = 'force-dynamic';
```

### 4. **Environment Variables Template**
Created `.env.example` to document required environment variables:
- `OPENAI_API_KEY` (required)
- `NEXT_PUBLIC_SUPABASE_URL` (optional)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional)
- `NEXT_PUBLIC_APP_URL` (auto-configured on Vercel)

---

## 🚀 Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "feat: Add Vercel deployment configuration"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Select your repository
   - Framework Preset: **Next.js** (auto-detected)

3. **Configure Environment Variables**
   In the Vercel dashboard, add these environment variables:
   
   **Required**:
   - `OPENAI_API_KEY` = `sk-proj-...` (your OpenAI API key)
   
   **Optional** (for database persistence):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://xxx.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGc...`
   
   **Optional** (auto-configured):
   - `NEXT_PUBLIC_APP_URL` = Will use `VERCEL_URL` automatically

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (typically 2-3 minutes)

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   # For preview deployment
   vercel
   
   # For production deployment
   vercel --prod
   ```

4. **Set Environment Variables**
   ```bash
   vercel env add OPENAI_API_KEY
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

---

## 🔍 Common Issues & Solutions

### Issue 1: Function Timeout Errors
**Symptom**: "Task timed out after 10.00 seconds"

**Solution**: 
- ✅ Already fixed! Added `maxDuration` to all OpenAI API routes
- Verify in `vercel.json` that functions have proper timeout configuration
- Note: Free tier has 10s limit, Hobby/Pro allows up to 60s

### Issue 2: Environment Variables Not Working
**Symptom**: "OPENAI_API_KEY is not configured"

**Solution**:
1. Check Vercel Dashboard → Your Project → Settings → Environment Variables
2. Ensure variables are set for all environments (Production, Preview, Development)
3. Redeploy after adding environment variables

### Issue 3: Build Failures
**Symptom**: Build fails with TypeScript or dependency errors

**Solution**:
```bash
# Test build locally first
npm run build

# If successful, push and redeploy
git push origin main
```

### Issue 4: API Routes Return 404
**Symptom**: API routes work locally but return 404 on Vercel

**Solution**:
- Ensure file naming is correct: `route.ts` (not `route.tsx` or `index.ts`)
- Check that files are in `src/app/api/` directory
- Verify paths match dynamic routes: `[sessionId]` folders

### Issue 5: CORS Errors
**Symptom**: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solution**:
- ✅ Already fixed! Added CORS headers in `next.config.js`
- If still seeing issues, check browser console for specific error

### Issue 6: Slow Cold Starts
**Symptom**: First request after idle period is very slow

**Solution**:
- This is normal for serverless functions (cold start)
- Consider upgrading to Vercel Pro for faster cold starts
- Use edge functions for fast routes (not needed for OpenAI calls)

---

## 📊 Monitoring & Debugging

### Vercel Dashboard
- **Deployments**: View build logs and deployment history
- **Functions**: Monitor function execution time and errors
- **Analytics**: Track page views and performance (Pro plan)
- **Logs**: Real-time function logs (Runtime Logs tab)

### Useful Commands
```bash
# View deployment logs
vercel logs [deployment-url]

# List all deployments
vercel ls

# Remove a deployment
vercel remove [deployment-name]
```

### Health Check
After deployment, verify the health endpoint:
```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "dependencies": {
      "openai": true,
      "supabase": true
    },
    "version": "0.1.0",
    "environment": "production"
  }
}
```

---

## ⚡ Performance Optimizations

### Already Implemented
1. ✅ SWC minification enabled
2. ✅ Dynamic imports for heavy components
3. ✅ Response caching disabled for API routes
4. ✅ Proper timeout configuration for long-running functions

### Additional Recommendations
1. **Database Connection Pooling**: If using Supabase, connections are already pooled
2. **CDN Caching**: Static assets automatically cached by Vercel CDN
3. **Edge Functions**: Consider for authentication middleware (future optimization)
4. **Image Optimization**: Already configured for Supabase images

---

## 🔒 Security Considerations

### Already Implemented
1. ✅ Environment variables properly secured
2. ✅ API rate limiting on answer submissions
3. ✅ Input validation with Zod schemas
4. ✅ XSS protection via sanitization
5. ✅ Secure cookie settings based on environment

### Production Checklist
- [ ] Review environment variables in Vercel dashboard
- [ ] Enable Vercel Authentication (optional)
- [ ] Set up custom domain with HTTPS
- [ ] Configure Vercel Firewall rules (Pro plan)
- [ ] Enable deployment protection for production branch

---

## 📈 Scaling Considerations

### Current Setup
- **Serverless Functions**: Auto-scales with traffic
- **Database**: Supabase auto-scales with connection pooling
- **Storage**: Vercel Edge Network CDN

### Limits by Plan
| Feature | Hobby (Free) | Pro |
|---------|--------------|-----|
| Function Timeout | 10s | 60s ✅ |
| Bandwidth | 100 GB | 1 TB |
| Build Time | 45 min | 45 min |
| Serverless Executions | 100 GB-Hrs | 1000 GB-Hrs |

**Note**: Our configuration requires **Pro plan** due to 60-second timeouts for OpenAI API calls.

---

## 🎯 Post-Deployment Testing

### Test Checklist
1. **Health Check**
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

2. **Create Session**
   ```bash
   curl -X POST https://your-app.vercel.app/api/sessions \
     -H "Content-Type: application/json" \
     -d '{"mode":"individual","role":"Software Engineer", "level":"mid"}'
   ```

3. **Skills Extraction**
   ```bash
   curl -X POST https://your-app.vercel.app/api/skills/extract \
     -H "Content-Type: application/json" \
     -d '{"jdText":"Looking for a senior React developer..."}'
   ```

4. **Full Interview Flow**
   - Go to `https://your-app.vercel.app`
   - Complete an individual mode interview
   - Verify question generation works
   - Submit answers and verify evaluation
   - Generate and view report

5. **College Mode**
   - Test login: `https://your-app.vercel.app/college/login`
   - Create job template
   - Upload candidate batch
   - Verify dashboard analytics

---

## 🆘 Support & Resources

### Vercel Documentation
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Function Timeouts](https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration)

### Project-Specific
- See `README.md` for application features
- See `FEATURES_LIST.md` for complete feature documentation
- See `SECURITY_FEATURES.md` for security implementation details

---

## ✨ Quick Reference

### Deploy Command
```bash
vercel --prod
```

### Environment Variables (Required)
```env
OPENAI_API_KEY=sk-proj-...
```

### Environment Variables (Optional)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Health Check URL
```
https://your-app.vercel.app/api/health
```

---

**Last Updated**: 2026-02-01
**Deployment Status**: ✅ Ready for Vercel Deployment
