'use client';

import { signOut } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, Github, Shield } from 'lucide-react';

interface ProfileClientProps {
  user: {
    id: string;
    name: string;
    email?: string;
    image?: string;
    roleIds: string[];
    roles: string[];
    hasGithub: boolean;
  };
}

export function ProfileClient({ user }: ProfileClientProps) {
  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="space-y-6">
      {/* 用户信息 */}
      <Card>
        <CardHeader>
          <CardTitle>个人信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold">{user.name}</h3>
              <p className="text-muted-foreground">{user.email || '无邮箱'}</p>
              <div className="flex gap-2 mt-2">
                {user.roles.map((role) => (
                  <Badge key={role} variant="outline">
                    <Shield className="w-3 h-3 mr-1" />
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 登录方式 */}
      <Card>
        <CardHeader>
          <CardTitle>登录方式</CardTitle>
          <CardDescription>管理您的登录凭证</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* GitHub */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Github className="w-5 h-5" />
              <div>
                <div className="font-medium">GitHub</div>
                <div className="text-sm text-muted-foreground">
                  {user.hasGithub ? '已关联' : '未关联'}
                </div>
              </div>
            </div>
            <Badge variant={user.hasGithub ? 'success' : 'secondary'}>
              {user.hasGithub ? '已启用' : '未启用'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 退出登录 */}
      <Card>
        <CardContent className="pt-6">
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
