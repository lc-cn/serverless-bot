'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export default function NewJobPage() {
  const ui = useTranslations('Ui');
  const tj = useTranslations('Dashboard.jobEditor');
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          steps: [],
        }),
      });

      if (response.ok) {
        const { job } = await response.json();
        router.push(`/job/${job.id}`);
      } else {
        alert(ui('createFailed'));
      }
    } catch (error) {
      console.error('Failed to create job:', error);
      alert(ui('createFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/job">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {ui('back')}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold mt-4">{tj('newTitle')}</h1>
        <p className="text-muted-foreground mt-1">{tj('newSubtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tj('basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                {tj('pipelineName')}
              </label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={tj('namePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                {tj('fieldDescription')}
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={tj('descPlaceholder')}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">{tj('enabledState')}</label>
                <p className="text-sm text-muted-foreground">{tj('enabledHint')}</p>
              </div>
              <Switch
                checked={formData.enabled}
                onChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>

            <div className="flex gap-4 justify-end">
              <Link href="/job">
                <Button type="button" variant="outline">
                  {ui('cancel')}
                </Button>
              </Link>
              <Button type="submit" disabled={saving}>
                {saving ? tj('creating') : tj('createPipeline')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
