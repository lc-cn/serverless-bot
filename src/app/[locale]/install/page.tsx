import { localizedRedirect } from '@/i18n/server-redirect';
import { getInstallPhase } from '@/lib/install/install-state';
import { InstallWizard } from './install-wizard';

export default async function InstallPage() {
  const phase = await getInstallPhase();
  if (phase === 'installed') {
    await localizedRedirect('/dashboard');
  }
  if (phase === 'needs_upgrade') {
    await localizedRedirect('/upgrade');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <InstallWizard initialPhase={phase} />
    </div>
  );
}
