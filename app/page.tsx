'use client';

import { Button } from '@/components/ui/button';
import { useChatStore } from '@/store/chatStore';

export default function Home() {
  const messages = useChatStore((state) => state.messages);
  const addMessage = useChatStore((state) => state.addMessage);

  return (
    <main className='flex min-h-screen flex-col items-center justify-center p-24'>
      <h1 className='text-4xl font-bold text-primary'>AI Companion MVP</h1>
      <p className='mt-4 text-lg'>Frontend & State (Zustand) Initialized</p>

      <Button className='mt-4' onClick={() => addMessage('Hello World')} type='button'>
        Test State
      </Button>

      <div className='mt-4'>
        {messages.map((msg, i) => (
          <p key={i}>{msg}</p>
        ))}
      </div>
    </main>
  );
}
