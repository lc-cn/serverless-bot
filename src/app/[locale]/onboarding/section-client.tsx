'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { SYSTEM_ROLES } from '@/types/auth';
import {
  getOnboardingSection,
  type OnboardingSectionId,
  userCanAccessOnboardingSection,
} from '@/lib/onboarding/onboarding-registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateId } from '@/lib/shared/utils';
import {
  clearOnboardingBotDraft,
  readOnboardingBotDraft,
  writeOnboardingBotDraft,
} from '@/components/onboarding/onboarding-draft';
import type { FormField, FormUISchema } from '@/core';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type OnboardingAdapterRow = {
  platform: string;
  name: string;
  icon?: string;
  configured: boolean;
  botConfigSchema: FormUISchema;
};

function emptyConfigFromFields(fields: FormField[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined && f.defaultValue !== null) {
      o[f.name] = String(f.defaultValue);
    } else if (f.type === 'checkbox') {
      o[f.name] = 'false';
    } else if (f.type === 'select' && f.options?.[0]) {
      o[f.name] = String(f.options[0].value);
    } else {
      o[f.name] = '';
    }
  }
  return o;
}

function buildBotConfigPayload(fields: FormField[], raw: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = raw[f.name];
    const t = typeof v === 'string' ? v.trim() : '';
    if (f.type === 'checkbox') {
      out[f.name] = v === 'true';
    } else if (f.type === 'number') {
      if (t === '') continue;
      out[f.name] = Number(t);
    } else {
      out[f.name] = typeof v === 'string' ? v : '';
    }
  }
  return out;
}

function perm(permissions: string[], id: string) {
  return permissions.includes(id);
}

export function OnboardingSectionClient({
  sectionId,
  permissions,
}: {
  sectionId: OnboardingSectionId;
  permissions: string[];
}) {
  const router = useRouter();
  const ts = useTranslations('Onboarding.sections');
  const tc = useTranslations('Onboarding.sectionClient');
  const te = useTranslations('Onboarding.sectionClient.errors');
  const ta = useTranslations('Onboarding.sectionClient.api');

  const def = getOnboardingSection(sectionId);
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [botPlatform, setBotPlatform] = useState('');
  const [botName, setBotName] = useState('');
  const [adapterRows, setAdapterRows] = useState<OnboardingAdapterRow[]>([]);
  const [botFormConfig, setBotFormConfig] = useState<Record<string, string>>({});
  const [modelId, setModelId] = useState('');
  const [models, setModels] = useState<{ id: string; displayName?: string; modelId?: string }[]>([]);
  const [autoTab, setAutoTab] = useState(0);

  useEffect(() => {
    setRoleName(tc('defaults.roleName'));
    setBotName(tc('defaults.botName'));
  }, [tc]);

  const sectionTitle = ts(`${sectionId}.title` as 'overview.title');
  const sectionDescription = ts(`${sectionId}.description` as 'overview.description');

  useEffect(() => {
    if (!def) return;
    setAllowed(userCanAccessOnboardingSection(def, permissions));
  }, [def, permissions]);

  useEffect(() => {
    void (async () => {
      const ra = await fetch('/api/adapters');
      if (ra.ok) {
        const d = (await ra.json()) as { adapters?: OnboardingAdapterRow[] };
        const rows = (d.adapters ?? []).map((a) => ({
          platform: a.platform,
          name: a.name,
          icon: a.icon,
          configured: !!a.configured,
          botConfigSchema: a.botConfigSchema ?? { fields: [] },
        }));
        setAdapterRows(rows);
        if (rows[0]?.platform) {
          setBotPlatform((p) => p || rows[0]!.platform);
        }
      }
      if (perm(permissions, 'agents:read')) {
        const rm = await fetch('/api/llm/vendor-models');
        if (rm.ok) {
          const d = await rm.json();
          const list = Array.isArray(d.models) ? d.models : [];
          setModels(list);
          if (list[0]?.id) setModelId(String(list[0].id));
        }
      }
    })();
  }, [permissions]);

  useEffect(() => {
    if (!botPlatform || adapterRows.length === 0) return;
    const row = adapterRows.find((a) => a.platform === botPlatform);
    if (!row) return;
    const fields = row.botConfigSchema?.fields ?? [];
    setBotFormConfig(emptyConfigFromFields(fields));
  }, [botPlatform, adapterRows]);

  const patchSection = useCallback(
    async (action: 'complete' | 'skip') => {
      setBusy(true);
      setErr(null);
      try {
        const r = await fetch('/api/onboarding/progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionId, action }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          setErr((d as { error?: string }).error || te('patchProgress'));
          return;
        }
        router.push('/onboarding');
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [router, sectionId, te],
  );

  const scopeForDraft = () => {
    const d = readOnboardingBotDraft();
    if (!d) return undefined;
    return {
      adapter: {
        allowPlatforms: [d.platform],
        allowBotIds: [d.botId],
      },
    };
  };

  const createRole = async () => {
    if (!perm(permissions, 'roles:create')) {
      setErr(te('noRolesCreate'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleName.trim() || tc('defaults.roleName'),
          description: tc('roleDescription'),
          permissions: [...SYSTEM_ROLES.OPERATOR.permissions],
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr((d as { error?: string }).error || te('genericFail'));
        return;
      }
      await patchSection('complete');
    } finally {
      setBusy(false);
    }
  };

  const createBot = async () => {
    if (!perm(permissions, 'bots:create')) {
      setErr(te('noBotsCreate'));
      return;
    }
    const p = botPlatform.trim();
    if (!p) {
      setErr(te('platformRequired'));
      return;
    }
    const row = adapterRows.find((a) => a.platform === p);
    if (!row) {
      setErr(te('unknownAdapter'));
      return;
    }
    const fields = row.botConfigSchema?.fields ?? [];
    for (const f of fields) {
      if (!f.required) continue;
      const raw = botFormConfig[f.name];
      if (f.type === 'checkbox') {
        if (raw !== 'true') {
          setErr(te('botFieldRequired', { label: f.label }));
          return;
        }
      } else if (!String(raw ?? '').trim()) {
        setErr(te('botFieldRequired', { label: f.label }));
        return;
      }
    }
    const config = buildBotConfigPayload(fields, botFormConfig);
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/adapters/${encodeURIComponent(p)}/bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: botName.trim() || tc('defaults.botFallbackName'),
          config,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr((d as { error?: string }).error || te('genericFail'));
        return;
      }
      const bid = (d as { bot?: { id?: string } }).bot?.id;
      if (bid) writeOnboardingBotDraft(bid, p);
      await patchSection('complete');
    } finally {
      setBusy(false);
    }
  };

  const createJobFlow = async () => {
    if (!perm(permissions, 'flows:create')) {
      setErr(te('noFlowsCreate'));
      return;
    }
    const draft = readOnboardingBotDraft();
    if (!draft) {
      setErr(te('needBotDraft'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const stepId = generateId();
      const jr = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ta('jobName'),
          description: ta('jobDescription'),
          enabled: true,
          steps: [
            {
              id: stepId,
              type: 'log',
              name: ta('stepLogName'),
              config: { level: 'info', message: ta('stepLogMessage') },
              order: 0,
            },
          ],
        }),
      });
      const jd = await jr.json();
      if (!jr.ok) {
        setErr((jd as { error?: string }).error || te('createJobFailed'));
        return;
      }
      const jobId = (jd as { job?: { id: string } }).job?.id as string;
      const tr = await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ta('triggerJobName'),
          eventType: 'message',
          match: { type: 'always', pattern: '' },
          permission: {
            allowRoles: ['normal', 'admin', 'owner'],
            allowEnvironments: ['private', 'group'],
          },
          scope: scopeForDraft(),
        }),
      });
      const td = await tr.json();
      if (!tr.ok) {
        setErr((td as { error?: string }).error || te('triggerFailed'));
        return;
      }
      const triggerId = (td as { trigger?: { id: string } }).trigger?.id as string;
      const fr = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ta('flowJobName'),
          eventType: 'message',
          enabled: true,
          priority: 10,
          triggerIds: [triggerId],
          targetKind: 'job',
          jobIds: [jobId],
        }),
      });
      const fd = await fr.json();
      if (!fr.ok) {
        setErr((fd as { error?: string }).error || te('flowFailed'));
        return;
      }
      setErr(null);
    } finally {
      setBusy(false);
    }
  };

  const createAgentFlow = async () => {
    if (!perm(permissions, 'agents:manage') || !perm(permissions, 'flows:create')) {
      setErr(te('needAgentAndFlowPerms'));
      return;
    }
    const draft = readOnboardingBotDraft();
    if (!draft) {
      setErr(te('needBotDraftShort'));
      return;
    }
    if (!modelId.trim()) {
      setErr(te('selectPresetModel'));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const ar = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ta('agentName'),
          configuredModelId: modelId.trim(),
          presetSystemPrompt: ta('agentPrompt'),
        }),
      });
      const ad = await ar.json();
      if (!ar.ok) {
        setErr((ad as { error?: string }).error || te('agentFailed'));
        return;
      }
      const agentId = (ad as { agent?: { id: string } }).agent?.id as string;
      const tr = await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ta('triggerAgentName'),
          eventType: 'message',
          match: { type: 'contains', pattern: 'onboarding-ai', ignoreCase: true },
          permission: {
            allowRoles: ['normal', 'admin', 'owner'],
            allowEnvironments: ['private', 'group'],
          },
          scope: scopeForDraft(),
        }),
      });
      const td = await tr.json();
      if (!tr.ok) {
        setErr((td as { error?: string }).error || te('triggerFailed'));
        return;
      }
      const triggerId = (td as { trigger?: { id: string } }).trigger?.id as string;
      const fr = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ta('flowAgentName'),
          eventType: 'message',
          enabled: true,
          priority: 20,
          triggerIds: [triggerId],
          targetKind: 'agent',
          llmAgentId: agentId,
          jobIds: [],
        }),
      });
      const fd = await fr.json();
      if (!fr.ok) {
        setErr((fd as { error?: string }).error || te('flowFailed'));
        return;
      }
      setErr(null);
    } finally {
      setBusy(false);
    }
  };

  if (!def) return null;

  const card = (suffix: string) => tc(`${sectionId}.${suffix}` as 'overview.cardTitle');

  if (!allowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{sectionTitle}</CardTitle>
          <CardDescription>{tc('deniedDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/onboarding" className="text-sm text-primary underline">
            {tc('backHub')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const foot = (
    <div className="flex flex-wrap gap-2 pt-4 border-t">
      <Button type="button" variant="default" disabled={busy} onClick={() => void patchSection('complete')}>
        {tc('markComplete')}
      </Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void patchSection('skip')}>
        {tc('skipSection')}
      </Button>
      <Link
        href="/onboarding"
        className="inline-flex h-9 items-center px-3 text-sm text-muted-foreground hover:text-foreground"
      >
        {tc('backHub')}
      </Link>
    </div>
  );

  const autoTabLabels = [
    tc('automation.tabTrigger'),
    tc('automation.tabFlow'),
    tc('automation.tabJob'),
    tc('automation.tabSchedule'),
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/onboarding" className="text-sm text-muted-foreground hover:text-foreground">
          {tc('backHubArrow')}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{sectionTitle}</h1>
        <p className="text-muted-foreground text-sm mt-1">{sectionDescription}</p>
      </div>

      {err && <p className="text-sm text-destructive border border-destructive/30 rounded-md p-2">{err}</p>}

      {sectionId === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle>{card('cardTitle')}</CardTitle>
            <CardDescription>{card('cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{card('hint')}</p>
            {foot}
          </CardContent>
        </Card>
      )}

      {sectionId === 'bot_access' && (
        <Card>
          <CardHeader>
            <CardTitle>{card('cardTitle')}</CardTitle>
            <CardDescription>{card('cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Link href="/adapter" className="text-sm underline text-primary">
                {card('openAdapter')}
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/chat" className="text-sm underline text-primary">
                {card('sandboxChat')}
              </Link>
            </div>
            {perm(permissions, 'bots:create') ? (
              <>
                {adapterRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{card('noAdaptersHint')}</p>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="onb-adapter">{card('labelAdapter')}</Label>
                    <Select value={botPlatform || undefined} onValueChange={setBotPlatform}>
                      <SelectTrigger id="onb-adapter" className="font-mono text-sm">
                        <SelectValue placeholder={card('chooseAdapter')} />
                      </SelectTrigger>
                      <SelectContent>
                        {adapterRows.map((row) => (
                          <SelectItem key={row.platform} value={row.platform}>
                            <span className="inline-flex items-center gap-2">
                              {row.icon ? <span aria-hidden>{row.icon}</span> : null}
                              <span>{row.name}</span>
                              <span className="text-muted-foreground">({row.platform})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(() => {
                  const sel = adapterRows.find((a) => a.platform === botPlatform);
                  if (!sel || adapterRows.length === 0) return null;
                  return !sel.configured ? (
                    <p className="text-xs text-muted-foreground">{card('adapterNotConfiguredHint')}</p>
                  ) : null;
                })()}
                <div className="space-y-2">
                  <Label htmlFor="onb-bot-name">{card('labelBotName')}</Label>
                  <Input
                    id="onb-bot-name"
                    placeholder={card('placeholderDisplayName')}
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                  />
                </div>
                {(() => {
                  const sel = adapterRows.find((a) => a.platform === botPlatform);
                  const fields = sel?.botConfigSchema?.fields ?? [];
                  return fields.map((field: FormField) => (
                    <div key={field.name} className="space-y-2">
                      {field.type === 'checkbox' ? (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            id={`onb-field-${field.name}`}
                            type="checkbox"
                            className="size-4 rounded border border-input"
                            checked={botFormConfig[field.name] === 'true'}
                            onChange={(e) =>
                              setBotFormConfig((prev) => ({
                                ...prev,
                                [field.name]: e.target.checked ? 'true' : 'false',
                              }))
                            }
                          />
                          <Label htmlFor={`onb-field-${field.name}`} className="font-normal leading-snug">
                            {field.label}
                            {field.required ? <span className="text-destructive"> *</span> : null}
                          </Label>
                        </div>
                      ) : (
                        <>
                          <Label htmlFor={`onb-field-${field.name}`} className="leading-snug">
                            {field.label}
                            {field.required ? <span className="text-destructive"> *</span> : null}
                          </Label>
                          {field.description ? (
                            <p className="text-xs text-muted-foreground">{field.description}</p>
                          ) : null}
                          {field.type === 'textarea' ? (
                            <textarea
                              id={`onb-field-${field.name}`}
                              className="flex min-h-[88px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              value={botFormConfig[field.name] ?? ''}
                              onChange={(e) =>
                                setBotFormConfig((prev) => ({ ...prev, [field.name]: e.target.value }))
                              }
                              placeholder={field.placeholder}
                              autoComplete="off"
                            />
                          ) : field.type === 'select' && field.options?.length ? (
                            <Select
                              value={botFormConfig[field.name] || undefined}
                              onValueChange={(v) =>
                                setBotFormConfig((prev) => ({ ...prev, [field.name]: v }))
                              }
                            >
                              <SelectTrigger id={`onb-field-${field.name}`}>
                                <SelectValue placeholder={field.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options.map((opt) => (
                                  <SelectItem key={String(opt.value)} value={String(opt.value)}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={`onb-field-${field.name}`}
                              type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
                              value={botFormConfig[field.name] ?? ''}
                              onChange={(e) =>
                                setBotFormConfig((prev) => ({ ...prev, [field.name]: e.target.value }))
                              }
                              placeholder={field.placeholder}
                              autoComplete="off"
                            />
                          )}
                        </>
                      )}
                    </div>
                  ));
                })()}
                <Button
                  type="button"
                  disabled={busy || adapterRows.length === 0 || !botPlatform}
                  onClick={() => void createBot()}
                >
                  {card('createBotCta')}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {card('draftHint')}
                  <button type="button" className="underline ml-1" onClick={() => clearOnboardingBotDraft()}>
                    {card('clearDraft')}
                  </button>
                </p>
              </>
            ) : null}
            {foot}
          </CardContent>
        </Card>
      )}

      {sectionId === 'automation' && (
        <Card>
          <CardHeader>
            <CardTitle>{card('cardTitle')}</CardTitle>
            <CardDescription>{card('cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1 border-b pb-2">
              {autoTabLabels.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={`px-3 py-1 text-xs rounded-md ${
                    autoTab === i ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                  onClick={() => setAutoTab(i)}
                >
                  {label}
                </button>
              ))}
            </div>
            {autoTab === 0 && (
              <div className="text-sm space-y-2">
                <p>{tc('automation.triggerIntro')}</p>
                <Link href="/trigger" className="text-primary underline">
                  {tc('automation.openTrigger')}
                </Link>
              </div>
            )}
            {autoTab === 1 && (
              <div className="text-sm space-y-2">
                <p>{tc('automation.flowIntro')}</p>
                <Link href="/flow" className="text-primary underline">
                  {tc('automation.openFlow')}
                </Link>
              </div>
            )}
            {autoTab === 2 && (
              <div className="text-sm space-y-2">
                <p>{tc('automation.jobIntro')}</p>
                <Link href="/job" className="text-primary underline">
                  {tc('automation.openJob')}
                </Link>
                {perm(permissions, 'flows:create') && (
                  <div className="pt-2">
                    <Button type="button" size="sm" disabled={busy} onClick={() => void createJobFlow()}>
                      {tc('automation.oneClickSample')}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {autoTab === 3 && (
              <div className="text-sm space-y-2">
                <p>{tc('automation.scheduleIntro')}</p>
                <Link href="/schedule" className="text-primary underline">
                  {tc('automation.openSchedule')}
                </Link>
              </div>
            )}
            {foot}
          </CardContent>
        </Card>
      )}

      {sectionId === 'step_ref' && (
        <Card>
          <CardHeader>
            <CardTitle>{card('cardTitle')}</CardTitle>
            <CardDescription>{card('cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/step" className="text-primary underline text-sm">
              {card('openStepDoc')}
            </Link>
            {foot}
          </CardContent>
        </Card>
      )}

      {sectionId === 'llm_runtime' && (
        <Card>
          <CardHeader>
            <CardTitle>{card('cardTitle')}</CardTitle>
            <CardDescription>{card('cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/llm/vendors" className="text-primary underline">
                {card('linkVendors')}
              </Link>
              <Link href="/agents" className="text-primary underline">
                {card('linkAgents')}
              </Link>
            </div>
            {perm(permissions, 'agents:manage') && models.length > 0 && (
              <>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m.displayName || m.modelId || m.id).toString()}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" disabled={busy} onClick={() => void createAgentFlow()}>
                  {card('oneClickAgentFlow')}
                </Button>
              </>
            )}
            {foot}
          </CardContent>
        </Card>
      )}

      {sectionId === 'llm_assets' && (
        <Card>
          <CardHeader>
            <CardTitle>{card('cardTitle')}</CardTitle>
            <CardDescription>{card('cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/llm/skills" className="block text-primary underline">
              Skills
            </Link>
            <Link href="/llm/tools" className="block text-primary underline">
              Tools
            </Link>
            <Link href="/llm/mcp" className="block text-primary underline">
              {card('linkMcp')}
            </Link>
            {foot}
          </CardContent>
        </Card>
      )}

      {sectionId === 'rbac' && (
        <Card>
          <CardHeader>
            <CardTitle>{card('cardTitle')}</CardTitle>
            <CardDescription>{card('cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 text-sm">
              <Link href="/users" className="text-primary underline">
                {card('linkUsers')}
              </Link>
              <Link href="/roles" className="text-primary underline">
                {card('linkRoles')}
              </Link>
            </div>
            {perm(permissions, 'roles:create') && (
              <>
                <Input
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder={card('placeholderRoleName')}
                />
                <Button type="button" disabled={busy} onClick={() => void createRole()}>
                  {card('createSampleRole')}
                </Button>
              </>
            )}
            {foot}
          </CardContent>
        </Card>
      )}

      {sectionId === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>{card('cardTitle')}</CardTitle>
            <CardDescription>{card('cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/profile" className="text-primary underline text-sm">
              {card('openProfile')}
            </Link>
            {foot}
          </CardContent>
        </Card>
      )}

      {sectionId === 'platform_ext' && (
        <Card>
          <CardHeader>
            <CardTitle>{card('cardTitle')}</CardTitle>
            <CardDescription>{card('cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/discord/commands" className="block text-primary underline">
              {card('linkDiscord')}
            </Link>
            <Link href="/qq/settings" className="block text-primary underline">
              {card('linkQq')}
            </Link>
            {foot}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
