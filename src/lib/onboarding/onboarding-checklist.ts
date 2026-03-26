import { storage } from '@/lib/persistence';

export type OnboardingChecklist = {
  customRole: boolean;
  myBot: boolean;
  jobFlow: boolean;
  agentFlow: boolean;
  scheduledTask: boolean;
};

export async function computeOnboardingChecklist(userId: string): Promise<OnboardingChecklist> {
  const [roles, bots, flows, tasks] = await Promise.all([
    storage.getRoles(),
    storage.getBots(userId),
    storage.listFlowsForUser(userId, null),
    storage.listScheduledTasksForUser(userId),
  ]);

  const customRole = roles.some((r) => !r.isSystem);
  const myBot = bots.length > 0;
  const jobFlow = flows.some(
    (f) =>
      (f.targetKind ?? 'job') === 'job' && Array.isArray(f.jobIds) && f.jobIds.length > 0,
  );
  const agentFlow = flows.some((f) => f.targetKind === 'agent' && !!f.llmAgentId);
  const scheduledTask = tasks.length > 0;

  return { customRole, myBot, jobFlow, agentFlow, scheduledTask };
}
