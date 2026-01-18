'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Github, Loader2 } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // GitHub 登录
  const handleGithubLogin = async () => {
    setLoading('github');
    setError(null);
    try {
      await signIn('github', { callbackUrl });
    } catch (err) {
      setError('GitHub 登录失败');
      setLoading(null);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">登录</CardTitle>
        <CardDescription>选择登录方式继续</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {/* GitHub 登录 */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGithubLogin}
          disabled={loading !== null}
        >
          {loading === 'github' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Github className="w-4 h-4 mr-2" />
          )}
          使用 GitHub 登录
        </Button>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          首次登录将自动创建账户
        </p>
      </CardFooter>
    </Card>
  );
}
