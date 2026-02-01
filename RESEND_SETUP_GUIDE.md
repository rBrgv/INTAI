# Resend Email Integration Setup Guide

## ✅ What's Been Implemented

### **1. Resend Package Installed**
```bash
npm install resend
```

### **2. Email Service Created**
- **File**: `/src/lib/resend.ts`
- **Features**:
  - Send individual interview invitations
  - Send bulk invitations
  - Beautiful HTML email template with gradient design
  - Proper error handling

### **3. API Endpoint Created**
- **File**: `/src/app/api/college/send-emails/route.ts`
- **Endpoint**: `POST /api/college/send-emails`
- **Functionality**:
  - Validates invitation data
  - Sends bulk emails via Resend
  - Returns detailed results (successful/failed counts)

### **4. Dashboard Integration**
- **File**: `/src/app/college/dashboard/[templateId]/page.tsx`
- **Updated**: "Send Links" button now actually sends emails
- **Features**:
  - Prepares invitation data from selected candidates
  - Calls Resend API
  - Shows success/failure feedback
  - Clears selection after successful send

---

## 🔧 Setup Instructions

### **Step 1: Get Resend API Key**

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email
4. Go to API Keys section
5. Create a new API key
6. Copy the API key (starts with `re_`)

### **Step 2: Configure Environment Variables**

Add these to your `.env.local` file:

```bash
# Resend Email Service
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM_EMAIL=AI Interview Platform <noreply@yourdomain.com>
```

**Important Notes**:
- For development, Resend allows sending from `onboarding@resend.dev`
- For production, you need to verify your own domain
- Free tier: 100 emails/day, 3,000 emails/month

### **Step 3: Domain Verification (Production)**

#### **For Production Use:**
1. In Resend dashboard, go to "Domains"
2. Click "Add Domain"
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the DNS records Resend provides:
   - MX record
   - TXT record (SPF)
   - DKIM records
5. Wait for verification (usually 24-48 hours)
6. Update `RESEND_FROM_EMAIL` to use your domain:
   ```bash
   RESEND_FROM_EMAIL=AI Interview Platform <noreply@yourdomain.com>
   ```

#### **For Development:**
Use the default Resend email:
```bash
RESEND_FROM_EMAIL=AI Interview Platform <onboarding@resend.dev>
```

**Note**: Emails from `onboarding@resend.dev` work but may land in spam.

---

## 📧 Email Template Features

The email template includes:

### **Visual Design**
- ✅ Professional gradient header (indigo/purple)
- ✅ Clean, modern layout
- ✅ Responsive design (works on mobile)
- ✅ Glassmorphism-inspired styling

### **Content Sections**
1. **Personalized Greeting**: Uses candidate's name
2. **Interview Details Box**:
   - Position/Job Title
   - Number of questions
   - Estimated time
3. **Large CTA Button**: "Start Interview" with gradient
4. **Fallback Link**: For copy-paste if button doesn't work
5. **Tips Section**: Helpful hints for candidates
6. **Footer**: College branding

### **Email Data**
Each invitation includes:
```typescript
{
  candidateName: "John Doe",
  candidateEmail: "john@example.com",
  interviewLink: "https://yourapp.com/interview/session-id",
  collegeName: "Your College Name",
  jobTitle: "Software Engineer",
  questionCount: 10,
  estimatedTime: 30
}
```

---

## 🚀 How to Use

### **From College Dashboard:**

1. Navigate to template dashboard: `/college/dashboard/{templateId}`
2. Go to "Candidates" tab
3. Select candidates using checkboxes
4. Click "Send Email Invites (X)" button
5. Wait for confirmation
6. ✅ Success: Shows "Successfully sent X of Y emails"
7. ❌ Failure: Shows error message with details

### **Bulk Sending:**
- Select multiple candidates
- Click once to send to all selected
- System handles rate limiting automatically
- Results show individual success/failure status

---

## 📊 API Response Format

### **Success Response:**
```json
{
  "success": true,
  "message": "Sent 5 of 5 emails",
  "data": {
    "total": 5,
    "successful": 5,
    "failed": 0,
    "results": [
      {
        "email": "candidate1@example.com",
        "status": "fulfilled",
        "messageId": "msg_abc123",
        "error": null
      },
      // ...
    ]
  }
}
```

### **Partial Failure Response:**
```json
{
  "success": true,
  "message": "Sent 3 of 5 emails",
  "data": {
    "total": 5,
    "successful": 3,
    "failed": 2,
    "results": [
      {
        "email": "valid@example.com",
        "status": "fulfilled",
        "messageId": "msg_abc123",
        "error": null
      },
      {
        "email": "invalid@example.com",
        "status": "rejected",
        "messageId": null,
        "error": "Email address is invalid"
      }
    ]
  }
}
```

---

## ⚠️ Error Handling

### **Common Errors:**

1. **Missing API Key**
   ```
   Error: Email service not configured
   Solution: Add RESEND_API_KEY to .env.local
   ```

2. **Invalid Email**
   ```
   Error: Email address is invalid
   Solution: Check candidate email format
   ```

3. **Rate Limit Exceeded**
   ```
   Error: Too many requests
   Solution: Wait a few minutes or upgrade plan
   ```

4. **Domain Not Verified**
   ```
   Error: Domain not verified
   Solution: Use onboarding@resend.dev or verify your domain
   ```

### **Error Recovery:**
- Failed emails are logged to console
- User sees which emails failed
- Can retry failed emails individually
- System continues sending even if some fail

---

## 🎯 Testing

### **Test in Development:**

1. **Setup**:
   ```bash
   # Add to .env.local
   RESEND_API_KEY=re_your_test_key
   RESEND_FROM_EMAIL=AI Interview Platform <onboarding@resend.dev>

> **⚠️ Important:** The variable name `RESEND_API_KEY` must be **all uppercase**. Next.js is strict about this!
   ```

2. **Test Send**:
   - Add a test candidate with your email
   - Select the candidate
   - Click "Send Email Invites"
   - Check your inbox (and spam folder)

3. **Verify Email**:
   - Check email renders correctly
   - Click "Start Interview" button
   - Verify link works

### **Test Email Preview:**

You can preview the email template by creating a test file:

```typescript
// test-email.ts
import { generateInterviewInviteHTML } from '@/lib/resend';

const html = generateInterviewInviteHTML({
  candidateName: "Test User",
  candidateEmail: "test@example.com",
  interviewLink: "https://localhost:3000/interview/test",
  collegeName: "Test College",
  jobTitle: "Software Engineer",
  questionCount: 10,
  estimatedTime: 30,
});

console.log(html);
```

---

## 📈 Resend Dashboard

### **Monitor Emails:**
1. Log in to [resend.com](https://resend.com)
2. Go to "Emails" section
3. See all sent emails with status:
   - ✅ Delivered
   - 📬 Bounced
   - 🚫 Spam
   - ⏳ Pending

### **Track Opens/Clicks** (Pro Plan):
- Email open rate
- Link click rate
- Geographic data
- Device/client data

---

## 💰 Pricing

### **Free Tier:**
- 100 emails/day
- 3,000 emails/month
- API access
- Email logs (7 days)

### **Paid Plans:**
- **Pro**: $20/month
  - 50,000 emails/month
  - Priority support
  - 30-day logs
  - Email analytics

- **Enterprise**: Custom pricing
  - Unlimited emails
  - Dedicated IP
  - Custom sending limits

**For College Use**: Free tier is usually sufficient for small-medium colleges.

---

## 🔒 Security Best Practices

1. **Never commit API keys** to Git
2. **Use environment variables** for all secrets
3. **Validate email addresses** before sending
4. **Rate limit** bulk sends
5. **Log failures** but not sensitive data
6. **Use HTTPS** for interview links

---

## ✅ Checklist

Before going to production:

- [ ] Resend API key configured in environment
- [ ] Domain verified in Resend
- [ ] FROM email updated to use your domain
- [ ] Test emails sent successfully
- [ ] Email template reviewed and approved
- [ ] College name updated in template
- [ ] Error handling tested
- [ ] Rate limits understood
- [ ] Monitoring dashboard setup

---

## 🎨 Customizing Email Template

To customize the email design, edit `/src/lib/resend.ts`:

### **Change Colors:**
```typescript
// Update gradient in header
background: linear-gradient(135deg, #YOUR_COLOR_1, #YOUR_COLOR_2);
```

### **Change Content:**
```typescript
// Edit the HTML template in generateInterviewInviteHTML()
```

### **Add Logo:**
```html
<img src="https://your-domain.com/logo.png" alt="Logo" />
```

### **Add Footer Links:**
```html
<a href="https://your-college.edu">Visit Website</a>
```

---

## 🚀 Ready to Go!

Your Resend integration is complete! Just add your API key and start sending professional interview invitations.

**Next Steps**:
1. Get Resend API key
2. Add to `.env.local`
3. Test with your own email
4. Send invitations to candidates!

For support: [Resend Documentation](https://resend.com/docs)
