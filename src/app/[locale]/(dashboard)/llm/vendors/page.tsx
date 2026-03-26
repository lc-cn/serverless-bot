'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Layers, Edit, Trash2 } from 'lucide-react';
import type { LlmVendorProfile } from '@/types';
import { FirstVisitOnboardingHint } from '@/components/onboarding/first-visit-onboarding-hint';

export default function LlmVendorsPage() {
  const tu = useTranslations('Ui');
  const tv = useTranslations('Dashboard.llmVendors');
  const ta = useTranslations('Dashboard.agents');
  const [profiles, setProfiles] = useState<LlmVendorProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/llm/vendor-profiles');
        if (r.ok) {
          const d = await r.json();
          setProfiles(d.profiles || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(tu('confirmDeleteVendor'))) return;
    const r = await fetch(`/api/llm/vendor-profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (r.ok) setProfiles((prev) => prev.filter((p) => p.id !== id));
    else alert(tu('deleteFailed'));
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{tv('title')}</h1>
        <p className="text-muted-foreground">{tu('loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <FirstVisitOnboardingHint sectionId="llm_runtime" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tv('title')}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">{tv('description')}</p>
        </div>
        <Link href="/llm/vendors/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {tv('newConnection')}
          </Button>
        </Link>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{tv('empty')}</p>
            <Link href="/llm/vendors/new">
              <Button>{tv('addFirst')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">{p.id}</CardDescription>
                  </div>
                  <Badge variant="outline">{p.vendorKind}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="truncate" title={p.apiBaseUrl}>
                  {ta('url')} {p.apiBaseUrl}
                </p>
                <p>
                  {ta('apiKey')} {p.hasApiKey ? ta('apiKeySet') : ta('apiKeyUnset')}
                </p>
                <div className="flex gap-2 pt-2">
                  <Link href={`/llm/vendors/${encodeURIComponent(p.id)}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-1" />
                      {tv('editModels')}
                    </Button>
                  </Link>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    {tu('delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
