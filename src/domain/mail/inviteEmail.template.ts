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

      <!-- BANNER -->
      <tr>
        <td style="padding:0;">
          <img 
            src="https://dopamine-dungeon.vercel.app/email/dd-banner.png"
            alt="Dopamine Dungeon"
            width="600"
            style="display:block;width:100%;height:auto;"
          />
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:32px;color:#e5e7eb;">
          
          <h2 style="margin-top:0;color:white;">
            You have been ✨dramatically summoned✨
          </h2>

          <p style="margin:16px 0;">
            ${inviterName ?? "Some suspiciously powerful Dungeon Master"} has decided your fate is no longer your own.
          </p>

          <p style="margin:16px 0;">
            You are hereby invited (read: emotionally blackmailed) to join:
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
            Inside the dangerously addictive workspace:
            <br/>
            <strong style="color:white;">${workspaceName}</strong>
          </p>

          <p style="margin:16px 0; color:#9ca3af;">
            Side effects may include: emotional attachment to fictional characters, poor life choices, and yelling at dice.
          </p>

          <p style="margin:24px 0 8px 0; color:#9ca3af; font-size:13px;">
            May your rolls be high and your consequences narratively devastating.
          </p>

          <p style="margin:0 0 24px 0; color:#a855f7; font-weight:bold;">
            — Your Dungeon Master (who is absolutely not emotionally attached… probably)
          </p>

          <!-- CTA -->
          <div style="text-align:center;margin:36px 0;">
            <a href="${inviteLink}" 
              style="
                display:inline-block;
                padding:16px 36px;
                background:linear-gradient(135deg,#9333ea,#6366f1,#22d3ee);
                color:white;
                text-decoration:none;
                border-radius:12px;
                font-weight:bold;
                font-size:15px;
                box-shadow:0 0 0 1px rgba(255,255,255,0.05), 0 10px 30px rgba(124,58,237,0.6);
                letter-spacing:0.3px;
              ">
              ✨ Enter the Dungeon ✨
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