'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { readApiErrorMessage, API_WIRE_VERSION } from '@/lib/http/api-wire-error';
import { parseSandboxSseBlock, SANDBOX_SSE_EVENTS } from '@/lib/sandbox/sandbox-chat-wire';
import { ArrowUp, Bot, Copy, MessageSquarePlus, Search } from 'lucide-react';
import { cn } from '@/lib/shared/utils';

type ChatMsg =
  | { role: 'user'; text: string; at: number }
  | { role: 'bot'; text: string; at: number; target?: string }
  | { role: 'system'; text: string; at: number };

type ApiResult = {
  traceId: string;
  outbound: Array<{
    at: number;
    target: { type: string; userId?: string; groupId?: string };
    text: string;
    success: boolean;
  }>;
  flowResults: Array<{
    flowId: string;
    matched: boolean;
    executed: boolean;
    duration: number;
    error?: string;
  }>;
};

function asApiResult(p: Record<string, unknown>): ApiResult | null {
  if (typeof p.traceId !== 'string') return null;
  if (!Array.isArray(p.outbound) || !Array.isArray(p.flowResults)) return null;
  return {
    traceId: p.traceId,
    outbound: p.outbound as ApiResult['outbound'],
    flowResults: p.flowResults as ApiResult['flowResults'],
  };
}

async function consumeSandboxSse(
  response: Response,
  onFrame: (args: { event: string | null; payload: Record<string, unknown> }) => void,
  noBodyMessage: string,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error(noBodyMessage);
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const sep = buffer.indexOf('\n\n');
      if (sep < 0) break;
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const { event, payload } = parseSandboxSseBlock(block);
      if (payload) {
        onFrame({ event, payload });
      }
    }
  }
}

function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  if (parts.length === 1 && parts[0]!.length >= 2) return parts[0]!.slice(0, 2).toUpperCase();
  return label.slice(0, 2).toUpperCase() || '?';
}

export function SandboxChatClient({ userDisplayName }: { userDisplayName: string }) {
  const t = useTranslations('SandboxChat');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  /** 与 Tailwind `md` 一致：仅 ≥768px 时启用搜索过滤（手机端不展示搜索框） */
  const [searchFilterEnabled, setSearchFilterEnabled] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => {
      const on = mq.matches;
      setSearchFilterEnabled(on);
      if (!on) setSearchQuery('');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const append = useCallback((m: ChatMsg) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  const appendFlowResultMessages = useCallback(
    (add: (m: ChatMsg) => void, r: ApiResult) => {
      const targetLabel = (o: ApiResult['outbound'][0]) =>
        o.target.type === 'group'
          ? t('targetGroup', { id: o.target.groupId ?? '?' })
          : t('targetPrivate', { id: o.target.userId ?? '?' });

      if (r.outbound.length === 0) {
        add({
          role: 'system',
          text: t('noOutbound', { traceId: r.traceId }),
          at: Date.now(),
        });
      } else {
        for (const o of r.outbound) {
          add({
            role: 'bot',
            text: o.text || t('nonPlainText'),
            at: o.at,
            target: targetLabel(o),
          });
        }
      }
    },
    [t],
  );

  const newChat = useCallback(() => {
    if (sending) return;
    setMessages([]);
    setSearchQuery('');
  }, [sending]);

  const displayMessages = useMemo(() => {
    const q = searchFilterEnabled ? searchQuery.trim().toLowerCase() : '';
    if (!q) return messages;
    return messages.filter((m) => m.text.toLowerCase().includes(q));
  }, [messages, searchFilterEnabled, searchQuery]);

  const sessionPreview = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.role === 'user') return m.text.slice(0, 72) + (m.text.length > 72 ? '…' : '');
    }
    return t('sessionPreviewEmpty');
  }, [messages, t]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [displayMessages.length, sending]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    append({ role: 'user', text: content, at: Date.now() });
    setInput('');
    try {
      const r = await fetch('/api/chat/sandbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          schemaVersion: API_WIRE_VERSION,
          message: { type: 'text', content },
          meta: { clientRequestId: crypto.randomUUID() },
        }),
      });
      const ct = r.headers.get('content-type') ?? '';

      if (!r.ok) {
        if (ct.includes('application/json')) {
          try {
            const data: unknown = await r.json();
            const msg = readApiErrorMessage(data) ?? `HTTP ${r.status}`;
            append({ role: 'system', text: `${t('errorPrefix')}${msg}`, at: Date.now() });
          } catch {
            append({ role: 'system', text: `${t('errorPrefix')}HTTP ${r.status}`, at: Date.now() });
          }
        } else {
          append({ role: 'system', text: `${t('errorPrefix')}HTTP ${r.status}`, at: Date.now() });
        }
        return;
      }

      if (!ct.includes('text/event-stream')) {
        append({
          role: 'system',
          text: t('errExpectedSse', {
            contentType: ct || t('contentTypeEmpty'),
          }),
          at: Date.now(),
        });
        return;
      }

      let terminal: 'result' | 'error' | 'none' = 'none';
      await consumeSandboxSse(
        r,
        ({ event, payload }) => {
          const ev = event ?? '';
          if (ev === SANDBOX_SSE_EVENTS.START) {
            return;
          }
          if (ev === SANDBOX_SSE_EVENTS.RESULT) {
            const res = asApiResult(payload);
            if (res) {
              terminal = 'result';
              appendFlowResultMessages(append, res);
            }
            return;
          }
          if (ev === SANDBOX_SSE_EVENTS.ERROR) {
            terminal = 'error';
            const code = typeof payload.code === 'string' ? `[${payload.code}] ` : '';
            const message =
              typeof payload.message === 'string' ? payload.message : t('unknownError');
            append({ role: 'system', text: `${t('errorPrefix')}${code}${message}`, at: Date.now() });
            return;
          }
        },
        t('networkError'),
      );
      if (terminal === 'none') {
        append({ role: 'system', text: t('streamNoTerminal'), at: Date.now() });
      }
    } catch {
      append({ role: 'system', text: t('networkError'), at: Date.now() });
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const userInitials = initialsFromLabel(userDisplayName);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/80',
        'shadow-[var(--shadow-surface-sm)] backdrop-blur-sm',
        'md:flex-row',
      )}
    >
      {/* 左栏：会话与搜索 */}
      <aside
        className={cn(
          'flex shrink-0 flex-col gap-4 border-border/60 bg-muted/25 p-4 sm:p-5',
          'md:w-[15.5rem] md:border-r',
          'max-md:border-b',
        )}
      >
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground"
            onClick={newChat}
            disabled={sending}
            aria-label={t('newChat')}
            title={t('newChat')}
          >
            <MessageSquarePlus className="size-4" />
          </Button>
        </div>
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchMessages')}
            className="h-9 border-border/70 bg-background/80 pl-8 text-sm shadow-none"
            aria-label={t('searchMessages')}
          />
        </div>
        <div className="min-h-0 flex-1 md:block">
          <div
            className={cn(
              'mt-1 flex w-full flex-col gap-1 rounded-xl border border-transparent bg-background/60 px-3 py-2.5 text-left sm:px-3.5 sm:py-3',
              'ring-1 ring-border/60',
            )}
          >
            <span className="text-sm font-medium leading-tight">{t('sessionTitle')}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{sessionPreview}</span>
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-card/50 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
              {t('headerTitle')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {sending ? t('statusSending') : t('statusReady')}
            </p>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 bg-gradient-to-b from-background/40 to-muted/15">
          <div className="h-full overflow-y-auto overscroll-contain px-5 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto flex max-w-3xl flex-col gap-7">
              {displayMessages.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  {messages.length > 0 && searchFilterEnabled && searchQuery.trim()
                    ? t('searchNoResults')
                    : t('emptyThread')}
                </p>
              ) : (
                displayMessages.map((m, i) => {
                  if (m.role === 'system') {
                    return (
                      <div
                        key={`${m.at}-${i}`}
                        className="mx-auto max-w-lg rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5 text-center text-xs leading-relaxed text-muted-foreground"
                      >
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      </div>
                    );
                  }
                  if (m.role === 'user') {
                    return (
                      <div key={`${m.at}-${i}`} className="flex gap-3">
                        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                          {userInitials}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-xs font-medium text-muted-foreground">{userDisplayName}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                            {m.text}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={`${m.at}-${i}`} className="flex gap-3">
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                        <Bot className="size-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-xs font-medium text-muted-foreground">{t('assistantTitle')}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {m.text}
                        </p>
                        <div className="mt-2 flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            aria-label={t('copyMessage')}
                            onClick={() => void navigator.clipboard.writeText(m.text)}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={scrollAnchorRef} className="h-px shrink-0" aria-hidden />
            </div>
          </div>
        </div>

        {/* 底部输入 */}
        <div className="shrink-0 px-5 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-4">
          <div className="mx-auto max-w-3xl">
            <div
              className={cn(
                'rounded-2xl border border-border/70 bg-card/95 p-3',
                'shadow-[var(--shadow-surface-md)]',
              )}
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('composerPlaceholder')}
                disabled={sending}
                rows={2}
                className={cn(
                  'min-h-[52px] resize-none border-0 bg-transparent px-1 py-1 text-sm shadow-none focus-visible:ring-0',
                  'max-h-[200px]',
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="mt-2 flex items-center justify-end border-t border-border/50 pt-2">
                <Button
                  type="button"
                  size="icon"
                  disabled={sending || !input.trim()}
                  className={cn(
                    'size-9 shrink-0 rounded-full shadow-sm',
                    !input.trim() && 'opacity-50',
                  )}
                  aria-label={t('send')}
                  onClick={() => void send()}
                >
                  <ArrowUp className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
