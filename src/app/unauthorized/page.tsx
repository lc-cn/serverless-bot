import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ShieldX } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <ShieldX className="w-16 h-16 text-destructive" />
          </div>
          <CardTitle className="text-2xl">权限不足</CardTitle>
          <CardDescription>
            您没有权限访问此页面，请联系管理员获取相应权限。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
