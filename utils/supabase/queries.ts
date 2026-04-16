import { cache } from 'react';
import { createClient } from './server';

// Use the concrete return type so generics always match the installed version
type SupabaseServerClient = ReturnType<typeof createClient>;

// Explicit row types mirror the Database interface in types_db.ts
export type UserDetails = {
  avatar_url: string | null;
  billing_address: Record<string, unknown> | null;
  full_name: string | null;
  id: string;
  payment_method: Record<string, unknown> | null;
};

export const getUser = cache(async (supabase: SupabaseServerClient) => {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
});

export const getSubscription = cache(async (supabase: SupabaseServerClient) => {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, prices(*, products(*))')
    .in('status', ['trialing', 'active'])
    .maybeSingle();

  return subscription;
});

export const getProducts = cache(async (supabase: SupabaseServerClient) => {
  const { data: products } = await supabase
    .from('products')
    .select('*, prices(*)')
    .eq('active', true)
    .eq('prices.active', true)
    .order('metadata->index')
    .order('unit_amount', { referencedTable: 'prices' });

  return products;
});

export const getUserDetails = cache(
  async (supabase: SupabaseServerClient): Promise<UserDetails | null> => {
    const { data } = await supabase.from('users').select('*').single();
    return data as unknown as UserDetails | null;
  }
);
