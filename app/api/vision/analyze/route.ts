import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';
import { getUser, getSubscription } from '@/utils/supabase/queries';

// Rate limits per plan (requests per day to OpenAI Vision)
const RATE_LIMITS: Record<string, number> = {
  pro: 500,
  enterprise: 99999,
  default: 0
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createClient();
  const [user, subscription] = await Promise.all([
    getUser(supabase),
    getSubscription(supabase)
  ]);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Plan check — cast to any to work around supabase-js v2 nested join types
  const sub = subscription as any;
  const planName = sub?.prices?.products?.name?.toLowerCase() ?? '';
  const isPro =
    sub?.status === 'active' &&
    (planName.includes('pro') || planName.includes('enterprise'));

  if (!isPro) {
    return NextResponse.json(
      { error: 'AI descriptions require a Pro or Enterprise subscription.' },
      { status: 403 }
    );
  }

  // Rate limit check
  const tier = planName.includes('enterprise') ? 'enterprise' : 'pro';
  const dailyLimit = RATE_LIMITS[tier] ?? RATE_LIMITS.default;

  const { data: usageData } = await (supabase as any).rpc('get_api_usage_today', {
    p_user_id: user.id,
    p_endpoint: 'vision_analyze'
  });

  if ((usageData ?? 0) >= dailyLimit) {
    return NextResponse.json(
      { error: `Daily limit of ${dailyLimit} AI requests reached. Resets at midnight UTC.` },
      { status: 429 }
    );
  }

  // Parse request body
  let imageDataUrl: string;
  try {
    const body = await request.json();
    imageDataUrl = body.image;
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      throw new Error('Missing image');
    }
    if (!imageDataUrl.startsWith('data:image/')) {
      throw new Error('Invalid image format');
    }
    // Size check (base64 encoded ~= 4/3 of raw bytes)
    const base64Data = imageDataUrl.split(',')[1] ?? '';
    const estimatedBytes = base64Data.length * 0.75;
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 4 MB)' }, { status: 413 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Invalid request' }, { status: 400 });
  }

  // OpenAI Vision API call
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content:
            'You are a computer vision assistant. Analyze the provided image and return a JSON object with these fields: ' +
            '"description" (2-3 sentence scene description), ' +
            '"objects" (array of {name, confidence} for detected objects, confidence 0-1), ' +
            '"scene" (single scene category like "indoor/office", "outdoor/street", etc.), ' +
            '"colors" (array of 3-5 dominant color names), ' +
            '"text_detected" (any visible text in the image, or null if none). ' +
            'Respond ONLY with valid JSON, no markdown.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageDataUrl, detail: 'low' }
            }
          ]
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON from the response if wrapped in markdown
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    // Increment usage counter
    await (supabase as any).rpc('increment_api_usage', {
      p_user_id: user.id,
      p_endpoint: 'vision_analyze'
    });

    return NextResponse.json({
      ...parsed,
      timestamp: Date.now()
    });
  } catch (err: any) {
    const isQuota = err?.status === 429 || err?.code === 'insufficient_quota';
    return NextResponse.json(
      { error: isQuota ? 'AI service quota exceeded. Please try again later.' : 'Analysis failed' },
      { status: 500 }
    );
  }
}
