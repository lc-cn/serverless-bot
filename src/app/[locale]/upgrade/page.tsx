import { localizedRedirect } from '@/i18n/server-redirect';
import { db, isRelationalDatabaseConfigured } from '@/lib/data-layer';
import { getLatestAppliedMigration } from '@/lib/database/sql-migrate';
import { getInstallPhase } from '@/lib/install/install-state';
import { UpgradeWizard } from './upgrade-wizard';

export default async function UpgradePage() {
  const phase = await getInstallPhase();
  if (phase === 'installed') {
    await localizedRedirect('/dashboard');
  }
  if (phase === 'no_database' || phase === 'needs_install') {
    await localizedRedirect('/install');
  }

  let initialLastAppliedMigration: string | null = null;
  if (isRelationalDatabaseConfigured()) {
    try {
      initialLastAppliedMigration = await getLatestAppliedMigration(db);
    } catch {
      initialLastAppliedMigration = null;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <UpgradeWizard initialLastAppliedMigration={initialLastAppliedMigration} />
    </div>
  );
}
