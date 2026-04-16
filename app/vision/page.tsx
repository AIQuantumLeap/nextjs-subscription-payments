import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUser, getSubscription } from '@/utils/supabase/queries';
import VisionDashboard from '@/components/vision/VisionDashboard';

export const metadata = {
  title: 'Vision Studio — AI Camera Processing',
  description:
    'Real-time object detection, barcode scanning, image processing and AI descriptions powered by your camera.'
};

export default async function VisionPage() {
  const supabase = createClient();
  const [user, subscription] = await Promise.all([
    getUser(supabase),
    getSubscription(supabase)
  ]);

  if (!user) redirect('/signin');

  // Determine plan tier from active subscription
  // Cast to any to work around supabase-js v2 nested join type limitations
  const sub = subscription as any;
  const planName = sub?.prices?.products?.name?.toLowerCase() ?? '';
  const isPro =
    sub?.status === 'active' &&
    (planName.includes('pro') || planName.includes('enterprise'));

  return <VisionDashboard isPro={isPro} userId={user.id} />;
}
