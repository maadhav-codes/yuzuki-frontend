import { redirect } from 'next/navigation';
import ChatPageShell from '@/components/ChatPageShell';
import { createClient } from '@/utils/supabase/server';

export default async function ChatPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <ChatPageShell />;
}
