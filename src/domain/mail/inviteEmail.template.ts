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
  <div style="
    background:#05050a;
    padding:40px 0;
    font-family:Arial, sans-serif;
  ">
    <table align="center" width="600" cellpadding="0" cellspacing="0" 
      style="
        background:#0b0b12;
        border-radius:16px;
        overflow:hidden;
        border:1px solid #1f1f2e;
      "
    >

      <!-- LOGO -->
      <tr>
        <td style="text-align:center;padding:32px 24px 16px 24px;">
          <img 
            src="https://dopamine-dungeon.vercel.app/email/dd-logo.png"
            alt="Dopamine Dungeon"
            width="120"
            style="display:block;margin:0 auto;"
          />
        </td>
      </tr>

      <!-- HEADER -->
      <tr>
        <td style="
          text-align:center;
          padding:16px 24px 24px 24px;
          color:white;
        ">
          <h1 style="
            margin:0;
            font-size:22px;
            background:linear-gradient(90deg,#a855f7,#6366f1);
            -webkit-background-clip:text;
            -webkit-text-fill-color:transparent;
          ">
            Dopamine Dungeon
          </h1>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:32px;color:#e5e7eb;">
          
          <h2 style="margin-top:0;color:white;">
            You’ve been summoned ✨
          </h2>

          <p style="margin:16px 0;">
            ${inviterName ?? "A Dungeon Master"} has invited you to join:
          </p>

          <p style="
            margin:20px 0;
            font-size:20px;
            color:#a855f7;
            font-weight:bold;
          ">
            ${campaignName}
          </p>

          <p style="margin:16px 0;color:#9ca3af;">
            Workspace: <strong style="color:white;">${workspaceName}</strong>
          </p>

          <!-- CTA -->
          <div style="text-align:center;margin:36px 0;">
            <a href="${inviteLink}" 
              style="
                display:inline-block;
                padding:14px 32px;
                background:linear-gradient(135deg,#7c3aed,#6366f1);
                color:white;
                text-decoration:none;
                border-radius:10px;
                font-weight:bold;
              ">
              Join Campaign
            </a>
          </div>

          <p style="margin:24px 0;font-size:12px;color:#6b7280;">
            Invited as: ${inviteEmail}
          </p>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="
          padding:16px;
          text-align:center;
          font-size:12px;
          color:#6b7280;
          border-top:1px solid #1f1f2e;
        ">
          If this wasn’t meant for you, you can ignore this message.
        </td>
      </tr>

    </table>
  </div>
  `;
}