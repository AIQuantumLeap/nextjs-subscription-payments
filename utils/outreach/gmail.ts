import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_SITE_URL}/api/outreach/gmail/callback`
  );
}

export function getAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
}

export async function getTokensFromCode(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

function makeGmailClient(accessToken: string, refreshToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: client });
}

export async function getConnectedEmail(accessToken: string, refreshToken: string): Promise<string> {
  const gmail = makeGmailClient(accessToken, refreshToken);
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return profile.data.emailAddress!;
}

export async function sendEmail(
  accessToken: string,
  refreshToken: string,
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string,
  threadId?: string
): Promise<{ messageId: string; threadId: string }> {
  const gmail = makeGmailClient(accessToken, refreshToken);

  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`] : [])
  ];

  const raw = Buffer.from([...headers, '', body].join('\r\n')).toString('base64url');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, ...(threadId ? { threadId } : {}) }
  });

  return { messageId: res.data.id!, threadId: res.data.threadId! };
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  body: string;
  internalDate: Date;
  messageIdHeader: string;
  labelIds: string[];
}

export async function getThreadMessages(
  accessToken: string,
  refreshToken: string,
  threadId: string
): Promise<GmailMessage[]> {
  const gmail = makeGmailClient(accessToken, refreshToken);
  const thread = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
  return (thread.data.messages ?? []).map(parseMessage);
}

export async function getNewReplies(
  accessToken: string,
  refreshToken: string,
  threadId: string,
  agentEmail: string,
  after: Date
): Promise<GmailMessage[]> {
  const messages = await getThreadMessages(accessToken, refreshToken, threadId);
  return messages.filter(
    (m) =>
      m.internalDate > after &&
      !m.labelIds.includes('SENT') &&
      !m.from.toLowerCase().includes(agentEmail.toLowerCase())
  );
}

export function extractTextBody(rawBody: string): string {
  // Strip quoted reply sections (lines starting with >)
  return rawBody
    .split('\n')
    .filter((line) => !line.startsWith('>'))
    .join('\n')
    .replace(/\r/g, '')
    .trim();
}

function parseMessage(msg: any): GmailMessage {
  const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
  const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: get('Subject'),
    from: get('From'),
    body: extractBodyFromPayload(msg.payload),
    internalDate: new Date(parseInt(msg.internalDate ?? '0')),
    messageIdHeader: get('Message-ID'),
    labelIds: msg.labelIds ?? []
  };
}

function extractBodyFromPayload(payload: any): string {
  if (!payload) return '';

  // Prefer plain text parts
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
    // Recurse into nested multipart
    for (const part of payload.parts) {
      const text = extractBodyFromPayload(part);
      if (text) return text;
    }
  }

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  return '';
}
