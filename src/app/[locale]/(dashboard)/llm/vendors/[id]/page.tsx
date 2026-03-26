'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
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
import { ArrowLeft, Trash2, Plus } from 'lucide-react';
import type { LlmVendorModel, LlmVendorProfile } from '@/types';

export default function EditVendorProfilePage() {
  const t = useTranslations('VendorProfilePage');
  const tUi = useTranslations('Ui');
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [vendors, setVendors] = useState<{ id: string; label: string; hint?: string }[]>([]);
  const [profile, setProfile] = useState<LlmVendorProfile | null>(null);
  const [models, setModels] = useState<LlmVendorModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendorKind: 'openai_compatible',
    name: '',
    apiBaseUrl: '',
    apiKey: '',
    profileExtraJson: '',
  });
  const [newModel, setNewModel] = useState({ modelId: '', displayName: '', extraJson: '' });

  const load = async () => {
    const [rv, rp, rm] = await Promise.all([
      fetch('/api/llm/vendors'),
      fetch(`/api/llm/vendor-profiles/${encodeURIComponent(id)}`),
      fetch(`/api/llm/vendor-models?profileId=${encodeURIComponent(id)}`),
    ]);
    if (rv.ok) {
      const d = await rv.json();
      setVendors(d.vendors || []);
    }
    if (!rp.ok) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { profile: p } = (await rp.json()) as { profile: LlmVendorProfile };
    setProfile(p);
    setForm({
      vendorKind: p.vendorKind,
      name: p.name,
      apiBaseUrl: p.apiBaseUrl,
      apiKey: '',
      profileExtraJson: p.extraJson ?? '',
    });
    if (rm.ok) {
      const d = await rm.json();
      setModels(d.models || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const trimmedExtra = form.profileExtraJson.trim();
      if (trimmedExtra) {
        try {
          JSON.parse(trimmedExtra);
        } catch {
          alert(t('alertJsonInvalid'));
          return;
        }
      }
      const body: Record<string, unknown> = {
        vendorKind: form.vendorKind,
        name: form.name,
        apiBaseUrl: form.apiBaseUrl,
        extraJson: trimmedExtra || null,
      };
      if (form.apiKey.trim()) body.apiKey = form.apiKey;
      const r = await fetch(`/api/llm/vendor-profiles/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || tUi('saveFailed'));
        return;
      }
      setProfile(d.profile);
      setForm((f) => ({ ...f, apiKey: '' }));
      alert(tUi('saved'));
    } finally {
      setSaving(false);
    }
  };

  const addModel = async (e: FormEvent) => {
    e.preventDefault();
    if (!newModel.modelId.trim()) return;
    let extraJson: string | null = null;
    if (newModel.extraJson.trim()) {
      try {
        JSON.parse(newModel.extraJson);
        extraJson = newModel.extraJson.trim();
      } catch {
        alert(t('alertJsonInvalid'));
        return;
      }
    }
    const r = await fetch('/api/llm/vendor-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: id,
        modelId: newModel.modelId.trim(),
        displayName: newModel.displayName.trim() || undefined,
        extraJson,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      alert(d.error || t('alertAddFailed'));
      return;
    }
    setModels((prev) => [...prev, d.model]);
    setNewModel({ modelId: '', displayName: '', extraJson: '' });
  };

  const deleteModel = async (mid: string) => {
    if (!confirm(t('confirmDeleteModel'))) return;
    const r = await fetch(`/api/llm/vendor-models/${encodeURIComponent(mid)}`, {
      method: 'DELETE',
    });
    if (r.ok) setModels((prev) => prev.filter((m) => m.id !== mid));
    else alert(t('alertDeleteFailed'));
  };

  if (loading) {
    return <p className="text-muted-foreground">{t('loading')}</p>;
  }

  if (!profile) {
    return (
      <div>
        <p className="text-destructive mb-4">{t('notFound')}</p>
        <Link href="/llm/vendors">
          <Button variant="outline">{tUi('back')}</Button>
        </Link>
      </div>
    );
  }

  const hint = vendors.find((v) => v.id === form.vendorKind)?.hint;

  return (
    <div className="space-y-8">
      <Link
        href="/llm/vendors"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {tUi('backToList')}
      </Link>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t('titleEdit')}</CardTitle>
          <p className="text-xs font-mono text-muted-foreground">{id}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('labelVendorKind')}</label>
              <Select value={form.vendorKind} onValueChange={(v) => setForm({ ...form, vendorKind: v })}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder={t('placeholderVendorKind')} />
                </SelectTrigger>
                <SelectContent>
                  {vendors.length === 0 ? (
                    <SelectItem value="openai_compatible">{t('openAiCompatible')}</SelectItem>
                  ) : (
                    vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id} title={v.hint ?? ''}>
                        {v.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {hint && <p className="text-xs text-muted-foreground">{t('hintBaseUrl', { hint })}</p>}
            <div>
              <label className="text-sm font-medium">{t('labelConnectionName')}</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('labelApiBaseUrl')}</label>
              <Input
                value={form.apiBaseUrl}
                onChange={(e) => setForm({ ...form, apiBaseUrl: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('labelNewApiKey')}</label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('labelProfileExtraJson')}</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">{t('hintProfileExtraJson')}</p>
              <Textarea
                className="min-h-[128px] font-mono text-xs"
                value={form.profileExtraJson}
                onChange={(e) => setForm({ ...form, profileExtraJson: e.target.value })}
                placeholder={'{\n  "http": {\n    "auth": "api_key",\n    "apiKeyHeaderName": "api-key"\n  }\n}'}
                spellCheck={false}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? tUi('saving') : t('submitSaveConnection')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('cardPresetModels')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('presetModelsDescription')}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {models.length > 0 && (
            <ul className="space-y-2">
              {models.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{m.displayName || m.modelId}</span>
                    <span className="text-muted-foreground font-mono text-xs ml-2">{m.modelId}</span>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{m.id}</p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteModel(m.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={addModel} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Plus className="w-4 h-4" />
              {t('addModelSection')}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">{t('labelModelId')}</label>
                <Input
                  value={newModel.modelId}
                  onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value })}
                  placeholder="gpt-4o-mini"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('labelDisplayName')}</label>
                <Input
                  value={newModel.displayName}
                  onChange={(e) => setNewModel({ ...newModel, displayName: e.target.value })}
                  placeholder={t('placeholderDisplayName')}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('labelExtraJson')}</label>
              <Input
                value={newModel.extraJson}
                onChange={(e) => setNewModel({ ...newModel, extraJson: e.target.value })}
                placeholder='{"temperature":0.3}'
              />
            </div>
            <Button type="submit" size="sm">
              {t('addButton')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <Link href="/agents/new">
          <Button variant="outline">{t('goCreateAgent')}</Button>
        </Link>
      </div>
    </div>
  );
}
