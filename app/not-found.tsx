import Link from 'next/link';

export default function NotFound() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center'>
      <p className='text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase'>404</p>
      <h1 className='mt-3 text-3xl font-semibold text-slate-900'>Page not found</h1>
      <p className='mt-3 max-w-md text-sm text-slate-600'>
        The page you are looking for does not exist or may have moved.
      </p>
      <Link className='mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white' href='/'>
        Return home
      </Link>
    </main>
  );
}
