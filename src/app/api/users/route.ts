import { NextRequest, NextResponse } from 'next/server';
import { authStorage } from '@/lib/unified-storage';
import { apiRequirePermission } from '@/lib/permissions';

// 获取所有用户
export async function GET() {
  const { error, session } = await apiRequirePermission('users:read');
  if (error) return error;

  try {
    const users = await authStorage.getUsers();
    const roles = await authStorage.getRoles();

    // 返回安全的用户信息（不含密码和凭证详情）
    const safeUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      roleIds: user.roleIds,
      roles: user.roleIds.map((rid) => roles.find((r) => r.id === rid)?.name).filter(Boolean),
      isActive: user.isActive,
      hasGithub: !!user.githubId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    }));

    return NextResponse.json({ users: safeUsers });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// 创建用户
export async function POST(request: NextRequest) {
  const { error, session } = await apiRequirePermission('users:create');
  if (error) return error;

  try {
    const body = await request.json();
    const { name, email, roleIds } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // 检查邮箱是否已存在
    if (email) {
      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
    }

    const user = await authStorage.createUser({
      name,
      email,
      roleIds: roleIds || [],
      isActive: true,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleIds: user.roleIds,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
