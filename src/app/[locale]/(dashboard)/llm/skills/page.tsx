'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Edit, Trash2 } from 'lucide-react';
import type { LlmSkill } from '@/types';

export default function LlmSkillsPage() {
  const tu = useTranslations('Ui');
  const ts = useTranslations('Dashboard.llmSkills');
  const [skills, setSkills] = useState<LlmSkill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/llm/skills');
        if (r.ok) {
          const d = await r.json();
          setSkills(d.skills || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (skillId: string) => {
    if (!confirm(tu('confirmDeleteSkill'))) return;
    const r = await fetch(`/api/llm/skills/${encodeURIComponent(skillId)}`, { method: 'DELETE' });
    if (r.ok) setSkills((prev) => prev.filter((s) => s.id !== skillId));
    else alert(tu('deleteFailed'));
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{ts('title')}</h1>
        <p className="text-muted-foreground">{tu('loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{ts('title')}</h1>
          <p className="text-muted-foreground mt-1">{ts('description')}</p>
        </div>
        <Link href="/llm/skills/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {ts('newSkill')}
          </Button>
        </Link>
      </div>

      {skills.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{ts('empty')}</p>
            <Link href="/llm/skills/new">
              <Button>{ts('create')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {skills.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">{s.id}</CardDescription>
                    {s.description && (
                      <p className="text-sm text-muted-foreground mt-2">{s.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/llm/skills/${encodeURIComponent(s.id)}`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap max-h-32 overflow-auto">
                  {s.content.slice(0, 500)}
                  {s.content.length > 500 ? '…' : ''}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
