'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';

export default function LogoutPage() {
  useEffect(() => {
    // 触发登出并跳回登录页
    signOut({ callbackUrl: '/login' });
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
      正在退出登录...
    </div>
  );
}
