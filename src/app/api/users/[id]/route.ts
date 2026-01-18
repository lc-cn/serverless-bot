import { NextRequest, NextResponse } from 'next/server';
import { authStorage } from '@/lib/unified-storage';
import { apiRequirePermission } from '@/lib/permissions';

interface Params {
  params: Promise<{ id: string }>;
}

// 获取单个用户
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('users:read');
  if (error) return error;

  const { id } = await params;

  try {
    const user = await authStorage.getUser(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const roles = await authStorage.getRoles();

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        roleIds: user.roleIds,
        roles: user.roleIds.map((rid) => roles.find((r) => r.id === rid)).filter(Boolean),
        isActive: user.isActive,
        hasGithub: !!user.githubId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// 更新用户
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('users:update');
  if (error) return error;

  const { id } = await params;

  try {
    const user = await authStorage.getUser(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, roleIds, isActive } = body;

    // 检查邮箱是否已被其他用户使用
    if (email && email !== user.email) {
      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (roleIds !== undefined) updates.roleIds = roleIds;
    if (isActive !== undefined) updates.isActive = isActive;

    const updated = await authStorage.updateUser(id, updates);

    return NextResponse.json({
      user: {
        id: updated!.id,
        name: updated!.name,
        email: updated!.email,
        roleIds: updated!.roleIds,
        isActive: updated!.isActive,
        updatedAt: updated!.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// 删除用户
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('users:delete');
  if (error) return error;

  const { id } = await params;

  try {
    // 不能删除自己
    if (session?.user.id === id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    const success = await authStorage.deleteUser(id);
    if (!success) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
