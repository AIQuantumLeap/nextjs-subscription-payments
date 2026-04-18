import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { getAuthUrl } from '@/utils/outreach/gmail';

export async function GET() {
  const supabase = createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
