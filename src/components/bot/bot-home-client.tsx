"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import type { BotConfig } from '@/types';

interface EventLogEntry {
  id: string;
  type: string;
  subType?: string;
  platform: string;
  botId: string;
  timestamp: number;
  sender?: { userId?: string };
  summary?: Record<string, unknown>;
}

interface Message {
  id: string;
  role: 'user' | 'bot' | 'system';
  text: string;
  timestamp: number;
}

interface BotHomeClientProps {
  platform: string;
  bot: BotConfig;
}

export function BotHomeClient({ platform, bot }: BotHomeClientProps) {
  const t = useTranslations('BotHomeClient');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string; members?: { id: string; name: string; role?: string }[] }[]>([]);
  const [selected, setSelected] = useState<{ type: 'group' | 'contact'; id: string; name: string } | null>(null);
  const [nav, setNav] = useState<'conversations' | 'contacts' | 'groups' | 'settings'>('conversations');
  const [logs, setLogs] = useState<EventLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // 初始化加载会话列表（联系人+群组）
  useEffect(() => {
    (async () => {
      try {
        const [contactsRes, groupsRes] = await Promise.all([
          fetch(`/api/chat/contacts?platform=${platform}&bot_id=${bot.id}`),
          fetch(`/api/chat/groups?platform=${platform}&bot_id=${bot.id}`),
        ]);
        if (contactsRes.ok) {
          const data = await contactsRes.json();
          setContacts(data.contacts || []);
        }
        if (groupsRes.ok) {
          const data = await groupsRes.json();
          setGroups(data.groups || []);
        }
      } catch (e) {
        console.error('Failed to load lists', e);
      }
    })();
  }, [platform, bot.id]);

  // 根据选中的会话加载独立消息历史
  useEffect(() => {
    (async () => {
      if (!selected) {
        setMessages([]);
        return;
      }
      try {
        const url = `/api/chat/messages?platform=${platform}&bot_id=${bot.id}&peer_id=${selected.id}&peer_type=${selected.type}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (e) {
        console.error('Failed to load messages', e);
      }
    })();
  }, [selected, platform, bot.id]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    if (!selected) return; // 需要选择具体会话
    setLoading(true);
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, bot_id: bot.id, text, peer_id: selected.id, peer_type: selected.type }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setText('');
      }
    } catch (e) {
      console.error('Failed to send message', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const url = `/api/logs/events?platform=${platform}&bot_id=${bot.id}&limit=50`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Failed to load logs', e);
    }
  };

  // 读取联系人与群组为只读列表；此处不提供增删改

  return (
    <div className="grid grid-cols-[56px_260px_1fr_280px] h-[72vh] bg-neutral-50 p-2">
      {/* 左侧竖向工具栏 */}
      <Card className="p-2 flex flex-col items-center gap-2 shadow-sm bg-white border border-neutral-200">
        <Button
          variant={nav === 'conversations' ? 'secondary' : 'ghost'}
          size="icon"
          aria-label={t('ariaMessages')}
          className="hover:bg-neutral-100"
          onClick={() => {
            setNav('conversations');
            setSelected(null);
          }}
        >
          💬
        </Button>
        <Button
          variant={nav === 'contacts' ? 'secondary' : 'ghost'}
          size="icon"
          aria-label={t('ariaContacts')}
          className="hover:bg-neutral-100"
          onClick={() => {
            setNav('contacts');
            setSelected(null);
          }}
        >
          👥
        </Button>
        <Button
          variant={nav === 'groups' ? 'secondary' : 'ghost'}
          size="icon"
          aria-label={t('ariaGroups')}
          className="hover:bg-neutral-100"
          onClick={() => {
            setNav('groups');
            setSelected(null);
          }}
        >
          👪
        </Button>
        <Button
          variant={nav === 'settings' ? 'secondary' : 'ghost'}
          size="icon"
          aria-label={t('ariaSettings')}
          className="hover:bg-neutral-100"
          onClick={() => setNav('settings')}
        >
          ⚙️
        </Button>
      </Card>

      {/* 中间：会话列表（联系人+群组） */}
      <Card className="overflow-y-auto shadow-sm bg-white border border-neutral-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-neutral-700">
            {nav === 'conversations'
              ? t('navConversations')
              : nav === 'contacts'
                ? t('navContacts')
                : nav === 'groups'
                  ? t('navGroups')
                  : t('navSettings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {nav !== 'contacts' && groups.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t('sectionGroupChats')}</div>
              {groups.map((g) => (
                <Button
                  key={g.id}
                  variant={selected?.id === g.id && selected?.type === 'group' ? 'secondary' : 'ghost'}
                  className="w-full justify-start hover:bg-neutral-100"
                  onClick={() => setSelected({ type: 'group', id: g.id, name: g.name })}
                >
                  {g.name}
                </Button>
              ))}
            </div>
          )}
          {nav !== 'groups' && contacts.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">{t('sectionContacts')}</div>
              {contacts.map((c) => (
                <Button
                  key={c.id}
                  variant={selected?.id === c.id && selected?.type === 'contact' ? 'secondary' : 'ghost'}
                  className="w-full justify-start hover:bg-neutral-100"
                  onClick={() => setSelected({ type: 'contact', id: c.id, name: c.name })}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          )}
          {nav === 'conversations' && groups.length === 0 && contacts.length === 0 && (
            <div className="text-sm text-muted-foreground">{t('emptyConversations')}</div>
          )}
          {nav === 'contacts' && contacts.length === 0 && (
            <div className="text-sm text-muted-foreground">{t('emptyContactsList')}</div>
          )}
          {nav === 'groups' && groups.length === 0 && (
            <div className="text-sm text-muted-foreground">{t('emptyGroupsList')}</div>
          )}
        </CardContent>
      </Card>

      {/* 中间：聊天面板 */}
      <div className="grid grid-rows-[auto_1fr_auto] h-full">
        <Card className="row-start-1 shadow-sm bg-neutral-50 border border-neutral-200">
          <CardContent className="py-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">{selected ? selected.name : t('noChatSelected')}</div>
              <div className="text-sm text-neutral-500">{bot.name || bot.id}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="row-start-2 overflow-y-auto shadow-sm bg-white border border-neutral-200">
          <CardContent className="p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-sm text-neutral-500">{t('noMessages')}</div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === 'user';
                const isBot = m.role === 'bot';
                const bubble = isUser
                  ? 'bg-neutral-900 text-white'
                  : isBot
                  ? 'bg-white text-neutral-800 border border-neutral-200'
                  : 'bg-neutral-100 text-neutral-700';
                return (
                  <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 shadow-sm ${bubble}`}>
                      <div className="text-sm leading-relaxed">{m.text}</div>
                      <div className={`text-[10px] mt-1 ${isUser ? 'text-neutral-300 text-right' : 'text-neutral-500'}`}>
                        {new Date(m.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="row-start-3 shadow-sm bg-white border border-neutral-200">
          <CardContent className="py-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label={t('ariaEmoji')} className="hover:bg-neutral-100">😊</Button>
              <Button variant="ghost" size="icon" aria-label={t('ariaScissors')} className="hover:bg-neutral-100">✂️</Button>
              <Button variant="ghost" size="icon" aria-label={t('ariaFile')} className="hover:bg-neutral-100">📎</Button>
              <Button variant="ghost" size="icon" aria-label={t('ariaImage')} className="hover:bg-neutral-100">🖼️</Button>
              <Button variant="ghost" size="icon" aria-label={t('ariaMail')} className="hover:bg-neutral-100">✉️</Button>
              <Button variant="ghost" size="icon" aria-label={t('ariaVoice')} className="hover:bg-neutral-100">🎤</Button>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('inputPlaceholder')}
                className="flex-1 border-neutral-200 bg-white"
              />
              <Button onClick={sendMessage} disabled={loading}>
                {loading ? t('sending') : t('send')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 右侧：成员/公告面板 */}
      <Card className="overflow-y-auto shadow-sm bg-white border border-neutral-200">
        <CardHeader className="pb-2 bg-neutral-50">
          <CardTitle className="text-neutral-700">
            {selected?.type === 'group' ? t('sideTitleGroup') : t('sideTitleSession')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selected?.type === 'group' ? (
            <div className="space-y-2">
              <div>
                <div className="text-sm font-medium mb-1 text-neutral-700">{t('groupNoticeTitle')}</div>
                <div className="text-xs text-neutral-500">{t('groupNoticeSample')}</div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1 text-neutral-700">{t('groupMembersTitle')}</div>
                <div className="flex flex-col gap-1">
                  {groups.find((g) => g.id === selected.id)?.members?.length ? (
                    groups
                      .find((g) => g.id === selected.id)!
                      .members!.map((m) => (
                        <div key={m.id} className="text-sm text-neutral-700">
                          {m.name}{m.role ? ` · ${m.role}` : ''}
                        </div>
                      ))
                  ) : (
                    <div className="text-xs text-neutral-500">{t('emptyMembers')}</div>
                  )}
                </div>
              </div>
            </div>
          ) : selected ? (
            <div>
              <div className="text-sm text-neutral-700">{t('contactLine', { name: selected.name })}</div>
              <div className="text-xs text-neutral-500">{t('contactNoteSample')}</div>
            </div>
          ) : (
            <div className="text-sm text-neutral-500">{t('selectConversationHint')}</div>
          )}

          <div className="pt-2 border-t border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-neutral-700">{t('eventLogTitle')}</div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowLogs((v) => !v)} className="hover:bg-neutral-100">
                  {showLogs ? t('collapse') : t('expand')}
                </Button>
                <Button variant="outline" size="sm" onClick={loadLogs}>
                  {t('refresh')}
                </Button>
              </div>
            </div>
            {showLogs && (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-xs text-neutral-500">{t('emptyLogs')}</div>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="text-xs text-neutral-700">
                      <span className="text-neutral-500 mr-2">{new Date(l.timestamp).toLocaleString()}</span>
                      <Badge variant="secondary" className="mr-2">{l.type}{l.subType ? `/${l.subType}` : ''}</Badge>
                      <span className="break-words">
                        {l.summary ? JSON.stringify(l.summary) : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
