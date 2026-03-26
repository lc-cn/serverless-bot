const K_BOT = 'sb_onboarding_draft_bot_id';
const K_PLAT = 'sb_onboarding_draft_platform';

export function readOnboardingBotDraft(): { botId: string; platform: string } | null {
  if (typeof window === 'undefined') return null;
  const botId = window.localStorage.getItem(K_BOT)?.trim();
  const platform = window.localStorage.getItem(K_PLAT)?.trim();
  if (!botId || !platform) return null;
  return { botId, platform };
}

export function writeOnboardingBotDraft(botId: string, platform: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(K_BOT, botId);
  window.localStorage.setItem(K_PLAT, platform);
}

export function clearOnboardingBotDraft(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(K_BOT);
  window.localStorage.removeItem(K_PLAT);
}
