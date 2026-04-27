'use client';

import Link from 'next/link';
import { requestPasswordUpdate } from '@/utils/auth-helpers/server';
import { handleRequest } from '@/utils/auth-helpers/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LoadingDots from '@/components/ui/LoadingDots';

interface ForgotPasswordProps {
  allowEmail: boolean;
  redirectMethod: string;
  disableButton?: boolean;
}

export default function ForgotPassword({ allowEmail, redirectMethod, disableButton }: ForgotPasswordProps) {
  const router = redirectMethod === 'client' ? useRouter() : null;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitting(true);
    await handleRequest(e, requestPasswordUpdate, router);
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400 text-center -mt-2 mb-1">
        Enter your email and we'll send you a reset link.
      </p>
      <form noValidate onSubmit={handleSubmit} className="space-y-3">
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Email Address *"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect="off"
          required
          className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
        <button
          type="submit"
          disabled={isSubmitting || disableButton}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? <><LoadingDots /> Sending…</> : 'Send Reset Link'}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500 pt-2 border-t border-zinc-800">
        <Link href="/signin/password_signin" className="text-zinc-200 hover:text-white transition-colors">
          ← Back to Log In
        </Link>
      </p>
    </div>
  );
}
