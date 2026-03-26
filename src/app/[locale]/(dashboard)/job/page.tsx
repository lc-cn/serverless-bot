'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Briefcase, Edit, Trash2 } from 'lucide-react';
import { Job } from '@/types';

export default function JobPage() {
  const t = useTranslations('Ui');
  const tJob = useTranslations('Dashboard.job');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm(t('confirmDeleteJob'))) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadJobs();
      } else {
        alert(t('deleteFailed'));
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert(t('deleteFailed'));
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{tJob('title')}</h1>
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tJob('title')}</h1>
          <p className="text-muted-foreground mt-1">{tJob('description')}</p>
        </div>
        <Link href="/job/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {tJob('newPipeline')}
          </Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{tJob('empty')}</p>
            <Link href="/job/new">
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                {tJob('createFirst')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {job.name}
                      {!job.enabled && (
                        <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                          {t('disabledBadge')}
                        </span>
                      )}
                    </CardTitle>
                    {job.description && (
                      <CardDescription className="mt-2">
                        {job.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/job/${job.id}`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        {t('edit')}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(job.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('delete')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{tJob('stepCount', { count: job.steps.length })}</span>
                  <span>{tJob('createdAt', { datetime: new Date(job.createdAt).toLocaleString() })}</span>
                  {job.updatedAt && (
                    <span>{tJob('updatedAt', { datetime: new Date(job.updatedAt).toLocaleString() })}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
