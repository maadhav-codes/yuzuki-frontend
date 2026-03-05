'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/useAuthStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, signUp, user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [loading, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        setNotice('Account created. Check your email to confirm your account before signing in.');
      } else {
        await signIn(email, password);
        router.replace('/');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modeTitle = isSignUp ? 'Create Account' : 'Welcome Back';
  const modeDescription = isSignUp
    ? 'Sign up with email and password.'
    : 'Sign in to your account.';

  return (
    <main className='min-h-screen bg-[radial-gradient(circle_at_top_left,#1e293b_0%,#020617_40%,#020617_100%)] p-4 text-slate-100 md:p-6'>
      <div className='mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md items-center'>
        <Card className='w-full border-slate-700/60 bg-slate-900/70 shadow-2xl shadow-cyan-950/20 backdrop-blur'>
          <CardHeader className='space-y-1 pb-2'>
            <h1 className='text-xl tracking-tight text-slate-50'>{modeTitle}</h1>
            <p className='text-sm text-slate-300'>{modeDescription}</p>
          </CardHeader>
          <CardContent className='space-y-4'>
            <form className='space-y-4' onSubmit={handleSubmit}>
              <div className='space-y-2'>
                <Label className='text-slate-200' htmlFor='email'>
                  Email
                </Label>
                <Input
                  className='h-11 border-slate-700/70 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-400/80'
                  id='email'
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='you@example.com'
                  required
                  type='email'
                  value={email}
                />
              </div>

              <div className='space-y-2'>
                <Label className='text-slate-200' htmlFor='password'>
                  Password
                </Label>
                <Input
                  className='h-11 border-slate-700/70 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-400/80'
                  id='password'
                  minLength={6}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder='Enter your password'
                  required
                  type='password'
                  value={password}
                />
              </div>

              <Button
                className='h-11 w-full bg-linear-to-r from-cyan-400 to-sky-500 font-semibold text-slate-950 shadow-md shadow-cyan-900/40 hover:from-cyan-300 hover:to-sky-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-300'
                disabled={isSubmitting}
                type='submit'
              >
                {isSubmitting ? 'Authenticating...' : isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </form>
            {error ? (
              <p className='rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-rose-200'>
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className='rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-amber-100'>
                {notice}
              </p>
            ) : null}
            <p className='text-slate-400'>
              {isSignUp ? 'Already have an account?' : 'Need an account?'}{' '}
              <button
                className='font-medium text-cyan-300 hover:text-cyan-200'
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setIsSignUp((prev) => !prev);
                }}
                type='button'
              >
                {isSignUp ? 'Sign in here.' : 'Create one.'}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
