/**
 * Transactional email via the Gmail REST API.
 *
 * Runs natively on Cloudflare Workers — no SMTP, no Resend, no extra service.
 * Uses an OAuth2 refresh-token flow against a Google account (Workspace or
 * personal) to obtain short-lived access tokens, then POSTs a base64url-
 * encoded RFC-2822 message to `users.messages.send`.
 *
 * Ported from the anthropist reference project. If you change the sending
 * pattern, update anthropist's too so the two projects stay in sync.
 *
 * Env vars required:
 *   GMAIL_CLIENT_ID          OAuth2 client id
 *   GMAIL_CLIENT_SECRET      OAuth2 client secret
 *   GMAIL_REFRESH_TOKEN      Long-lived refresh token for the sender account
 *   GMAIL_SENDER             The email address that appears in the From header
 */

import { escapeHtml } from "./utils";

// ─── OAuth2 token refresh ───────────────────────────────────────────────────

interface TokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

async function getGmailAccessToken(): Promise<string> {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
            "Gmail OAuth2 credentials are not configured. " +
            "Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.",
        );
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gmail OAuth2 token refresh failed: ${text}`);
    }

    const data = (await response.json()) as TokenResponse;
    return data.access_token;
}

// ─── Generic send-email primitive ───────────────────────────────────────────

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
    const accessToken = await getGmailAccessToken();
    const from = process.env.GMAIL_SENDER;
    if (!from) {
        throw new Error("GMAIL_SENDER is not configured");
    }

    // Sanitize headers — strip newlines to prevent header injection.
    const safeTo = to.replace(/[\r\n]/g, "");
    const safeSubject = subject.replace(/[\r\n]/g, "");

    // Build an RFC-2822 message.
    const messageParts = [
        `From: Film-maker <${from}>`,
        `To: ${safeTo}`,
        `Subject: ${safeSubject}`,
        "MIME-Version: 1.0",
        'Content-Type: text/html; charset="UTF-8"',
        "",
        html,
    ];
    const rawMessage = messageParts.join("\r\n");

    // Base64url encode. We iterate byte-by-byte to avoid call-stack limits
    // on large messages (String.fromCharCode(...bytes) blows up past ~100KB).
    const bytes = new TextEncoder().encode(rawMessage);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const encoded = btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw: encoded }),
        },
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gmail API send failed: ${text}`);
    }
}

// ─── Magic-link email template ──────────────────────────────────────────────

interface SendMagicLinkParams {
    email: string;
    url: string;
}

/**
 * Sends a styled magic-link email for a sign-in request.
 *
 * The URL comes directly from Better Auth's magicLink plugin and already
 * contains the one-shot token. We pass it through unmodified.
 */
export async function sendMagicLinkEmail({
    email,
    url,
}: SendMagicLinkParams): Promise<void> {
    const safeUrl = escapeHtml(url);

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in to Film-maker</title>
</head>
<body style="margin:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fafafa;padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td>
              <div style="font-size:14px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#737373;margin-bottom:24px;">
                Film-maker
              </div>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#0a0a0a;line-height:1.3;">
                Sign in to your account
              </h1>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#525252;">
                Click the button below to sign in. This link will expire in 15 minutes and can only be used once.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px;">
                <tr>
                  <td style="border-radius:10px;background:#0a0a0a;">
                    <a href="${safeUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Sign in to Film-maker
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#737373;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="margin:0 0 32px;font-size:12px;line-height:1.6;color:#a3a3a3;word-break:break-all;font-family:ui-monospace,monospace;">
                ${safeUrl}
              </p>

              <div style="padding-top:24px;border-top:1px solid #f4f4f5;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#a3a3a3;">
                  If you didn't request this email, you can safely ignore it. No one will be able to sign in without this link.
                </p>
              </div>
            </td>
          </tr>
        </table>

        <p style="margin:24px 0 0;font-size:12px;color:#a3a3a3;">
          Film-maker · film-maker.net
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    await sendEmail({
        to: email,
        subject: "Sign in to Film-maker",
        html,
    });
}
