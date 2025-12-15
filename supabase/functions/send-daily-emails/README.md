# Daily Email Reminders - Setup Guide

This function sends daily motivational emails to all users with active announcements included.

## Quick Setup

### Option 1: Using Supabase Dashboard (Recommended)

1. **Deploy the Function**:
   ```bash
   supabase functions deploy send-daily-emails
   ```

2. **Set Environment Variables** in Supabase Dashboard:
   - Go to Project Settings → Edge Functions
   - Add secrets:
     - `RESEND_API_KEY` - Your Resend API key
     - `APP_URL` - Your app URL (e.g., https://lotusroutine.com)

3. **Schedule via Supabase Cron** (if available):
   - Go to Database → Cron Jobs
   - Create new cron job:
     - Name: `daily-email-reminders`
     - Schedule: `0 8 * * *` (8:00 AM UTC daily)
     - SQL: `SELECT public.create_daily_reminder_notifications();`
   - Then create another cron to call the Edge Function:
     - Name: `trigger-email-function`
     - Schedule: `1 8 * * *` (8:01 AM UTC - 1 minute after)
     - Use HTTP extension or external service to call:
       `https://YOUR_PROJECT.supabase.co/functions/v1/send-daily-emails`

### Option 2: Using External Cron Service

1. **Deploy the Function** (same as above)

2. **Set Environment Variables** (same as above)

3. **Use a Cron Service** (e.g., cron-job.org, EasyCron):
   - URL: `https://YOUR_PROJECT.supabase.co/functions/v1/send-daily-emails`
   - Method: POST
   - Headers: 
     - `Authorization: Bearer YOUR_ANON_KEY`
   - Schedule: Daily at 8:00 AM (your timezone)

### Option 3: Using pg_cron Extension

If your Supabase instance has pg_cron enabled:

```sql
-- Schedule the notification creation
SELECT cron.schedule(
  'create-daily-reminders',
  '0 8 * * *', -- 8:00 AM UTC
  $$SELECT public.create_daily_reminder_notifications()$$
);

-- Then use HTTP extension to call Edge Function
-- (Requires http extension to be enabled)
```

## How It Works

1. **Database Function** (`send_daily_reminders`):
   - Creates in-app notifications for all users
   - Includes active announcements
   - Runs via cron job

2. **Edge Function** (`send-daily-emails`):
   - Reads users with email notifications enabled
   - Sends actual emails via Resend
   - Includes beautiful HTML template
   - Creates notifications as backup

## Email Service Setup

### Using Resend (Recommended)

1. Sign up at https://resend.com
2. Get your API key
3. Set as `RESEND_API_KEY` secret

### Alternative Services

You can modify the `sendEmail` function to use:
- SendGrid
- Mailgun  
- AWS SES
- Postmark

## Testing

Test the function manually:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-daily-emails \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Troubleshooting

- **Emails not sending**: Check Resend API key is set correctly
- **Cron not running**: Verify cron job is active in Supabase dashboard
- **Function errors**: Check Edge Function logs in Supabase dashboard
