'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit, Shield, Key, Github, Gitlab, Chrome } from 'lucide-react';
import { Role } from '@/types/auth';

interface UserInfo {
  id: string;
  name: string;
  email?: string;
  image?: string;
  roleIds: string[];
  roles: string[];
  isActive: boolean;
  hasGithub: boolean;
  hasGoogle: boolean;
  hasGitlab: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface UserListClientProps {
  initialUsers: UserInfo[];
  roles: Role[];
}

export function UserListClient({ initialUsers, roles }: UserListClientProps) {
  const t = useTranslations('Ui');
  const router = useRouter();
  const [users, setUsers] = useState<UserInfo[]>(initialUsers);
  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roleIds: [] as string[],
  });

  const refreshUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to refresh users:', error);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCreateOverlay(false);
        setFormData({ name: '', email: '', roleIds: [] });
        refreshUsers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowEditOverlay(false);
        setSelectedUser(null);
        setFormData({ name: '', email: '', roleIds: [] });
        refreshUsers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleToggleActive = async (user: UserInfo) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (res.ok) {
        refreshUsers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to toggle user:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setShowDeleteOverlay(false);
        setSelectedUser(null);
        refreshUsers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const openEditOverlay = (user: UserInfo) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email || '',
      roleIds: user.roleIds,
    });
    setShowEditOverlay(true);
  };

  const toggleRole = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setShowCreateOverlay(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('addUser')}
        </Button>
      </div>

      {users.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground mb-4">{t('emptyUsers')}</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                        {user.hasGithub && (
                          <Github className="w-4 h-4 text-muted-foreground" aria-hidden />
                        )}
                        {user.hasGoogle && (
                          <Chrome className="w-4 h-4 text-muted-foreground" aria-hidden />
                        )}
                        {user.hasGitlab && (
                          <Gitlab className="w-4 h-4 text-muted-foreground" aria-hidden />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.email || t('noEmail')}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role} variant="outline">
                          <Shield className="w-3 h-3 mr-1" />
                          {role}
                        </Badge>
                      ))}
                    </div>
                    <Badge variant={user.isActive ? 'success' : 'secondary'}>
                      {user.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={user.isActive}
                      onChange={() => handleToggleActive(user)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditOverlay(user)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowDeleteOverlay(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑用户 Overlay */}
      <Overlay
        isOpen={showCreateOverlay || showEditOverlay}
        onClose={() => {
          setShowCreateOverlay(false);
          setShowEditOverlay(false);
          setSelectedUser(null);
          setFormData({ name: '', email: '', roleIds: [] });
        }}
        title={showEditOverlay ? t('editUser') : t('addUser')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('fieldUsername')}</label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder={t('placeholderUsername')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('fieldEmail')}</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder={t('placeholderEmailOptional')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('fieldRoles')}</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={formData.roleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  <span>{role.name}</span>
                  {role.isSystem && (
                    <Badge variant="secondary" className="text-xs">
                      {t('system')}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateOverlay(false);
                setShowEditOverlay(false);
                setSelectedUser(null);
                setFormData({ name: '', email: '', roleIds: [] });
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
        title={t('titleDeleteUser')}
      >
        <div className="space-y-4">
          <p>{t('confirmDeleteNamed', { name: selectedUser?.name ?? '' })}</p>
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
