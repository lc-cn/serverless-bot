'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Briefcase, Edit, Trash2 } from 'lucide-react';
import { Job } from '@/types';

export default function JobPage() {
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
    if (!confirm('确定要删除这个作业吗？')) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadJobs();
      } else {
        alert('删除失败');
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('删除失败');
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">作业管理</h1>
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">作业管理</h1>
          <p className="text-muted-foreground mt-1">
            管理工作单元，每个作业包含多个有序的执行步骤
          </p>
        </div>
        <Link href="/job/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            新建作业
          </Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">暂无作业</p>
            <Link href="/job/new">
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                创建第一个作业
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
                          已禁用
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
                        编辑
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(job.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      删除
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>步骤数: {job.steps.length}</span>
                  <span>创建时间: {new Date(job.createdAt).toLocaleString()}</span>
                  {job.updatedAt && (
                    <span>更新时间: {new Date(job.updatedAt).toLocaleString()}</span>
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
