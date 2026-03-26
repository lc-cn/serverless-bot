export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironmentOrWarn } = await import('@/lib/runtime/env-validation');
    validateEnvironmentOrWarn();
  }
}
