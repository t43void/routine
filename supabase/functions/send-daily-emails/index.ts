// Supabase Edge Function to send daily email reminders
// This function should be scheduled to run daily (e.g., via cron or Supabase cron jobs)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(emailData: EmailData) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Lotus Routine <noreply@lotusroutine.com>",
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
}

serve(async (req) => {
  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get active announcements
    const { data: announcements } = await supabaseClient
      .from("system_announcements")
      .select("*")
      .eq("is_active", true)
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("created_at", { ascending: false })
      .limit(1);

    const announcement = announcements?.[0];

    // Get users with email notifications enabled
    const { data: users } = await supabaseClient
      .from("profiles")
      .select("id, username, email_notifications_enabled, daily_reminder_time")
      .eq("email_notifications_enabled", true);

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "No users to notify" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user emails from auth
    const emailsSent = [];
    const errors = [];

    for (const user of users) {
      try {
        // Get user email from auth (requires admin access)
        const { data: authUser } = await supabaseClient.auth.admin.getUserById(user.id);

        if (!authUser?.user?.email) {
          continue;
        }

        // Build email content with cool styling
        let emailSubject = announcement 
          ? `📢 ${announcement.title} - Daily Reminder` 
          : "🌅 Daily Reminder: You Are Awesome!";
        let emailBody = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .message { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                .cta { text-align: center; margin: 30px 0; }
                .button { background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🌟 You Are Awesome! 🌟</h1>
                </div>
                <div class="content">
                  <div class="message">
                    <h2>Hey ${user.username}! 👋</h2>
                    <p>Just a friendly reminder that you're doing amazing! Keep up the incredible work! 💪</p>
                    ${announcement ? `<p><strong>📢 ${announcement.title}</strong></p><p>${announcement.message}</p>` : ""}
                    <p>Remember: Every day you show up is a victory. You've got this! 🔥</p>
                  </div>
                  <div class="cta">
                    <a href="${Deno.env.get("APP_URL") || "https://lotusroutine.com"}/dashboard" class="button">
                      Continue Your Journey →
                    </a>
                  </div>
                  <div class="footer">
                    <p>Keep tracking, keep growing, keep being awesome! 🚀</p>
                    <p>Lotus Routine - Your Accountability Hub</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;

        // Send email
        await sendEmail({
          to: authUser.user.email,
          subject: emailSubject,
          html: emailBody,
        });

        // Create notification
        await supabaseClient.from("notifications").insert({
          user_id: user.id,
          notification_type: "daily_reminder",
          title: "🌅 Daily Reminder: You Are Awesome!",
          message: announcement
            ? `${announcement.message}\n\nYou are awesome! Keep up the great work! 💪`
            : "You are awesome! Keep up the great work! 💪",
          read: false,
        });

        emailsSent.push(authUser.user.email);
      } catch (error) {
        console.error(`Error sending email to user ${user.id}:`, error);
        errors.push({ userId: user.id, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: emailsSent.length,
        errors: errors.length,
        details: { emailsSent, errors },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

