'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import ChatConversation from '@/components/ChatConversation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { useUserStore } from '@/store/useUserStore';

function getInitials(nameOrEmail: string | null | undefined) {
  if (!nameOrEmail) return 'U';

  const parts = nameOrEmail.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  return (parts[0]?.slice(0, 2) ?? 'U').toUpperCase();
}

export default function ChatPageShell() {
  const user = useUserStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName = useMemo(
    () => user?.user_metadata?.full_name ?? user?.email ?? 'User',
    [user]
  );

  const avatarUrl = useMemo(
    () => user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null,
    [user]
  );

  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const handleLogout = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <main className='min-h-screen bg-[radial-gradient(circle_at_top_left,#1e293b_0%,#020617_40%,#020617_100%)] text-slate-100'>
      <header className='border-b border-slate-800 bg-slate-950/10 backdrop-blur'>
        <div className='mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6'>
          <div className='text-sm font-semibold tracking-wide text-slate-200'>Yuzuki Chat</div>

          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2'>
              {avatarUrl ? (
                <Image
                  alt={`${displayName} avatar`}
                  className='h-9 w-9 rounded-full border border-slate-700 object-cover'
                  height={36}
                  referrerPolicy='no-referrer'
                  src={avatarUrl}
                  width={36}
                />
              ) : (
                <div className='flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-100'>
                  {initials}
                </div>
              )}
              <span className='hidden max-w-40 truncate text-sm text-slate-300 sm:inline'>
                {displayName}
              </span>
            </div>

            <Button
              className='border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'
              disabled={isSigningOut}
              onClick={handleLogout}
              variant='outline'
            >
              {isSigningOut ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        </div>
      </header>

      <div className='mx-auto w-full max-w-6xl px-4 py-4 md:px-6'>
        <ChatConversation />
      </div>
    </main>
  );
}
