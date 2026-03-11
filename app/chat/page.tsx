import { redirect } from 'next/navigation';
import ChatClient from '@/components/ChatClient';
import { createClient } from '@/utils/supabase/server';

export default async function ChatPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <ChatClient />;
}
