type PasswordRecoveryEmailParams = {
  passwordResetLink: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const PASSWORD_RECOVERY_EMAIL_SUBJECT =
  "Reset your Dopamine Dungeon password";

export function buildPasswordRecoveryEmailHtml({
  passwordResetLink,
}: PasswordRecoveryEmailParams): string {
  const link = escapeHtml(passwordResetLink);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${PASSWORD_RECOVERY_EMAIL_SUBJECT}</title>
  </head>
  <body style="margin:0;background:#09090b;color:#f4f4f5;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#09090b;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#18181b;border:1px solid #3f3f46;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:32px 28px 16px;text-align:center;">
            <img src="https://dopamine-dungeon.vercel.app/logo/icon-192.png" width="64" height="64" alt="" style="display:inline-block;border:0;">
            <div style="margin-top:14px;color:#d8b4fe;font-size:24px;font-weight:700;">Dopamine Dungeon</div>
            <div style="margin-top:5px;color:#a1a1aa;font-size:15px;">TTRPG Manager</div>
          </td></tr>
          <tr><td style="padding:18px 28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.25;text-align:center;">Reset your password</h1>
            <p style="margin:18px 0 0;color:#d4d4d8;font-size:17px;line-height:1.6;text-align:center;">A password reset was requested for your Dopamine Dungeon account.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0;">
              <tr><td align="center">
                <a href="${link}" style="display:inline-block;min-width:220px;padding:17px 24px;border-radius:6px;background:#9333ea;color:#ffffff;font-size:17px;font-weight:700;text-align:center;text-decoration:none;">Reset password</a>
              </td></tr>
            </table>
            <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.6;">If the button does not work, open this link:</p>
            <p style="margin:8px 0 0;word-break:break-all;font-size:14px;line-height:1.5;"><a href="${link}" style="color:#d8b4fe;text-decoration:underline;">${link}</a></p>
            <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5;">If you did not request a password reset, you can ignore this message.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
