import { localizedRedirect } from '@/i18n/server-redirect';
import { auth } from '@/lib/auth';
import { SandboxChatClient } from '@/components/chat/sandbox-chat-client';

export default async function ChatSandboxPage() {
  const session = await auth();
  if (!session?.user?.id) {
    await localizedRedirect('/sign-in');
  }

  const u = session!.user;
  const userDisplayName = u.name?.trim() || u.email?.split('@')[0]?.trim() || 'User';

  return (
    <div className="mb-6 flex h-[min(720px,calc(100dvh-9.5rem))] min-h-[min(480px,calc(100dvh-9.5rem))] flex-col py-3 sm:py-4">
      <SandboxChatClient userDisplayName={userDisplayName} />
    </div>
  );
}
