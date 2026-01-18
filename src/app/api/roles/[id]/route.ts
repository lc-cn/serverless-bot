import { NextRequest, NextResponse } from 'next/server';
import { authStorage } from '@/lib/unified-storage';
import { apiRequirePermission } from '@/lib/permissions';

interface Params {
  params: Promise<{ id: string }>;
}

// 获取单个角色
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('roles:read');
  if (error) return error;

  const { id } = await params;

  try {
    const role = await authStorage.getRole(id);
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    return NextResponse.json({ role });
  } catch (error) {
    console.error('Failed to fetch role:', error);
    return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
  }
}

// 更新角色
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('roles:update');
  if (error) return error;

  const { id } = await params;

  try {
    const role = await authStorage.getRole(id);
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, permissions } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined && !role.isSystem) updates.name = name;
    if (description !== undefined && !role.isSystem) updates.description = description;
    if (permissions !== undefined) updates.permissions = permissions;

    const updated = await authStorage.updateRole(id, updates);

    return NextResponse.json({ role: updated });
  } catch (error) {
    console.error('Failed to update role:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

// 删除角色
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('roles:delete');
  if (error) return error;

  const { id } = await params;

  try {
    const role = await authStorage.getRole(id);
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (role.isSystem) {
      return NextResponse.json({ error: 'Cannot delete system role' }, { status: 400 });
    }

    const success = await authStorage.deleteRole(id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete role:', error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
