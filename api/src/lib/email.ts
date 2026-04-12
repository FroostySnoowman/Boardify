// @ts-ignore — cloudflare:sockets is a built-in CF Workers module
import { connect } from 'cloudflare:sockets';

export interface InlineAttachment {
  cid: string;
  filename: string;
  contentType: string;
  base64: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  inlineAttachments?: InlineAttachment[];
}

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from?: string;
}

interface SmtpResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(
  options: EmailOptions,
  smtp?: SmtpConfig
): Promise<SmtpResult> {
  const from =
    options.from ||
    smtp?.from ||
    '"Boardify" <no-reply@boardify.app>';
  const toList = Array.isArray(options.to) ? options.to : [options.to];

  if (!smtp) {
    console.warn('⚠️  SMTP not configured - email will NOT be sent. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars.');
    console.warn('To:', toList.join(', '), '| Subject:', options.subject);
    return { success: false, error: 'SMTP not configured' };
  }

  if (!smtp.host || !smtp.username) {
    console.error('❌  SMTP config incomplete - host or username missing');
    return { success: false, error: 'SMTP configuration incomplete (missing host or username)' };
  }

  try {
    const implicitTls = smtp.port === 465;
    const useStartTls = !implicitTls;

    let socket = implicitTls
      ? connect(
          { hostname: smtp.host, port: smtp.port },
          { secureTransport: 'on', allowHalfOpen: false }
        )
      : connect(
          { hostname: smtp.host, port: smtp.port },
          { secureTransport: 'starttls', allowHalfOpen: false }
        );

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const io = {
      reader: socket.readable.getReader(),
      writer: socket.writable.getWriter(),
      buffer: '',
    };

    async function readResponse(): Promise<{ code: number; text: string }> {
      let full = '';
      while (true) {
        while (!io.buffer.includes('\r\n')) {
          const { value, done } = await io.reader.read();
          if (done) throw new Error('SMTP connection closed unexpectedly');
          io.buffer += decoder.decode(value, { stream: true });
        }
        const idx = io.buffer.indexOf('\r\n');
        const line = io.buffer.substring(0, idx);
        io.buffer = io.buffer.substring(idx + 2);
        full += line + '\r\n';
        const code = parseInt(line.substring(0, 3), 10);
        if (line.length >= 4 && line[3] === ' ') {
          return { code, text: full.trim() };
        }
      }
    }

    async function cmd(command: string): Promise<{ code: number; text: string }> {
      await io.writer.write(encoder.encode(command + '\r\n'));
      return readResponse();
    }

    const greeting = await readResponse();
    if (greeting.code !== 220) throw new Error(`Bad greeting: ${greeting.text}`);

    const ehlo = await cmd('EHLO boardify.app');
    if (ehlo.code !== 250) throw new Error(`EHLO failed: ${ehlo.text}`);

    if (useStartTls) {
      const startTlsResp = await cmd('STARTTLS');
      if (startTlsResp.code !== 220) {
        throw new Error(`STARTTLS failed: ${startTlsResp.text}`);
      }
      socket = socket.startTls();
      io.reader = socket.readable.getReader();
      io.writer = socket.writable.getWriter();
      io.buffer = '';
      const ehloSecure = await cmd('EHLO boardify.app');
      if (ehloSecure.code !== 250) throw new Error(`EHLO after TLS failed: ${ehloSecure.text}`);
    }

    const auth = await cmd('AUTH LOGIN');
    if (auth.code !== 334) throw new Error(`AUTH failed: ${auth.text}`);
    const userResp = await cmd(btoa(smtp.username));
    if (userResp.code !== 334) throw new Error(`AUTH user failed: ${userResp.text}`);
    const passResp = await cmd(btoa(smtp.password));
    if (passResp.code !== 235) throw new Error(`AUTH pass failed: ${passResp.text}`);

    const fromEmail = from.match(/<(.+)>/)?.[1] || from;
    const mf = await cmd(`MAIL FROM:<${fromEmail}>`);
    if (mf.code !== 250) throw new Error(`MAIL FROM failed: ${mf.text}`);

    for (const to of toList) {
      const rt = await cmd(`RCPT TO:<${to}>`);
      if (rt.code !== 250 && rt.code !== 251) {
        throw new Error(`RCPT TO <${to}> failed: ${rt.text}`);
      }
    }

    const data = await cmd('DATA');
    if (data.code !== 354) throw new Error(`DATA failed: ${data.text}`);

    const messageId = `${crypto.randomUUID()}@boardify.app`;
    const hasInline = options.inlineAttachments && options.inlineAttachments.length > 0;
    const boundary = hasInline ? `----=_MBP_${crypto.randomUUID().replace(/-/g, '')}` : '';

    let msg = '';
    msg += `Message-ID: <${messageId}>\r\n`;
    msg += `Date: ${new Date().toUTCString()}\r\n`;
    msg += `From: ${from}\r\n`;
    msg += `To: ${toList.join(', ')}\r\n`;
    msg += `Subject: ${options.subject}\r\n`;
    msg += `MIME-Version: 1.0\r\n`;

    if (hasInline && options.html) {
      msg += `Content-Type: multipart/related; boundary="${boundary}"\r\n`;
      msg += `\r\n`;
      msg += `--${boundary}\r\n`;
      msg += `Content-Type: text/html; charset=UTF-8\r\n`;
      msg += `Content-Transfer-Encoding: base64\r\n`;
      msg += `\r\n`;
      const htmlBytes = new TextEncoder().encode(options.html);
      let binary = '';
      for (let i = 0; i < htmlBytes.length; i++) {
        binary += String.fromCharCode(htmlBytes[i]);
      }
      const htmlB64 = btoa(binary);
      for (let i = 0; i < htmlB64.length; i += 76) {
        msg += htmlB64.slice(i, i + 76) + '\r\n';
      }
      for (const att of options.inlineAttachments!) {
        msg += `--${boundary}\r\n`;
        msg += `Content-Type: ${att.contentType}; name="${att.filename}"\r\n`;
        msg += `Content-Transfer-Encoding: base64\r\n`;
        msg += `Content-Disposition: inline; filename="${att.filename}"\r\n`;
        msg += `Content-ID: <${att.cid}>\r\n`;
        msg += `\r\n`;
        const b64 = att.base64;
        for (let i = 0; i < b64.length; i += 76) {
          msg += b64.slice(i, i + 76) + '\r\n';
        }
      }
      msg += `--${boundary}--\r\n`;
    } else if (options.html) {
      msg += `Content-Type: text/html; charset=UTF-8\r\n`;
      msg += `\r\n`;
      msg += options.html.split('\n').map(l => l.startsWith('.') ? '.' + l : l).join('\n');
    } else {
      msg += `Content-Type: text/plain; charset=UTF-8\r\n`;
      msg += `\r\n`;
      msg += (options.text || '').split('\n').map(l => l.startsWith('.') ? '.' + l : l).join('\n');
    }
    msg += `\r\n.\r\n`;

    await io.writer.write(encoder.encode(msg));
    const result = await readResponse();
    if (result.code !== 250) throw new Error(`Message rejected: ${result.text}`);

    await cmd('QUIT').catch(() => {});
    try { socket.close(); } catch {}

    return { success: true };
  } catch (error: any) {
    console.error('SMTP send error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

const DEFAULT_EMAIL_APP_ORIGIN = 'https://boardify.mybreakpoint.app';

export function emailLogoAbsoluteUrl(webAppOrigin: string | undefined): string {
  const base = (webAppOrigin?.trim() || DEFAULT_EMAIL_APP_ORIGIN).replace(/\/$/, '');
  return `${base}/icon_circle.png`;
}

function bg(hex: string): string {
  return `background-color:${hex};background-image:linear-gradient(${hex},${hex})`;
}

const BG           = '#f5f0e8';
const CARD         = '#ffffff';
const INNER        = '#f0ebe3';
const BORDER       = '#000000';
const TEXT         = '#0a0a0a';
const BODY         = '#333333';
const MUTED        = '#666666';
const DIM          = '#666666';
const FOOT         = '#666666';

const GRADIENT_START = '#38bdf8';
const GRADIENT_END   = '#6366f1';

function emailLayout(content: string, logoUrl: string): string {
  const year = new Date().getFullYear();
  const imgSrc = logoUrl;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<title>Boardify</title>
<!--[if mso]><style>body,table,td,div,p,span{background-color:${BG}!important;color:${TEXT}!important;font-family:Arial,sans-serif!important;}</style><![endif]-->
<style>
:root{color-scheme:light;}
.boardify-brand{background:linear-gradient(90deg,${GRADIENT_START},${GRADIENT_END})!important;-webkit-background-clip:text!important;-webkit-text-fill-color:transparent!important;background-clip:text!important;color:${GRADIENT_START}!important;}
</style>
</head>
<body class="body" bgcolor="${BG}" style="margin:0;padding:0;${bg(BG)};font-family:${F};color:${TEXT};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="${bg(BG)};">
<tr><td align="center" bgcolor="${BG}" style="padding:48px 20px 32px;${bg(BG)};">

  <!-- Logo (same asset as app: icon_circle) -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="${bg(BG)};"><tr>
    <td align="center" bgcolor="${BG}" style="padding-bottom:10px;${bg(BG)};">
      <img src="${imgSrc}" alt="Boardify" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:16px;border:2px solid ${BORDER};" />
    </td>
  </tr><tr>
    <td align="center" bgcolor="${BG}" style="padding-bottom:28px;font-family:${F};font-size:18px;font-weight:800;letter-spacing:-0.2px;${bg(BG)};">
      <span class="boardify-brand" style="background:linear-gradient(90deg,${GRADIENT_START},${GRADIENT_END});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:${GRADIENT_START};">Boardify</span>
    </td>
  </tr></table>

  <!-- Accent line -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="max-width:460px;width:100%;${bg(BG)};">
  <tr>
    <td style="height:3px;border-radius:3px 3px 0 0;background:linear-gradient(90deg,${GRADIENT_START},${GRADIENT_END});font-size:0;line-height:0;">&nbsp;</td>
  </tr>
  </table>

  <!-- Card (neu-style: white face + black border like in-app sheets) -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="max-width:460px;width:100%;${bg(CARD)};border:2px solid ${BORDER};border-top:0;border-radius:0 0 14px 14px;">
  <tr><td bgcolor="${CARD}" style="padding:36px 32px 32px;${bg(CARD)};">
    ${content}
  </td></tr>
  </table>

  <!-- Footer -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="max-width:460px;width:100%;${bg(BG)};">
  <tr><td align="center" bgcolor="${BG}" style="padding:24px 0 0;font-family:${F};font-size:12px;line-height:1.6;color:${FOOT};${bg(BG)};">
    &copy; ${year} Boardify &mdash; Collaborative boards and tasks.<br/>
    You received this because an action was requested on your account.
  </td></tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}

export function passwordResetEmailHtml(code: string, logoUrl: string): string {
  const INFO_BG = '#e0f2fe';
  const INFO_BORDER = '#7dd3fc';

  const digits = code.split('').map(d =>
    `<td align="center" valign="middle" width="44" height="52" bgcolor="${INNER}" style="width:44px;height:52px;font-size:24px;font-weight:700;color:${TEXT};font-family:${MONO};${bg(INNER)};border:2px solid ${BORDER};border-radius:8px;letter-spacing:0;line-height:52px;">${d}</td>`
  ).join('');

  return emailLayout(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:24px;font-weight:800;padding-bottom:10px;letter-spacing:-0.3px;color:${TEXT};${bg(CARD)};">
        Reset your password
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:15px;line-height:1.65;color:${BODY};padding-bottom:28px;${bg(CARD)};">
        Enter this verification code in the app to continue.
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:8px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="6" border="0" bgcolor="${CARD}" style="margin:0 auto;${bg(CARD)};">
          <tr>${digits}</tr>
        </table>
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:24px;${bg(CARD)};">
        <span style="font-family:${MONO};font-size:13px;color:${DIM};letter-spacing:2px;-webkit-user-select:all;user-select:all;">${code}</span>
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:28px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${INFO_BG}" style="${bg(INFO_BG)};border:2px solid ${INFO_BORDER};border-radius:8px;">
          <tr><td bgcolor="${INFO_BG}" style="padding:10px 20px;font-family:${F};font-size:13px;color:#0369a1;text-align:center;${bg(INFO_BG)};">
            &#9201; This code expires in <strong style="color:#0369a1;">15 minutes</strong>
          </td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="${CARD}" style="border-top:1px solid ${BORDER};padding-top:20px;${bg(CARD)};" align="center">
        <span style="font-family:${F};color:${DIM};font-size:13px;line-height:1.55;">If you didn&rsquo;t request this, you can safely ignore this email.</span>
      </td></tr>
    </table>`,
    logoUrl
  );
}

export function accountDeletionEmailHtml(deleteUrl: string, logoUrl: string): string {
  const WARN_ICON_BG = '#fef2f2';
  const WARN_BOX_BG = '#fef2f2';
  const WARN_BORDER = '#fecaca';

  return emailLayout(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
      <!-- Warning icon -->
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:16px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
          <tr><td align="center" valign="middle" width="56" height="56" bgcolor="${WARN_ICON_BG}" style="width:56px;height:56px;border-radius:28px;border:2px solid ${BORDER};${bg(WARN_ICON_BG)};font-size:28px;line-height:56px;">
            &#9888;&#65039;
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:24px;font-weight:800;padding-bottom:10px;letter-spacing:-0.3px;color:${TEXT};${bg(CARD)};">
        Delete your account
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:15px;line-height:1.65;color:${BODY};padding-bottom:24px;${bg(CARD)};">
        You requested to permanently delete your Boardify account and all associated data.
      </td></tr>

      <!-- What will be deleted -->
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${GRADIENT_END};padding-bottom:10px;${bg(CARD)};">
        What will be deleted
      </td></tr>
      <tr><td bgcolor="${CARD}" style="padding:0 0 28px;${bg(CARD)};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${INNER}" style="${bg(INNER)};border:2px solid ${BORDER};border-radius:10px;">
          <tr><td bgcolor="${INNER}" style="padding:18px 22px;font-family:${F};font-size:14px;line-height:2.1;color:${BODY};${bg(INNER)};">
            <span style="color:#b91c1c;">&#10005;</span>&ensp;Your profile and account data<br/>
            <span style="color:#b91c1c;">&#10005;</span>&ensp;Boards you own and shared access<br/>
            <span style="color:#b91c1c;">&#10005;</span>&ensp;Lists, cards, and board content<br/>
            <span style="color:#b91c1c;">&#10005;</span>&ensp;Preferences and notification settings
          </td></tr>
        </table>
      </td></tr>

      <!-- CTA button -->
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:16px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
          <tr><td align="center" bgcolor="#b91c1c" style="${bg('#b91c1c')};border:2px solid ${BORDER};border-radius:8px;">
            <a href="${deleteUrl}" target="_blank" style="display:inline-block;padding:14px 36px;color:#ffffff;font-family:${F};font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">Delete My Account</a>
          </td></tr>
        </table>
      </td></tr>

      <!-- Permanent warning -->
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:28px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${WARN_BOX_BG}" style="${bg(WARN_BOX_BG)};border:2px solid ${WARN_BORDER};border-radius:8px;">
          <tr><td bgcolor="${WARN_BOX_BG}" style="padding:12px 22px;font-family:${F};font-size:13px;color:#991b1b;text-align:center;line-height:1.55;font-weight:500;${bg(WARN_BOX_BG)};">
            &#9888; This action is <strong style="color:#b91c1c;">permanent</strong> and cannot be undone.
          </td></tr>
        </table>
      </td></tr>

      <tr><td bgcolor="${CARD}" style="border-top:1px solid ${BORDER};padding-top:20px;${bg(CARD)};" align="center">
        <span style="font-family:${F};color:${DIM};font-size:13px;line-height:1.55;">This link expires in 1 hour. If you didn&rsquo;t request this, ignore this email.</span>
      </td></tr>
    </table>`,
    logoUrl
  );
}

export function emailVerificationHtml(verifyUrl: string, logoUrl: string): string {
  const CHECK_BG = '#e0f2fe';

  return emailLayout(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:16px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
          <tr><td align="center" valign="middle" width="56" height="56" bgcolor="${CHECK_BG}" style="width:56px;height:56px;border-radius:28px;border:2px solid ${BORDER};${bg(CHECK_BG)};font-size:28px;line-height:56px;">
            &#9989;
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:24px;font-weight:800;padding-bottom:10px;letter-spacing:-0.3px;color:${TEXT};${bg(CARD)};">
        Verify your email
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:15px;line-height:1.65;color:${BODY};padding-bottom:24px;${bg(CARD)};">
        You signed up for Boardify. Click the button below to verify your email and get started.
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:28px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
          <tr><td align="center" style="background:linear-gradient(90deg,${GRADIENT_START},${GRADIENT_END});border:2px solid ${BORDER};border-radius:8px;">
            <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:14px 36px;color:#ffffff;font-family:${F};font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">Verify Email</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="${CARD}" style="border-top:1px solid ${BORDER};padding-top:20px;${bg(CARD)};" align="center">
        <span style="font-family:${F};color:${DIM};font-size:13px;line-height:1.55;">If you didn&rsquo;t create an account, you can safely ignore this email.</span>
      </td></tr>
    </table>`,
    logoUrl
  );
}

export function boardInviteEmailHtml(
  inviterLabel: string,
  boardName: string,
  acceptHttpsUrl: string,
  boardifyDeepLink: string,
  logoUrl: string
): string {
  const INFO_BG = INNER;
  return emailLayout(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:16px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
          <tr><td align="center" valign="middle" width="56" height="56" bgcolor="${INNER}" style="width:56px;height:56px;border-radius:28px;border:2px solid ${BORDER};${bg(INNER)};font-size:26px;line-height:56px;">
            &#128188;
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:24px;font-weight:800;padding-bottom:10px;letter-spacing:-0.3px;color:${TEXT};${bg(CARD)};">
        You&rsquo;re invited to a board
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:15px;line-height:1.65;color:${BODY};padding-bottom:8px;${bg(CARD)};">
        <strong style="color:${TEXT};">${escapeHtml(inviterLabel)}</strong> invited you to collaborate on
        <strong style="color:${TEXT};">${escapeHtml(boardName)}</strong>.
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:14px;line-height:1.6;color:${MUTED};padding-bottom:24px;${bg(CARD)};">
        Open the link on your phone to accept or decline in the Boardify app.
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:16px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
          <tr><td align="center" style="background:linear-gradient(90deg,${GRADIENT_START},${GRADIENT_END});border:2px solid ${BORDER};border-radius:8px;">
            <a href="${acceptHttpsUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 36px;color:#ffffff;font-family:${F};font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">Open invitation</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="${CARD}" style="padding-bottom:20px;${bg(CARD)};" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${INFO_BG}" style="${bg(INFO_BG)};border:2px solid ${BORDER};border-radius:8px;max-width:100%;">
          <tr><td bgcolor="${INFO_BG}" style="padding:12px 18px;font-family:${MONO};font-size:11px;color:${BODY};word-break:break-all;text-align:left;${bg(INFO_BG)};">
            App link (copy if the button doesn&rsquo;t open):<br/>
            <span style="user-select:all;-webkit-user-select:all;">${escapeHtml(boardifyDeepLink)}</span>
          </td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="${CARD}" style="border-top:1px solid ${BORDER};padding-top:20px;${bg(CARD)};" align="center">
        <span style="font-family:${F};color:${DIM};font-size:13px;line-height:1.55;">If you didn&rsquo;t expect this, you can ignore this email. The invitation expires in 14 days.</span>
      </td></tr>
    </table>`,
    logoUrl
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parentalConsentEmailHtml(confirmUrl: string, logoUrl: string): string {
  const CHECK_BG = '#ede9fe';

  return emailLayout(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:16px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
          <tr><td align="center" valign="middle" width="56" height="56" bgcolor="${CHECK_BG}" style="width:56px;height:56px;border-radius:28px;border:2px solid ${BORDER};${bg(CHECK_BG)};font-size:28px;line-height:56px;">
            &#128105;&#8205;&#128102;
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:24px;font-weight:800;padding-bottom:10px;letter-spacing:-0.3px;color:${TEXT};${bg(CARD)};">
        Parent or guardian consent
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="font-family:${F};font-size:15px;line-height:1.65;color:${BODY};padding-bottom:24px;${bg(CARD)};">
        A child in your care has signed up for Boardify and needs your permission to use the app. By clicking below, you agree to our Terms of Service and Privacy Policy on their behalf and confirm you are their parent or legal guardian.
      </td></tr>
      <tr><td align="center" bgcolor="${CARD}" style="padding-bottom:28px;${bg(CARD)};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="${bg(CARD)};">
          <tr><td align="center" style="background:linear-gradient(90deg,${GRADIENT_START},${GRADIENT_END});border:2px solid ${BORDER};border-radius:8px;">
            <a href="${confirmUrl}" target="_blank" style="display:inline-block;padding:14px 36px;color:#ffffff;font-family:${F};font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">I agree &mdash; allow my child to use the app</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="${CARD}" style="border-top:1px solid ${BORDER};padding-top:20px;${bg(CARD)};" align="center">
        <span style="font-family:${F};color:${DIM};font-size:13px;line-height:1.55;">This link expires in 7 days. If you didn&rsquo;t expect this, you can ignore this email.</span>
      </td></tr>
    </table>`,
    logoUrl
  );
}
