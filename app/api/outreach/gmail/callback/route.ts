import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { getTokensFromCode, getConnectedEmail } from '@/utils/outreach/gmail';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/outreach/settings?error=gmail_denied`
    );
  }

  const supabase = createClient();
  const db = supabase as any;
  const user = await getUser(supabase);
  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/signin`);
  }

  try {
    const tokens = await getTokensFromCode(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing tokens in OAuth response');
    }

    const email = await getConnectedEmail(tokens.access_token, tokens.refresh_token);

    await (supabase as any).from('gmail_connections').upsert(
      {
        user_id: user.id,
        email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/outreach/settings?gmail=connected`
    );
  } catch (err: any) {
    console.error('Gmail OAuth error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/outreach/settings?error=gmail_failed`
    );
  }
}
