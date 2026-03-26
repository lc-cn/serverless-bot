import type { User } from '@/types/auth';

/**
 * 仅依据「枢纽入门」`onboarding_completed_at`：与分板块进度 `onboarding_sections_json` 无关。
 * 具备搭建类权限且枢纽未毕业时，首访控制台进 `/onboarding`；各业务路由不因单板块未完成而拦截。
 */
export function shouldRedirectToOnboarding(
  user: Pick<User, 'onboardingCompletedAt'> | null,
  permissions: string[],
): boolean {
  if (!user || user.onboardingCompletedAt != null) return false;
  const p = permissions || [];
  return (
    p.includes('roles:create') ||
    p.includes('bots:create') ||
    p.includes('flows:create') ||
    p.includes('agents:manage')
  );
}
