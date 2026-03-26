import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MessageSquare, UserPlus, Bell } from 'lucide-react';

export default async function TriggerPage() {
  const t = await getTranslations('Dashboard.triggerHub');

  const triggerTypes = [
    {
      type: 'message' as const,
      name: t('message.name'),
      description: t('message.description'),
      icon: MessageSquare,
      href: '/trigger/message',
    },
    {
      type: 'request' as const,
      name: t('request.name'),
      description: t('request.description'),
      icon: UserPlus,
      href: '/trigger/request',
    },
    {
      type: 'notice' as const,
      name: t('notice.name'),
      description: t('notice.description'),
      icon: Bell,
      href: '/trigger/notice',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">{t('description')}</p>

      <div className="grid md:grid-cols-3 gap-6">
        {triggerTypes.map((trigger) => (
          <Link key={trigger.type} href={trigger.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <trigger.icon className="w-6 h-6" />
                  </div>
                  <CardTitle>{trigger.name}</CardTitle>
                </div>
                <CardDescription>{trigger.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-primary hover:underline">{t('viewConfig')}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
