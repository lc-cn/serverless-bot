'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import { ArrowLeft, Plus, Trash2, Edit, Zap } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Trigger, MatchType, UserRole, FlowEventType } from '@/types';
import { splitIdList } from '@/lib/trigger/trigger-scope';
import {
  DEFAULT_PLATFORM_PRESETS,
  TRIGGER_SUBTYPE_OPTIONS,
  type ScopeListMode,
  listModeFromPermission,
  platformScopeModeFromScope,
} from '@/lib/trigger/trigger-ui-presets';

interface TriggerListClientProps {
  eventType: FlowEventType;
  title: string;
  description: string;
  initialTriggers: Trigger[];
}

type BotRow = { platform: string; id: string; name: string };

type TriggerAdapter = NonNullable<Trigger['scope']>['adapter'];
type TriggerEvent = NonNullable<Trigger['scope']>['event'];

/** 合并 scope.adapter / scope.event，去掉空分支 */
function buildScope(adapter?: TriggerAdapter, evt?: TriggerEvent): Trigger['scope'] | undefined {
  const a =
    adapter && Object.values(adapter).some((v) => Array.isArray(v) && v.length > 0)
      ? adapter
      : undefined;
  const e =
    evt && Object.values(evt).some((v) => Array.isArray(v) && v.length > 0) ? evt : undefined;
  if (!a && !e) return undefined;
  return {
    ...(a ? { adapter: a } : {}),
    ...(e ? { event: e } : {}),
  };
}

export function TriggerListClient({
  eventType,
  title,
  description,
  initialTriggers,
}: TriggerListClientProps) {
  const ui = useTranslations('Ui');
  const te = useTranslations('Dashboard.triggerEditor');
  const tsub = useTranslations('Dashboard.triggerEditor.subtypes');
  const locale = useLocale();
  const router = useRouter();
  const eventLabel = useMemo(() => {
    if (eventType === 'message') return te('eventMessage');
    if (eventType === 'request') return te('eventRequest');
    return te('eventNotice');
  }, [eventType, te]);
  const [triggers, setTriggers] = useState<Trigger[]>(initialTriggers);
  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null);

  const [pickerPlatforms, setPickerPlatforms] = useState<string[]>([]);
  const [botRows, setBotRows] = useState<BotRow[]>([]);
  /** 不在仪表盘中的 platform，逗号分隔补充进多选列表 */
  const [extraPlatformsRaw, setExtraPlatformsRaw] = useState('');
  /** 不在列表中的机器人 ID，与勾选合并写入 allow/denyBotIds */
  const [extraBotIdsRaw, setExtraBotIdsRaw] = useState('');

  /** 与 permission 数组解耦：空列表时仍保持「仅允许/排除」，否则会误判为「不限制」并隐藏输入框 */
  const [senderUserMode, setSenderUserMode] = useState<ScopeListMode>('all');
  const [senderGroupMode, setSenderGroupMode] = useState<ScopeListMode>('all');

  /** 与 scope.adapter 解耦：未勾选任何平台/机器人时，下拉仍应保持「仅所选/排除」以显示勾选区 */
  const [adapterPlatformMode, setAdapterPlatformMode] = useState<ScopeListMode>('all');
  const [adapterBotMode, setAdapterBotMode] = useState<ScopeListMode>('all');

  const [formData, setFormData] = useState<Partial<Trigger>>({
    name: '',
    description: '',
    enabled: true,
    eventType,
    match: {
      type: 'always',
      pattern: '',
    },
    permission: {
      allowRoles: ['normal', 'admin', 'owner'],
      allowEnvironments: ['private', 'group'],
    },
  });

  const overlayOpen = showCreateOverlay || showEditOverlay;
  const hydratedBotManualRef = useRef(false);

  useEffect(() => {
    if (!overlayOpen) hydratedBotManualRef.current = false;
  }, [overlayOpen]);

  /** 编辑时把「未出现在机器人列表里」的 ID 填进手填框（botRows 异步加载后跑一次即可） */
  useEffect(() => {
    if (!showEditOverlay || !selectedTrigger || hydratedBotManualRef.current) return;
    const ad = selectedTrigger.scope?.adapter;
    const m = platformScopeModeFromScope(ad?.allowBotIds, ad?.denyBotIds);
    if (m === 'all') {
      hydratedBotManualRef.current = true;
      return;
    }
    const ids = m === 'allow' ? ad?.allowBotIds ?? [] : ad?.denyBotIds ?? [];
    if (ids.length === 0) {
      hydratedBotManualRef.current = true;
      return;
    }
    const rowSet = new Set(botRows.map((b) => b.id));
    const manual = botRows.length === 0 ? ids : ids.filter((id) => !rowSet.has(id));
    if (manual.length) setExtraBotIdsRaw(manual.join(', '));
    hydratedBotManualRef.current = true;
  }, [showEditOverlay, selectedTrigger, botRows]);

  useEffect(() => {
    if (!overlayOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/adapters');
        const data = await res.json();
        const fromApi = (data.adapters ?? []).map((a: { platform: string }) => a.platform);
        const merged = [...new Set([...DEFAULT_PLATFORM_PRESETS, ...fromApi])].sort();
        if (!cancelled) setPickerPlatforms(merged);
      } catch {
        if (!cancelled) setPickerPlatforms([...DEFAULT_PLATFORM_PRESETS]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [overlayOpen]);

  useEffect(() => {
    if (!overlayOpen || pickerPlatforms.length === 0) return;
    let cancelled = false;
    (async () => {
      const rows: BotRow[] = [];
      await Promise.all(
        pickerPlatforms.map(async (platform) => {
          try {
            const r = await fetch(`/api/adapters/${encodeURIComponent(platform)}/bots`);
            if (!r.ok) return;
            const data = await r.json();
            for (const b of data.bots ?? []) {
              rows.push({ platform, id: String(b.id), name: String(b.name || b.id) });
            }
          } catch {
            /* 忽略 */
          }
        })
      );
      if (!cancelled) {
        rows.sort((a, b) => a.platform.localeCompare(b.platform) || a.id.localeCompare(b.id));
        setBotRows(rows);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [overlayOpen, pickerPlatforms]);

  const platformChoices = useMemo(() => {
    const extra = splitIdList(extraPlatformsRaw) ?? [];
    return [...new Set([...pickerPlatforms, ...extra])].sort();
  }, [pickerPlatforms, extraPlatformsRaw]);

  const subtypeOptions = TRIGGER_SUBTYPE_OPTIONS[eventType];
  const selectedSubTypes = new Set(formData.scope?.event?.allowSubTypes ?? []);

  const refreshTriggers = async () => {
    try {
      const res = await fetch(`/api/triggers?type=${eventType}`);
      const data = await res.json();
      setTriggers(data.triggers || []);
    } catch (error) {
      console.error('Failed to fetch triggers:', error);
    }
  };

  const handleCreate = async () => {
    try {
      const dtLocale = locale.startsWith('zh') ? 'zh-CN' : 'en-US';
      const name =
        String(formData.name || '').trim() ||
        te('defaultNamePrefix', {
          event: eventLabel,
          datetime: new Date().toLocaleString(dtLocale, {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      const res = await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          name,
          ...(formData.scope == null ? {} : { scope: formData.scope }),
        }),
      });

      if (res.ok) {
        setShowCreateOverlay(false);
        resetForm();
        setExtraPlatformsRaw('');
        refreshTriggers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to create trigger:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTrigger) return;

    try {
      const res = await fetch(`/api/triggers/${selectedTrigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          name: String(formData.name || '').trim() || selectedTrigger.name,
          scope: formData.scope ?? null,
        }),
      });

      if (res.ok) {
        setShowEditOverlay(false);
        setSelectedTrigger(null);
        resetForm();
        setExtraPlatformsRaw('');
        refreshTriggers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to update trigger:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedTrigger) return;

    try {
      const res = await fetch(`/api/triggers/${selectedTrigger.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setShowDeleteOverlay(false);
        setSelectedTrigger(null);
        refreshTriggers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to delete trigger:', error);
    }
  };

  const handleToggleEnabled = async (trigger: Trigger) => {
    try {
      const res = await fetch(`/api/triggers/${trigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !trigger.enabled }),
      });

      if (res.ok) {
        refreshTriggers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to toggle trigger:', error);
    }
  };

  const resetForm = () => {
    setSenderUserMode('all');
    setSenderGroupMode('all');
    setAdapterPlatformMode('all');
    setAdapterBotMode('all');
    setFormData({
      name: '',
      description: '',
      enabled: true,
      eventType,
      match: {
        type: 'always',
        pattern: '',
      },
      permission: {
        allowRoles: ['normal', 'admin', 'owner'],
        allowEnvironments: ['private', 'group'],
      },
      scope: undefined,
    });
    setExtraPlatformsRaw('');
    setExtraBotIdsRaw('');
  };

  const openEditOverlay = (trigger: Trigger) => {
    setSelectedTrigger(trigger);
    setFormData({
      name: trigger.name,
      description: trigger.description,
      enabled: trigger.enabled,
      eventType: trigger.eventType,
      match: trigger.match,
      permission: trigger.permission,
      scope: trigger.scope,
    });
    setExtraPlatformsRaw('');
    setExtraBotIdsRaw('');
    setSenderUserMode(listModeFromPermission(trigger.permission.allowUsers, trigger.permission.denyUsers));
    setSenderGroupMode(listModeFromPermission(trigger.permission.allowGroups, trigger.permission.denyGroups));
    const ad = trigger.scope?.adapter;
    setAdapterPlatformMode(platformScopeModeFromScope(ad?.allowPlatforms, ad?.denyPlatforms));
    setAdapterBotMode(platformScopeModeFromScope(ad?.allowBotIds, ad?.denyBotIds));
    setShowEditOverlay(true);
  };

  const selectedPlatforms =
    adapterPlatformMode === 'allow'
      ? formData.scope?.adapter?.allowPlatforms ?? []
      : adapterPlatformMode === 'deny'
        ? formData.scope?.adapter?.denyPlatforms ?? []
        : [];

  const setPlatformScopeMode = (mode: ScopeListMode) => {
    setAdapterPlatformMode(mode);
    const prevEvt = formData.scope?.event;
    const prevOther = formData.scope?.adapter
      ? {
          allowBotIds: formData.scope.adapter.allowBotIds,
          denyBotIds: formData.scope.adapter.denyBotIds,
        }
      : {};
    const prevMode = adapterPlatformMode;
    const carry =
      prevMode === 'allow'
        ? formData.scope?.adapter?.allowPlatforms ?? []
        : prevMode === 'deny'
          ? formData.scope?.adapter?.denyPlatforms ?? []
          : [];
    if (mode === 'all') {
      setFormData({
        ...formData,
        scope: buildScope(
          {
            ...prevOther,
          },
          prevEvt
        ),
      });
      return;
    }
    if (mode === 'allow') {
      setFormData({
        ...formData,
        scope: buildScope(
          {
            ...prevOther,
            allowPlatforms: carry.length ? carry : undefined,
          },
          prevEvt
        ),
      });
    } else {
      setFormData({
        ...formData,
        scope: buildScope(
          {
            ...prevOther,
            denyPlatforms: carry.length ? carry : undefined,
          },
          prevEvt
        ),
      });
    }
  };

  const togglePlatform = (p: string, checked: boolean) => {
    const set = new Set(selectedPlatforms);
    if (checked) set.add(p);
    else set.delete(p);
    const arr = [...set].sort();
    const prevEvt = formData.scope?.event;
    const prevBots = formData.scope?.adapter
      ? {
          allowBotIds: formData.scope.adapter.allowBotIds,
          denyBotIds: formData.scope.adapter.denyBotIds,
        }
      : {};
    if (adapterPlatformMode === 'allow') {
      setFormData({
        ...formData,
        scope: buildScope(
          {
            ...prevBots,
            allowPlatforms: arr.length ? arr : undefined,
          },
          prevEvt
        ),
      });
    } else if (adapterPlatformMode === 'deny') {
      setFormData({
        ...formData,
        scope: buildScope(
          {
            ...prevBots,
            denyPlatforms: arr.length ? arr : undefined,
          },
          prevEvt
        ),
      });
    }
  };

  const selectedBotIds =
    adapterBotMode === 'allow'
      ? formData.scope?.adapter?.allowBotIds ?? []
      : adapterBotMode === 'deny'
        ? formData.scope?.adapter?.denyBotIds ?? []
        : [];

  const setBotScopeMode = (mode: ScopeListMode) => {
    setAdapterBotMode(mode);
    const a = formData.scope?.adapter ?? {};
    const { allowPlatforms, denyPlatforms } = a;
    const evt = formData.scope?.event;
    const prevBotMode = adapterBotMode;
    const carry =
      prevBotMode === 'allow'
        ? formData.scope?.adapter?.allowBotIds ?? []
        : prevBotMode === 'deny'
          ? formData.scope?.adapter?.denyBotIds ?? []
          : [];
    if (mode === 'all') {
      setExtraBotIdsRaw('');
      setFormData({
        ...formData,
        scope: buildScope(
          {
            allowPlatforms,
            denyPlatforms,
          },
          evt
        ),
      });
      return;
    }
    if (mode === 'allow') {
      setFormData({
        ...formData,
        scope: buildScope(
          {
            allowPlatforms,
            denyPlatforms,
            allowBotIds: carry.length ? carry : undefined,
          },
          evt
        ),
      });
    } else {
      setFormData({
        ...formData,
        scope: buildScope(
          {
            allowPlatforms,
            denyPlatforms,
            denyBotIds: carry.length ? carry : undefined,
          },
          evt
        ),
      });
    }
  };

  const toggleBotId = (id: string, checked: boolean) => {
    const rowIdSet = new Set(botRows.map((b) => b.id));
    const set = new Set(selectedBotIds.filter((i) => rowIdSet.has(i)));
    if (checked) set.add(id);
    else set.delete(id);
    const fromList = [...set];
    const ex = splitIdList(extraBotIdsRaw) ?? [];
    const arr = [...new Set([...fromList, ...ex])];
    const a = formData.scope?.adapter ?? {};
    const { allowPlatforms, denyPlatforms } = a;
    const evt = formData.scope?.event;
    if (adapterBotMode === 'allow') {
      setFormData({
        ...formData,
        scope: buildScope(
          {
            allowPlatforms,
            denyPlatforms,
            allowBotIds: arr.length ? arr : undefined,
          },
          evt
        ),
      });
    } else if (adapterBotMode === 'deny') {
      setFormData({
        ...formData,
        scope: buildScope(
          {
            allowPlatforms,
            denyPlatforms,
            denyBotIds: arr.length ? arr : undefined,
          },
          evt
        ),
      });
    }
  };

  const toggleSubtype = (value: string, checked: boolean) => {
    const next = new Set(selectedSubTypes);
    if (checked) next.add(value);
    else next.delete(value);
    const arr = [...next];
    const adapter = formData.scope?.adapter;
    const evt = arr.length ? { allowSubTypes: arr } : undefined;
    setFormData({
      ...formData,
      scope: buildScope(adapter, evt),
    });
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/trigger">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {ui('back')}
          </Button>
        </Link>
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground mt-1">{description}</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowCreateOverlay(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {ui('overlayNewTrigger')}
          </Button>
        </div>
      </div>

      {triggers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{ui('emptyTriggers')}</p>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowCreateOverlay(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              {ui('createFirstTrigger')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {triggers.map((trigger) => (
            <Card key={trigger.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {trigger.name}
                      {!trigger.enabled && <Badge variant="secondary">{ui('disabledBadge')}</Badge>}
                    </CardTitle>
                    {trigger.description && (
                      <CardDescription className="mt-2">{trigger.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Switch
                      checked={trigger.enabled}
                      onChange={() => handleToggleEnabled(trigger)}
                    />
                    <Button variant="outline" size="sm" onClick={() => openEditOverlay(trigger)}>
                      <Edit className="w-4 h-4 mr-2" />
                      {ui('edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTrigger(trigger);
                        setShowDeleteOverlay(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {ui('delete')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">
                    {te('matchPrefix')}:{' '}
                    {trigger.match.type === 'always' ? ui('alwaysMatch') : trigger.match.type}
                  </Badge>
                  {trigger.match.pattern && (
                    <Badge variant="outline">
                      {te('rulePrefix')}: {trigger.match.pattern}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {te('envPrefix')}: {trigger.permission.allowEnvironments.join(', ')}
                  </Badge>
                  {(trigger.permission.allowUsers?.length ||
                    trigger.permission.denyUsers?.length ||
                    trigger.permission.allowGroups?.length ||
                    trigger.permission.denyGroups?.length) && (
                    <Badge variant="outline">{te('badgeSenderScope')}</Badge>
                  )}
                  {trigger.scope?.adapter &&
                    Object.values(trigger.scope.adapter).some((x) => Array.isArray(x) && x.length > 0) && (
                      <Badge variant="outline">{te('badgeAdapterScope')}</Badge>
                    )}
                  {trigger.scope?.event &&
                    Object.values(trigger.scope.event).some((x) => Array.isArray(x) && x.length > 0) && (
                      <Badge variant="outline">{te('badgeSubtypeScope')}</Badge>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Overlay
        isOpen={showCreateOverlay || showEditOverlay}
        onClose={() => {
          setShowCreateOverlay(false);
          setShowEditOverlay(false);
          setSelectedTrigger(null);
          resetForm();
        }}
        title={showCreateOverlay ? ui('overlayNewTrigger') : ui('overlayEditTrigger')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            showCreateOverlay ? handleCreate() : handleUpdate();
          }}
          className="space-y-5 max-h-[min(85vh,720px)] overflow-y-auto pr-1"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <label htmlFor="name" className="text-sm font-medium">
                {te('fieldName')}
              </label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={te('namePlaceholderAuto')}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={formData.enabled ?? true}
                onChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <span className="text-sm text-muted-foreground">{te('enabledLabel')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="matchType" className="text-sm font-medium">
              {te('matchHow')}
            </label>
            <Select
              value={formData.match?.type ?? 'always'}
              onValueChange={(v) =>
                setFormData({
                  ...formData,
                  match: { ...formData.match!, type: v as MatchType },
                })
              }
            >
              <SelectTrigger id="matchType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">{te('matchAlways')}</SelectItem>
                <SelectItem value="keyword">{te('matchKeyword')}</SelectItem>
                <SelectItem value="contains">{te('matchContains')}</SelectItem>
                <SelectItem value="prefix">{te('matchPrefixOpt')}</SelectItem>
                <SelectItem value="suffix">{te('matchSuffix')}</SelectItem>
                <SelectItem value="exact">{te('matchExact')}</SelectItem>
                <SelectItem value="regex">{te('matchRegex')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.match?.type !== 'always' && (
            <>
              <div className="space-y-2">
                <label htmlFor="pattern" className="text-sm font-medium">
                  {formData.match?.type === 'regex' ? te('patternRegex') : te('patternText')}
                </label>
                <Input
                  id="pattern"
                  value={formData.match?.pattern || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      match: { ...formData.match!, pattern: e.target.value },
                    })
                  }
                  placeholder={
                    formData.match?.type === 'regex'
                      ? te('placeholderRegex')
                      : te('placeholderKeyword')
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!formData.match?.ignoreCase}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      match: { ...formData.match!, ignoreCase: e.target.checked },
                    })
                  }
                />
                {te('ignoreCase')}
              </label>
            </>
          )}

          <div className="space-y-2">
            <span className="text-sm font-medium">{te('sessionScene')}</span>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.permission?.allowEnvironments.includes('private')}
                  onChange={(e) => {
                    const envs = formData.permission?.allowEnvironments || [];
                    const newEnvs = e.target.checked
                      ? [...envs, 'private']
                      : envs.filter((env) => env !== 'private');
                    setFormData({
                      ...formData,
                      permission: {
                        ...formData.permission!,
                        allowEnvironments: newEnvs as ('private' | 'group')[],
                      },
                    });
                  }}
                />
                {te('privateChat')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.permission?.allowEnvironments.includes('group')}
                  onChange={(e) => {
                    const envs = formData.permission?.allowEnvironments || [];
                    const newEnvs = e.target.checked
                      ? [...envs, 'group']
                      : envs.filter((env) => env !== 'group');
                    setFormData({
                      ...formData,
                      permission: {
                        ...formData.permission!,
                        allowEnvironments: newEnvs as ('private' | 'group')[],
                      },
                    });
                  }}
                />
                {te('groupChat')}
              </label>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
            <h3 className="text-sm font-medium">{te('adapterSectionTitle')}</h3>
            <p className="text-xs text-muted-foreground">{te('adapterSectionHint')}</p>
            <div className="space-y-2">
              <label className="text-xs font-medium">{te('platformScope')}</label>
              <Select
                value={adapterPlatformMode}
                onValueChange={(v) => setPlatformScopeMode(v as ScopeListMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{te('platformAll')}</SelectItem>
                  <SelectItem value="allow">{te('platformAllow')}</SelectItem>
                  <SelectItem value="deny">{te('platformDeny')}</SelectItem>
                </SelectContent>
              </Select>
              {adapterPlatformMode !== 'all' && (
                <>
                  <Input
                    className="text-xs"
                    placeholder={te('extraPlatformsPlaceholder')}
                    value={extraPlatformsRaw}
                    onChange={(e) => setExtraPlatformsRaw(e.target.value)}
                  />
                  <div className="max-h-28 overflow-y-auto rounded border p-2 space-y-1.5 bg-background">
                    {platformChoices.map((p) => (
                      <label key={p} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedPlatforms.includes(p)}
                          onChange={(e) => togglePlatform(p, e.target.checked)}
                        />
                        <span className="font-mono text-xs">{p}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">{te('botScope')}</label>
              <Select
                value={adapterBotMode}
                onValueChange={(v) => setBotScopeMode(v as ScopeListMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{te('botAll')}</SelectItem>
                  <SelectItem value="allow">{te('botAllow')}</SelectItem>
                  <SelectItem value="deny">{te('botDeny')}</SelectItem>
                </SelectContent>
              </Select>
              {adapterBotMode !== 'all' && (
                <>
                  <div className="max-h-36 overflow-y-auto rounded border p-2 space-y-1.5 bg-background">
                    {botRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">{te('botsEmptyHint')}</p>
                    ) : (
                      botRows.map((b) => (
                        <label key={`${b.platform}:${b.id}`} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedBotIds.includes(b.id)}
                            onChange={(e) => toggleBotId(b.id, e.target.checked)}
                          />
                          <span className="text-xs">
                            <span className="font-mono text-muted-foreground">{b.platform}</span> · {b.name}{' '}
                            <span className="font-mono">({b.id})</span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{te('manualBotIdsLabel')}</label>
                    <Input
                      className="font-mono text-xs"
                      placeholder={te('manualBotIdsPlaceholder')}
                      value={extraBotIdsRaw}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setExtraBotIdsRaw(raw);
                        const ex = splitIdList(raw) ?? [];
                        const rowSet = new Set(botRows.map((b) => b.id));
                        const fromList = selectedBotIds.filter((i) => rowSet.has(i));
                        const arr = [...new Set([...fromList, ...ex])];
                        const a = formData.scope?.adapter ?? {};
                        const { allowPlatforms, denyPlatforms } = a;
                        const evt = formData.scope?.event;
                        if (adapterBotMode === 'allow') {
                          setFormData({
                            ...formData,
                            scope: buildScope(
                              {
                                allowPlatforms,
                                denyPlatforms,
                                allowBotIds: arr.length ? arr : undefined,
                              },
                              evt
                            ),
                          });
                        } else {
                          setFormData({
                            ...formData,
                            scope: buildScope(
                              {
                                allowPlatforms,
                                denyPlatforms,
                                denyBotIds: arr.length ? arr : undefined,
                              },
                              evt
                            ),
                          });
                        }
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-medium">{te('subtypeTitle', { event: eventLabel })}</h3>
            <p className="text-xs text-muted-foreground">{te('subtypeHint')}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {subtypeOptions.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSubTypes.has(o.value)}
                    onChange={(e) => toggleSubtype(o.value, e.target.checked)}
                  />
                  {tsub(o.value)}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="text-sm font-medium">{te('senderSectionTitle')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium">{te('userIdLabel')}</label>
                <Select
                  value={senderUserMode}
                  onValueChange={(v) => {
                    setSenderUserMode(v as ScopeListMode);
                    setFormData((prev) => {
                      const p = { ...prev.permission! };
                      if (v === 'all') {
                        p.allowUsers = undefined;
                        p.denyUsers = undefined;
                      } else if (v === 'allow') {
                        p.denyUsers = undefined;
                        if (!p.allowUsers?.length) p.allowUsers = undefined;
                      } else {
                        p.allowUsers = undefined;
                        if (!p.denyUsers?.length) p.denyUsers = undefined;
                      }
                      return { ...prev, permission: p };
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{te('userScopeAll')}</SelectItem>
                    <SelectItem value="allow">{te('userScopeAllow')}</SelectItem>
                    <SelectItem value="deny">{te('userScopeDeny')}</SelectItem>
                  </SelectContent>
                </Select>
                {senderUserMode !== 'all' && (
                  <Textarea
                    rows={3}
                    className="font-mono text-xs"
                    placeholder={te('idListPlaceholder')}
                    value={
                      (senderUserMode === 'allow'
                        ? formData.permission?.allowUsers
                        : formData.permission?.denyUsers
                      )?.join(', ') ?? ''
                    }
                    onChange={(e) => {
                      const list = splitIdList(e.target.value);
                      if (senderUserMode === 'allow') {
                        setFormData({
                          ...formData,
                          permission: {
                            ...formData.permission!,
                            allowUsers: list,
                            denyUsers: undefined,
                          },
                        });
                      } else {
                        setFormData({
                          ...formData,
                          permission: {
                            ...formData.permission!,
                            denyUsers: list,
                            allowUsers: undefined,
                          },
                        });
                      }
                    }}
                  />
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">{te('groupIdLabel')}</label>
                <Select
                  value={senderGroupMode}
                  onValueChange={(v) => {
                    setSenderGroupMode(v as ScopeListMode);
                    setFormData((prev) => {
                      const p = { ...prev.permission! };
                      if (v === 'all') {
                        p.allowGroups = undefined;
                        p.denyGroups = undefined;
                      } else if (v === 'allow') {
                        p.denyGroups = undefined;
                        if (!p.allowGroups?.length) p.allowGroups = undefined;
                      } else {
                        p.allowGroups = undefined;
                        if (!p.denyGroups?.length) p.denyGroups = undefined;
                      }
                      return { ...prev, permission: p };
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{te('groupScopeAll')}</SelectItem>
                    <SelectItem value="allow">{te('groupScopeAllow')}</SelectItem>
                    <SelectItem value="deny">{te('groupScopeDeny')}</SelectItem>
                  </SelectContent>
                </Select>
                {senderGroupMode !== 'all' && (
                  <Textarea
                    rows={3}
                    className="font-mono text-xs"
                    placeholder={te('groupListPlaceholder')}
                    value={
                      (senderGroupMode === 'allow'
                        ? formData.permission?.allowGroups
                        : formData.permission?.denyGroups
                      )?.join(', ') ?? ''
                    }
                    onChange={(e) => {
                      const list = splitIdList(e.target.value);
                      if (senderGroupMode === 'allow') {
                        setFormData({
                          ...formData,
                          permission: {
                            ...formData.permission!,
                            allowGroups: list,
                            denyGroups: undefined,
                          },
                        });
                      } else {
                        setFormData({
                          ...formData,
                          permission: {
                            ...formData.permission!,
                            denyGroups: list,
                            allowGroups: undefined,
                          },
                        });
                      }
                    }}
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium">{te('allowSenderRoles')}</span>
              <div className="flex flex-wrap gap-4">
                {(['normal', 'admin', 'owner'] as UserRole[]).map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.permission?.allowRoles.includes(role) ?? false}
                      onChange={(e) => {
                        const cur = formData.permission?.allowRoles ?? [];
                        let next = e.target.checked
                          ? [...new Set([...cur, role])]
                          : cur.filter((r) => r !== role);
                        if (next.length === 0) next = ['normal', 'admin', 'owner'];
                        setFormData({
                          ...formData,
                          permission: { ...formData.permission!, allowRoles: next },
                        });
                      }}
                    />
                    {role === 'normal'
                      ? te('roleNormal')
                      : role === 'admin'
                        ? te('roleAdmin')
                        : te('roleOwner')}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-medium">{te('advanced')}</summary>
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">{te('descriptionField')}</label>
                <Textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={te('descriptionPlaceholder')}
                />
              </div>
            </div>
          </details>

          <div className="flex gap-4 justify-end pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateOverlay(false);
                setShowEditOverlay(false);
                setSelectedTrigger(null);
                resetForm();
              }}
            >
              {ui('cancel')}
            </Button>
            <Button type="submit">{showCreateOverlay ? ui('create') : ui('save')}</Button>
          </div>
        </form>
      </Overlay>

      <Overlay
        isOpen={showDeleteOverlay}
        onClose={() => {
          setShowDeleteOverlay(false);
          setSelectedTrigger(null);
        }}
        title={ui('confirmDeleteTitle')}
      >
        <p className="mb-6">
          {ui('confirmDeleteTriggerNamed', { name: selectedTrigger?.name ?? '' })}
        </p>
        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteOverlay(false);
              setSelectedTrigger(null);
            }}
          >
            {ui('cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            {ui('delete')}
          </Button>
        </div>
      </Overlay>
    </div>
  );
}
