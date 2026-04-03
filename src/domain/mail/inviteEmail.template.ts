export function buildInviteEmailHtml({
  campaignName,
  workspaceName,
  inviteEmail,
  inviteLink,
  inviterName,
}: {
  campaignName: string;
  workspaceName: string;
  inviteEmail: string;
  inviteLink: string;
  inviterName?: string;
}) {
  const safeInviter = inviterName || "A Dungeon Master";

  return `
  <div style="background:#0a0a0f;padding:40px;font-family:Inter,Arial;color:#e4e4e7;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      You’ve been invited to ${campaignName} in Dopamine Dungeon.
    </div>
    <div style="max-width:480px;margin:auto;background:#111119;padding:32px;border-radius:16px;border:1px solid rgba(255,255,255,0.05);">
      
      <h2 style="color:#c084fc;text-align:center;margin-bottom:24px;">
        🎲 Dopamine Dungeon
      </h2>

      <h3 style="color:white;margin-bottom:16px;">
        You’ve been invited to a campaign
      </h3>

      <p style="color:#a1a1aa;line-height:1.6;">
        ${safeInviter} has invited 
        <strong style="color:white;">${inviteEmail}</strong> 
        to join 
        <strong style="color:white;">${campaignName}</strong> 
        in 
        <strong style="color:white;">${workspaceName}</strong>.
      </p>

      <div style="text-align:center;margin:24px 0;">
        <a href="${inviteLink}"
          style="padding:14px 24px;border-radius:12px;background:linear-gradient(90deg,#a855f7,#ec4899);color:white;text-decoration:none;font-weight:600;">
          Accept Invitation
        </a>
        <p style="margin-top:12px;font-size:12px;color:#71717a;">
          If the button doesn’t work, copy and paste this link into your browser:<br/>
          <span style="word-break:break-all;color:#a855f7;">${inviteLink}</span>
        </p>
      </div>

      <p style="font-size:12px;color:#71717a;text-align:center;">
        Some doors open only once.
      </p>

    </div>
  </div>
  `;
}