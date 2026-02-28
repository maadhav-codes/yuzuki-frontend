export default function Loading() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-50'>
      <div className='h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800' />
      <span className='sr-only'>Loading page</span>
    </div>
  );
}
