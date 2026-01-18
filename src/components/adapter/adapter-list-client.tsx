"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Bot } from 'lucide-react';

interface FormField {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
}

interface AdapterInfo {
  platform: string;
  name: string;
  description?: string;
}

interface AdapterItem extends AdapterInfo {
  configured: boolean;
  enabled: boolean;
  config: Record<string, unknown>;
  configSchema: { fields: FormField[] };
}

interface AdapterListClientProps {
  initialAdapters: AdapterItem[];
}

export function AdapterListClient({ initialAdapters }: AdapterListClientProps) {
  const [adapters] = useState<AdapterItem[]>(initialAdapters);

  return (
    <div>
      {adapters.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground mb-4">暂无已注册的适配器</div>
          <p className="text-sm text-muted-foreground">
            请在 src/adapters 目录下注册你的适配器。
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adapters.map((adapter) => (
            <Card key={adapter.platform} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    {adapter.name}
                  </CardTitle>
                  <Badge variant={adapter.enabled ? 'success' : 'secondary'}>
                    {adapter.enabled ? '已启用' : '未启用'}
                  </Badge>
                </div>
                <CardDescription>{adapter.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    平台: {adapter.platform}
                  </span>
                  <Link
                    href={`/adapter/${adapter.platform}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Bot className="w-4 h-4" />
                    机器人
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
