'use client';

import { useEffect } from 'react';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className='flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center'>
      <h1 className='text-3xl font-semibold text-slate-900'>Something went wrong</h1>
      <p className='mt-3 max-w-md text-sm text-slate-600'>
        An unexpected error occurred while loading this page.
      </p>
      <button
        className='mt-6 cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm text-white'
        onClick={() => reset()}
        type='button'
      >
        Try again
      </button>
    </main>
  );
}
