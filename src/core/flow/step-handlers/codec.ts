import type { FlowAction } from '@/types';
import type { JobContext } from '../types';
import { getValueByPath, interpolate } from '../step-template';

function utf8ToBase64(s: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(s, 'utf8').toString('base64');
  }
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin);
}

function utf8FromBase64(s: string): string {
  const t = s.trim();
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(t, 'base64').toString('utf8');
  }
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function executeParseJson(action: FlowAction, context: JobContext): unknown {
  const config = action.config as {
    source: string;
    saveAs: string;
    optional?: boolean;
  };
  const raw = interpolate(String(config.source ?? ''), context).trim();
  const saveAs = (interpolate(String(config.saveAs ?? 'parsed'), context).trim() || 'parsed');
  const optional = config.optional === true;
  try {
    const parsed = JSON.parse(raw);
    context.variables[saveAs] = parsed;
    return { type: 'parse_json', saveAs, ok: true };
  } catch (e) {
    if (optional) {
      context.variables[saveAs] = null;
      return { type: 'parse_json', saveAs, ok: false, skipped: true };
    }
    throw new Error(`parse_json: invalid JSON — ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function executeStringifyJson(action: FlowAction, context: JobContext): unknown {
  const config = action.config as {
    variablePath: string;
    pretty?: boolean;
    saveAs?: string;
  };
  const path = interpolate(String(config.variablePath ?? ''), context).trim();
  if (!path) {
    throw new Error('stringify_json: variablePath is required');
  }
  const value = getValueByPath(context, path);
  if (value === undefined) {
    throw new Error(`stringify_json: value is undefined for path: ${path}`);
  }
  let str: string;
  try {
    str = config.pretty === true ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  } catch (e) {
    throw new Error(`stringify_json: cannot serialize — ${e instanceof Error ? e.message : String(e)}`);
  }
  const saveAs = (interpolate(String(config.saveAs ?? 'toolResult'), context).trim() || 'toolResult');
  context.variables[saveAs] = str;
  return { type: 'stringify_json', saveAs, length: str.length };
}

export function executeBase64Encode(action: FlowAction, context: JobContext): unknown {
  const config = action.config as { source: string; saveAs: string };
  const src = interpolate(String(config.source ?? ''), context);
  const saveAs = (interpolate(String(config.saveAs ?? 'encoded'), context).trim() || 'encoded');
  context.variables[saveAs] = utf8ToBase64(src);
  return { type: 'base64_encode', saveAs };
}

export function executeBase64Decode(action: FlowAction, context: JobContext): unknown {
  const config = action.config as { source: string; saveAs: string };
  const src = interpolate(String(config.source ?? ''), context);
  const saveAs = (interpolate(String(config.saveAs ?? 'decodedText'), context).trim() || 'decodedText');
  try {
    context.variables[saveAs] = utf8FromBase64(src);
    return { type: 'base64_decode', saveAs };
  } catch (e) {
    throw new Error(`base64_decode: invalid input — ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function executeUrlEncode(action: FlowAction, context: JobContext): unknown {
  const config = action.config as { source: string; saveAs: string };
  const src = interpolate(String(config.source ?? ''), context);
  const saveAs = (interpolate(String(config.saveAs ?? 'encodedQuery'), context).trim() || 'encodedQuery');
  context.variables[saveAs] = encodeURIComponent(src);
  return { type: 'url_encode', saveAs };
}

export function executeUrlDecode(action: FlowAction, context: JobContext): unknown {
  const config = action.config as { source: string; saveAs: string };
  const src = interpolate(String(config.source ?? ''), context);
  const saveAs = (interpolate(String(config.saveAs ?? 'decodedQuery'), context).trim() || 'decodedQuery');
  try {
    context.variables[saveAs] = decodeURIComponent(src);
    return { type: 'url_decode', saveAs };
  } catch (e) {
    throw new Error(`url_decode: invalid percent-encoding — ${e instanceof Error ? e.message : String(e)}`);
  }
}
