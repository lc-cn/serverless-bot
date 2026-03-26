'use client';

import { useState, useEffect, type FormEvent } from 'react';
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

export default function NewVendorProfilePage() {
  const t = useTranslations('VendorProfilePage');
  const tUi = useTranslations('Ui');
  const router = useRouter();
  const [vendors, setVendors] = useState<{ id: string; label: string; hint?: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendorKind: 'openai_compatible',
    name: '',
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    profileExtraJson: '',
  });

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/llm/vendors');
      if (r.ok) {
        const d = await r.json();
        setVendors(d.vendors || []);
        if (d.vendors?.[0]?.id) {
          setForm((f) => ({ ...f, vendorKind: d.vendors[0].id }));
        }
      }
    })();
  }, []);

  const submit = async (e: FormEvent) => {
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
      const r = await fetch('/api/llm/vendor-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorKind: form.vendorKind,
          name: form.name,
          apiBaseUrl: form.apiBaseUrl,
          apiKey: form.apiKey,
          ...(trimmedExtra ? { extraJson: trimmedExtra } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || tUi('createFailed'));
        return;
      }
      router.push(`/llm/vendors/${encodeURIComponent(d.profile.id)}`);
    } finally {
      setSaving(false);
    }
  };

  const hint = vendors.find((v) => v.id === form.vendorKind)?.hint;

  return (
    <div>
      <Link
        href="/llm/vendors"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {tUi('backToList')}
      </Link>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t('titleNew')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('labelVendorKind')}</label>
              <Select value={form.vendorKind} onValueChange={(v) => setForm({ ...form, vendorKind: v })}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder={t('placeholderVendorKind')} />
                </SelectTrigger>
                <SelectContent>
                  {vendors.length === 0 ? (
                    <SelectItem value="openai_compatible">{t('openAiCompatibleChat')}</SelectItem>
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
                placeholder={t('placeholderConnectionName')}
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
              <label className="text-sm font-medium">{t('labelApiKey')}</label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('labelProfileExtraJson')}</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">{t('hintProfileExtraJson')}</p>
              <Textarea
                className="min-h-[96px] font-mono text-xs"
                value={form.profileExtraJson}
                onChange={(e) => setForm({ ...form, profileExtraJson: e.target.value })}
                placeholder={'{}'}
                spellCheck={false}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? tUi('saving') : t('submitCreateProfile')}
              </Button>
              <Link href="/llm/vendors">
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
