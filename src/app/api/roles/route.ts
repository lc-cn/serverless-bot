import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';
import { PERMISSIONS as ALL_PERMISSIONS } from '@/types/auth';

// 获取所有角色
export async function GET() {
  const { error, session } = await apiRequirePermission('roles:read');
  if (error) return error;

  try {
    const roles = await storage.getRoles();

    return NextResponse.json({
      roles,
      availablePermissions: Object.values(ALL_PERMISSIONS),
    });
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

// 创建角色
export async function POST(request: NextRequest) {
  const { error, session } = await apiRequirePermission('roles:create');
  if (error) return error;

  try {
    const body = await request.json();
    const { name, description, permissions } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const role = await storage.createRole({
      name,
      description,
      permissions: permissions || [],
      isSystem: false,
    });

    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'role.create',
      entityType: 'role',
      entityId: role.id,
      payload: { name: role.name },
      request,
    });

    return NextResponse.json({ role });
  } catch (error) {
    console.error('Failed to create role:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
