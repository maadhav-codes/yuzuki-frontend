'use client';

import { IconLogout, IconMicrophone, IconSettings, IconVolume2 } from '@tabler/icons-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import ChatConversation from '@/components/ChatConversation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useVoiceSettings } from '@/hooks/useVoiceSettings';
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
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    sttEnabled,
    setSttEnabled,
    ttsEnabled,
    setTtsEnabled,
    pitch,
    setPitch,
    rate,
    setRate,
    volume,
    setVolume,
  } = useVoiceSettings();
  const [support, setSupport] = useState({ hasSTT: false, hasTTS: false });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSupport({
        hasSTT: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
        hasTTS: 'speechSynthesis' in window,
      });
    }
  }, []);

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
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <main className='min-h-screen bg-[radial-gradient(circle_at_top_left,#1e293b_0%,#020617_40%,#020617_100%)] text-slate-100'>
      <header className='sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/10 backdrop-blur'>
        <div className='mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6'>
          <div className='text-sm font-semibold tracking-wide text-slate-200'>Yuzuki Chat</div>

          <Sheet onOpenChange={setSettingsOpen} open={settingsOpen}>
            <SheetTrigger asChild>
              <Button
                className='group flex h-10 items-center gap-2.5 rounded-full border-slate-800 bg-slate-900/50 p-1 pr-3 transition-all hover:border-slate-700 hover:bg-slate-800 focus-visible:ring-1 focus-visible:ring-cyan-500/50'
                variant='outline'
              >
                <div className='relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800'>
                  {avatarUrl ? (
                    <Image
                      alt={`${displayName} avatar`}
                      className='h-full w-full object-cover'
                      height={32}
                      referrerPolicy='no-referrer'
                      src={avatarUrl}
                      width={32}
                    />
                  ) : (
                    <span className='text-xs font-semibold text-slate-300 group-hover:text-slate-200'>
                      {initials}
                    </span>
                  )}
                </div>

                <span className='hidden max-w-30 truncate text-sm font-medium text-slate-300 group-hover:text-slate-100 sm:block'>
                  {displayName}
                </span>
                <IconSettings className='h-4 w-4 text-slate-500 transition-transform duration-300 group-hover:rotate-45 group-hover:text-slate-300' />
              </Button>
            </SheetTrigger>

            <SheetContent className='flex w-full flex-col border-l border-slate-800 bg-slate-950 p-0 sm:max-w-sm'>
              <SheetHeader className='border-b border-slate-800/60 bg-slate-900/20 px-6 py-5 text-left'>
                <SheetTitle className='text-base font-semibold text-slate-100'>
                  Account & Settings
                </SheetTitle>
                <SheetDescription className='sr-only'>
                  Manage your profile and application preferences.
                </SheetDescription>
              </SheetHeader>

              <div className='flex-1 overflow-y-auto'>
                <div className='px-6 py-6'>
                  <div className='flex items-center gap-4 rounded-xl border border-slate-800/60 bg-slate-900/30 p-4'>
                    {avatarUrl ? (
                      <Image
                        alt='Avatar'
                        className='h-10 w-10 rounded-full border border-slate-700 object-cover'
                        height={40}
                        src={avatarUrl}
                        width={40}
                      />
                    ) : (
                      <div className='flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-100'>
                        {initials}
                      </div>
                    )}
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-medium text-slate-100'>{displayName}</p>
                      <p className='truncate text-xs text-slate-400'>{user?.email}</p>
                    </div>
                  </div>
                </div>

                <Separator className='bg-slate-800/60' />

                <div className='space-y-6 px-6 py-6'>
                  <div className='space-y-3'>
                    <h3 className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>
                      Voice Features
                    </h3>
                    <div className='space-y-2.5'>
                      <label
                        className={`flex cursor-pointer items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/20 p-3.5 transition-colors hover:bg-slate-900/50 ${
                          !support.hasSTT && 'cursor-not-allowed opacity-60'
                        }`}
                        htmlFor='stt-toggle'
                      >
                        <div className='flex items-center gap-3'>
                          <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400'>
                            <IconMicrophone className='h-4 w-4' />
                          </div>
                          <div className='space-y-0.5'>
                            <div className='text-sm font-medium text-slate-200'>Speech-to-Text</div>
                            <div className='text-[11px] text-slate-500'>
                              {!support.hasSTT ? 'Unsupported by browser' : 'Use mic input'}
                            </div>
                          </div>
                        </div>
                        <Switch
                          checked={sttEnabled}
                          disabled={!support.hasSTT}
                          id='stt-toggle'
                          onCheckedChange={setSttEnabled}
                        />
                      </label>

                      <label
                        className={`flex cursor-pointer items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/20 p-3.5 transition-colors hover:bg-slate-900/50 ${
                          !support.hasTTS && 'cursor-not-allowed opacity-60'
                        }`}
                        htmlFor='tts-toggle'
                      >
                        <div className='flex items-center gap-3'>
                          <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400'>
                            <IconVolume2 className='h-4 w-4' />
                          </div>
                          <div className='space-y-0.5'>
                            <div className='text-sm font-medium text-slate-200'>Text-to-Speech</div>
                            <div className='text-[11px] text-slate-500'>
                              {!support.hasTTS ? 'Unsupported by browser' : 'AI voice output'}
                            </div>
                          </div>
                        </div>
                        <Switch
                          checked={ttsEnabled}
                          disabled={!support.hasTTS}
                          id='tts-toggle'
                          onCheckedChange={setTtsEnabled}
                        />
                      </label>

                      {ttsEnabled && support.hasTTS && (
                        <div className='mt-3 space-y-4 rounded-xl border border-slate-800/60 bg-slate-900/10 p-4'>
                          <div className='space-y-2.5'>
                            <div className='flex items-center justify-between'>
                              <span className='text-xs font-medium text-slate-300'>Volume</span>
                              <span className='text-[10px] text-slate-500'>
                                {Math.round(volume * 100)}%
                              </span>
                            </div>
                            <Slider
                              className='w-full'
                              max={1.0}
                              min={0.0}
                              onValueChange={(vals: number[]) => setVolume(vals[0])}
                              step={0.1}
                              value={[volume]}
                            />
                          </div>

                          <div className='space-y-2.5'>
                            <div className='flex items-center justify-between'>
                              <span className='text-xs font-medium text-slate-300'>Pitch</span>
                              <span className='text-[10px] text-slate-500'>
                                {pitch.toFixed(1)}x
                              </span>
                            </div>
                            <Slider
                              className='w-full'
                              max={2.0}
                              min={0.0}
                              onValueChange={(vals: number[]) => setPitch(vals[0])}
                              step={0.1}
                              value={[pitch]}
                            />
                          </div>

                          <div className='space-y-2.5'>
                            <div className='flex items-center justify-between'>
                              <span className='text-xs font-medium text-slate-300'>Speed</span>
                              <span className='text-[10px] text-slate-500'>{rate.toFixed(1)}x</span>
                            </div>
                            <Slider
                              className='w-full'
                              max={2.0}
                              min={0.5}
                              onValueChange={(vals: number[]) => setRate(vals[0])}
                              step={0.1}
                              value={[rate]}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className='border-t border-slate-800/60 bg-slate-900/20 p-4'>
                <Button
                  className='w-full py-5 justify-center gap-2 bg-slate-800/50 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300'
                  disabled={isSigningOut}
                  onClick={handleLogout}
                  variant='ghost'
                >
                  <IconLogout className='h-4 w-4' />
                  {isSigningOut ? 'Logging out...' : 'Log out'}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className='mx-auto h-[calc(100vh-3.5rem)] w-full max-w-7xl overflow-hidden px-4 py-4 md:px-6'>
        <ChatConversation sttEnabled={sttEnabled} ttsEnabled={ttsEnabled} />
      </div>
    </main>
  );
}
