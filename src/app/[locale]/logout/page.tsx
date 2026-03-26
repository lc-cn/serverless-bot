'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';

export default function LogoutPage() {
  const t = useTranslations('LogoutPage');
  const params = useParams();
  const locale = typeof params?.locale === 'string' ? params.locale : 'zh-CN';

  useEffect(() => {
    signOut({ callbackUrl: `/${locale}/sign-in` });
  }, [locale]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
      {t('signingOut')}
    </div>
  );
}
