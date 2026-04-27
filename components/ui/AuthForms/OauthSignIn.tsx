'use client';

import { signInWithOAuth } from '@/utils/auth-helpers/client';
import { type Provider } from '@supabase/supabase-js';
import { useState } from 'react';

type OAuthProvider = { name: Provider; displayName: string; icon: React.ReactNode };

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5 fill-zinc-100" viewBox="0 0 814 1000" aria-hidden="true">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.3-162-39.3c-73.4 0-100.7 40.8-165.7 40.8s-107.3-57.2-155.9-127.8C46.7 790.7 0 663 0 541.8c0-207.5 134.4-317.5 266.5-317.5 99.8 0 184 64.9 244.9 64.9 57.1 0 147.6-68.4 260.3-68.4zm-388.4-108.4c0-111.1 64.3-185.8 61.7-192.2-56.5 3.2-127.2 73.9-158.8 138-29.4 60.3-56.2 158.5-56.2 218.3 0 26.5 1.9 55.4 6.4 77.5z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-5 w-5 fill-zinc-100" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.6.113.793-.258.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const PROVIDERS: OAuthProvider[] = [
  { name: 'apple',  displayName: 'Apple',  icon: <AppleIcon /> },
  { name: 'google', displayName: 'Google', icon: <GoogleIcon /> },
  { name: 'github', displayName: 'GitHub', icon: <GitHubIcon /> }
];

export default function OauthSignIn() {
  const [submitting, setSubmitting] = useState<Provider | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, provider: Provider) => {
    setSubmitting(provider);
    await signInWithOAuth(e);
    setSubmitting(null);
  };

  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {PROVIDERS.map((p) => (
        <form key={p.name} onSubmit={(e) => handleSubmit(e, p.name)}>
          <input type="hidden" name="provider" value={p.name} />
          <button
            type="submit"
            disabled={submitting !== null}
            title={`Continue with ${p.displayName}`}
            aria-label={`Continue with ${p.displayName}`}
            className="w-full flex items-center justify-center py-3 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 disabled:opacity-50 transition-colors"
          >
            {submitting === p.name ? (
              <div className="w-5 h-5 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
            ) : (
              p.icon
            )}
          </button>
        </form>
      ))}
    </div>
  );
}
