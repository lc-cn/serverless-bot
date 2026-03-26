"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type BotItem = { id: string; name: string };

type Props = {
  bots: BotItem[];
};

export function DiscordCommandCreator({ bots }: Props) {
  const t = useTranslations('DiscordCommandCreator');
  const [botId, setBotId] = useState(bots[0]?.id || '');
  const [scope, setScope] = useState<'guild' | 'global'>('guild');
  const [guildId, setGuildId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [optionsJson, setOptionsJson] = useState('[]');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleSubmit = async () => {
    setLoading(true);
    setResult('');
    try {
      const options = optionsJson.trim() ? JSON.parse(optionsJson) : [];
      const res = await fetch('/api/discord/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, scope, guildId, command: { name, description, options } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(json));
      setResult(JSON.stringify(json.command, null, 2));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult(msg || t('requestFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('labelBot')}</label>
        <select
          className="w-full rounded border px-3 py-2"
          value={botId}
          onChange={(e) => setBotId(e.target.value)}
        >
          {bots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.id})
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">{t('labelCommandName')}</label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder={t('phCommandName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">{t('labelDescription')}</label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder={t('phDescription')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">{t('labelScope')}</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'guild' | 'global')}
          >
            <option value="guild">{t('scopeGuild')}</option>
            <option value="global">{t('scopeGlobal')}</option>
          </select>
        </div>
        {scope === 'guild' && (
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">{t('labelGuildId')}</label>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder={t('phGuildId')}
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('labelOptionsJson')}</label>
        <textarea
          className="h-32 w-full rounded border px-3 py-2 font-mono text-sm"
          value={optionsJson}
          onChange={(e) => setOptionsJson(e.target.value)}
        />
      </div>

      <button
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? t('submitLoading') : t('submitCreate')}
      </button>

      {result && (
        <pre className="whitespace-pre-wrap rounded bg-gray-100 p-3 text-sm">{result}</pre>
      )}
    </div>
  );
}
