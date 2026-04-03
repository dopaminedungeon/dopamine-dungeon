type InviteEmailParams = {
  campaignName: string;
  workspaceName: string;
  inviteEmail: string;
  inviteLink: string;
  inviterName?: string;
};

export function buildInviteEmailHtml({
  campaignName,
  workspaceName,
  inviteEmail,
  inviteLink,
  inviterName,
}: InviteEmailParams): string {
  return `
  <div style="background:#0b0b12;padding:40px 0;font-family:Arial, sans-serif;">
    <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#11111a;border-radius:12px;overflow:hidden;border:1px solid #1f1f2e;">
      
      <!-- HEADER -->
      <tr>
        <td style="padding:24px;text-align:center;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;">
          <h1 style="margin:0;font-size:24px;">🎲 Dopamine Dungeon</h1>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:32px;color:#e5e7eb;">
          
          <h2 style="margin-top:0;color:white;">
            You’ve been summoned ✨
          </h2>

          <p style="margin:16px 0;">
            ${inviterName ?? "A Dungeon Master"} has invited you to join a campaign:
          </p>

          <p style="margin:16px 0;font-size:18px;color:#a855f7;">
            <strong>${campaignName}</strong>
          </p>

          <p style="margin:16px 0;">
            Workspace: <strong>${workspaceName}</strong>
          </p>

          <!-- CTA BUTTON -->
          <div style="text-align:center;margin:32px 0;">
            <a href="${inviteLink}" 
               style="
                 display:inline-block;
                 padding:14px 28px;
                 background:#7c3aed;
                 color:white;
                 text-decoration:none;
                 border-radius:8px;
                 font-weight:bold;
               ">
              Join Campaign
            </a>
          </div>

          <p style="margin:24px 0;font-size:12px;color:#9ca3af;">
            Invited as: ${inviteEmail}
          </p>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="padding:16px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #1f1f2e;">
          If this wasn’t meant for you, you can ignore this message.
        </td>
      </tr>

    </table>
  </div>
  `;
}