import { NextResponse } from 'next/server';

/** 全站 API 错误 JSON（含沙盒、鉴权等）统一形态 */
export const API_WIRE_VERSION = 1 as const;

export type ApiWireErrorBody = {
  v: typeof API_WIRE_VERSION;
  error: { code: string; message: string };
};

export function jsonApiError(status: number, code: string, message: string): NextResponse {
  const body: ApiWireErrorBody = {
    v: API_WIRE_VERSION,
    error: { code, message },
  };
  return NextResponse.json(body, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** 客户端解析标准错误体 */
export function readApiErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (o.v !== API_WIRE_VERSION || !o.error || typeof o.error !== 'object') return null;
  const e = o.error as Record<string, unknown>;
  const msg = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  if (!msg) return null;
  return code ? `[${code}] ${msg}` : msg;
}
