'use client';

import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import type { LlmMcpServer, LlmSkill, LlmTool, LlmVendorModel } from '@/types';
import { LLM_AGENT_SYS_VAR_PATHS } from '@/lib/llm/agent-prompt-sys';
import {
  DEFAULT_MEMORY_WINDOW_TURNS,
  mergeAgentFormExtraJson,
  type AgentMemoryModeUi,
  type SkillInjectUi,
} from '@/lib/llm/agent-form-extra';

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export default function NewAgentPage() {
  const t = useTranslations('AgentFormPage');
  const tUi = useTranslations('Ui');
  const router = useRouter();
  const [catalogSkills, setCatalogSkills] = useState<LlmSkill[]>([]);
  const [catalogTools, setCatalogTools] = useState<LlmTool[]>([]);
  const [catalogMcpServers, setCatalogMcpServers] = useState<LlmMcpServer[]>([]);
  const [catalogModels, setCatalogModels] = useState<LlmVendorModel[]>([]);
  const [configuredModelId, setConfiguredModelId] = useState('');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [mcpServerIds, setMcpServerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    presetSystemPrompt: '',
    extraJson: '',
    skillInject: 'summary' as SkillInjectUi,
    memoryMode: 'sliding_window' as AgentMemoryModeUi,
    memoryWindowTurns: DEFAULT_MEMORY_WINDOW_TURNS,
  });

  const link =
    (href: string) =>
    (chunks: ReactNode) =>
      (
        <Link href={href} className="text-primary underline">
          {chunks}
        </Link>
      );

  useEffect(() => {
    (async () => {
      const [rs, rt, rmcp, rmod] = await Promise.all([
        fetch('/api/llm/skills'),
        fetch('/api/llm/tools'),
        fetch('/api/llm/mcp-servers'),
        fetch('/api/llm/vendor-models'),
      ]);
      if (rs.ok) {
        const d = await rs.json();
        setCatalogSkills(d.skills || []);
      }
      if (rt.ok) {
        const d = await rt.json();
        setCatalogTools(d.tools || []);
      }
      if (rmcp.ok) {
        const d = await rmcp.json();
        setCatalogMcpServers(d.servers || []);
      }
      if (rmod.ok) {
        const d = await rmod.json();
        const list = d.models || [];
        setCatalogModels(list);
        if (list[0]?.id) setConfiguredModelId(list[0].id);
      }
    })();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!configuredModelId) {
      alert(t('alertSelectModel'));
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          configuredModelId,
          presetSystemPrompt: form.presetSystemPrompt || undefined,
          skillIds,
          toolIds,
          mcpServerIds,
          extraJson: mergeAgentFormExtraJson(form.extraJson, {
            skillInject: form.skillInject,
            memoryMode: form.memoryMode,
            memoryWindowTurns: form.memoryWindowTurns,
          }),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || tUi('createFailed'));
        return;
      }
      router.push(`/agents/${encodeURIComponent(d.agent.id)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link href="/agents" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" />
        {tUi('backToList')}
      </Link>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('titleNew')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <div className="text-sm font-medium">{t('presetSectionTitle')}</div>
              <p className="text-xs text-muted-foreground">{t('presetHintNew')}</p>
              {catalogModels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.rich('emptyModelsNew', { link: link('/llm/vendors') })}
                </p>
              ) : (
                <>
                  <label className="text-sm font-medium">{t('labelSelectModel')}</label>
                  <Select value={configuredModelId} onValueChange={setConfiguredModelId}>
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder={t('placeholderSelectModel')} />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {(m.profileName || '') + ' / ' + (m.displayName || m.modelId)} ({m.modelId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">{t('labelName')}</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder={t('placeholderNameExample')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('labelSystemPrompt')}</label>
              <Textarea
                value={form.presetSystemPrompt}
                onChange={(e) => setForm({ ...form, presetSystemPrompt: e.target.value })}
                rows={4}
                placeholder={t('placeholderSystemPrompt')}
              />
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer text-primary hover:underline">{t('sysVarsSummaryNew')}</summary>
                <ul className="mt-2 space-y-1 list-disc pl-4 font-mono text-[11px]">
                  {LLM_AGENT_SYS_VAR_PATHS.map((path) => {
                    const key = path.replace(/^sys\./, '');
                    return (
                      <li key={path}>
                        <span className="text-foreground">{`${'${'}${path}${'}'}`}</span> —{' '}
                        {t(`sysVarHelp.${key}` as 'sysVarHelp.nowIso')}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2">
                  {t.rich('promptExtrasNew', {
                    msgVar: () => (
                      <code className="bg-muted px-0.5 rounded">{t('syntaxMsgVar')}</code>
                    ),
                    expr: () => (
                      <code className="bg-muted px-0.5 rounded">{t('syntaxExpr')}</code>
                    ),
                  })}
                </p>
              </details>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-sm font-medium">{t('sectionSkills')}</div>
              <p className="text-xs text-muted-foreground">{t('skillsHintNew')}</p>
              {catalogSkills.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.rich('emptySkills', { link: link('/llm/skills') })}
                </p>
              ) : (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {catalogSkills.map((s) => (
                    <li key={s.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id={`sk-${s.id}`}
                        className="mt-1"
                        checked={skillIds.includes(s.id)}
                        onChange={() => setSkillIds((prev) => toggleId(prev, s.id))}
                      />
                      <label htmlFor={`sk-${s.id}`} className="text-sm cursor-pointer">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground font-mono text-xs ml-2">{s.id}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">{t('labelSkillInject')}</label>
              <Select
                value={form.skillInject}
                onValueChange={(v) => setForm({ ...form, skillInject: v as SkillInjectUi })}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">{t('injectSummaryNew')}</SelectItem>
                  <SelectItem value="full">{t('injectFullNew')}</SelectItem>
                  <SelectItem value="none">{t('injectNoneNew')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{t('injectFootnoteNew')}</p>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-sm font-medium">{t('sectionMemory')}</div>
              <p className="text-xs text-muted-foreground">{t('memoryHintNew')}</p>
              <div>
                <label className="text-sm font-medium">{t('labelMemoryMode')}</label>
                <Select
                  value={form.memoryMode}
                  onValueChange={(v) => setForm({ ...form, memoryMode: v as AgentMemoryModeUi })}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sliding_window">{t('memoryModeSliding')}</SelectItem>
                    <SelectItem value="none">{t('memoryModeNone')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.memoryMode === 'sliding_window' ? (
                <div>
                  <label className="text-sm font-medium">{t('labelMemoryWindowTurns')}</label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    className="mt-1"
                    value={form.memoryWindowTurns}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setForm({
                        ...form,
                        memoryWindowTurns: Number.isFinite(n) ? n : form.memoryWindowTurns,
                      });
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('memoryWindowFootnote')}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-sm font-medium">{t('sectionTools')}</div>
              <p className="text-xs text-muted-foreground">{t('toolsHintNew')}</p>
              {catalogTools.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.rich('emptyTools', { link: link('/llm/tools') })}
                </p>
              ) : (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {catalogTools.map((tool) => (
                    <li key={tool.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id={`tl-${tool.id}`}
                        className="mt-1"
                        checked={toolIds.includes(tool.id)}
                        onChange={() => setToolIds((prev) => toggleId(prev, tool.id))}
                      />
                      <label htmlFor={`tl-${tool.id}`} className="text-sm cursor-pointer">
                        <span className="font-medium">{tool.name}</span>
                        <span className="text-muted-foreground font-mono text-xs ml-2">{tool.id}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-sm font-medium">{t('sectionMcp')}</div>
              <p className="text-xs text-muted-foreground">{t('mcpHintNew')}</p>
              {catalogMcpServers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.rich('emptyMcp', { link: link('/llm/mcp') })}
                </p>
              ) : (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {catalogMcpServers.map((m) => (
                    <li key={m.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id={`mcp-${m.id}`}
                        className="mt-1"
                        checked={mcpServerIds.includes(m.id)}
                        onChange={() => setMcpServerIds((prev) => toggleId(prev, m.id))}
                      />
                      <label htmlFor={`mcp-${m.id}`} className="text-sm cursor-pointer">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground font-mono text-xs ml-2">{m.id}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">{t('labelExtraOptional')}</label>
              <Textarea
                value={form.extraJson}
                onChange={(e) => setForm({ ...form, extraJson: e.target.value })}
                rows={2}
                placeholder={t('placeholderExtraExample')}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? tUi('saving') : t('submitCreate')}
              </Button>
              <Link href="/agents">
                <Button type="button" variant="outline">
                  {tUi('cancel')}
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
