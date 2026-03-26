'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import { Plus, Trash2, Edit, Shield, Lock } from 'lucide-react';
import { Role, Permission } from '@/types/auth';

interface RoleListClientProps {
  initialRoles: Role[];
  availablePermissions: Permission[];
}

export function RoleListClient({
  initialRoles,
  availablePermissions,
}: RoleListClientProps) {
  const t = useTranslations('Ui');
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  // 按资源分组权限
  const groupedPermissions = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) acc[perm.resource] = [];
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const resourceLabels = useMemo(
    () =>
      ({
        adapters: t('resourceAdapters'),
        bots: t('resourceBots'),
        flows: t('resourceFlows'),
        users: t('resourceUsers'),
        roles: t('resourceRoles'),
      }) as Record<string, string>,
    [t],
  );

  const refreshRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Failed to refresh roles:', error);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCreateOverlay(false);
        setFormData({ name: '', description: '', permissions: [] });
        refreshRoles();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to create role:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRole) return;

    try {
      const res = await fetch(`/api/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowEditOverlay(false);
        setSelectedRole(null);
        setFormData({ name: '', description: '', permissions: [] });
        refreshRoles();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;

    try {
      const res = await fetch(`/api/roles/${selectedRole.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setShowDeleteOverlay(false);
        setSelectedRole(null);
        refreshRoles();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  const openEditOverlay = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions,
    });
    setShowEditOverlay(true);
  };

  const togglePermission = (permId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter((id) => id !== permId)
        : [...prev.permissions, permId],
    }));
  };

  const toggleResourceAll = (resource: string, perms: Permission[]) => {
    const permIds = perms.map((p) => p.id);
    const hasAll = permIds.every((id) => formData.permissions.includes(id));

    setFormData((prev) => ({
      ...prev,
      permissions: hasAll
        ? prev.permissions.filter((id) => !permIds.includes(id))
        : Array.from(new Set([...prev.permissions, ...permIds])),
    }));
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setShowCreateOverlay(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('addRole')}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{role.name}</CardTitle>
                  {role.isSystem && (
                    <Badge variant="secondary">
                      <Lock className="w-3 h-3 mr-1" />
                      {t('system')}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditOverlay(role)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  {!role.isSystem && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedRole(role);
                        setShowDeleteOverlay(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {role.description || t('noDescription')}
              </p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 5).map((perm) => (
                  <Badge key={perm} variant="outline" className="text-xs">
                    {perm}
                  </Badge>
                ))}
                {role.permissions.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    {t('moreCount', { count: role.permissions.length - 5 })}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 创建/编辑角色 Overlay */}
      <Overlay
        isOpen={showCreateOverlay || showEditOverlay}
        onClose={() => {
          setShowCreateOverlay(false);
          setShowEditOverlay(false);
          setSelectedRole(null);
          setFormData({ name: '', description: '', permissions: [] });
        }}
        title={showEditOverlay ? t('editRole') : t('addRole')}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('fieldRoleName')}</label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder={t('placeholderRoleName')}
              disabled={selectedRole?.isSystem}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('fieldRoleDescription')}</label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder={t('placeholderRoleDescription')}
              disabled={selectedRole?.isSystem}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('fieldPermissions')}</label>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {Object.entries(groupedPermissions).map(([resource, perms]) => (
                <div key={resource} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {resourceLabels[resource] || resource}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleResourceAll(resource, perms)}
                    >
                      {perms.every((p) => formData.permissions.includes(p.id))
                        ? t('deselectAll')
                        : t('selectAll')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                        />
                        {perm.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateOverlay(false);
                setShowEditOverlay(false);
                setSelectedRole(null);
                setFormData({ name: '', description: '', permissions: [] });
              }}
            >
              {t('cancel')}
            </Button>
            <Button onClick={showEditOverlay ? handleUpdate : handleCreate}>
              {showEditOverlay ? t('save') : t('create')}
            </Button>
          </div>
        </div>
      </Overlay>

      {/* 删除确认 Overlay */}
      <Overlay
        isOpen={showDeleteOverlay}
        onClose={() => setShowDeleteOverlay(false)}
        title={t('titleDeleteRole')}
      >
        <div className="space-y-4">
          <p>{t('confirmDeleteNamed', { name: selectedRole?.name ?? '' })}</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteOverlay(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('delete')}
            </Button>
          </div>
        </div>
      </Overlay>
    </>
  );
}
