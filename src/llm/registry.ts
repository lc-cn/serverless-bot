import type { LlmVendorAdapter } from './types';
import { OpenAiCompatibleAdapter } from './adapters/openai-compatible';
import { LLM_VENDOR_OPTIONS } from './vendor-catalog';

const adapters: LlmVendorAdapter[] = LLM_VENDOR_OPTIONS.map(
  (v) => new OpenAiCompatibleAdapter(v.id)
);

const byKind = new Map<string, LlmVendorAdapter>(adapters.map((a) => [a.vendorKind, a]));

export function getLlmAdapter(vendorKind: string): LlmVendorAdapter {
  const a = byKind.get(vendorKind);
  if (!a) {
    throw new Error(`Unknown LLM vendor kind: ${vendorKind}`);
  }
  return a;
}

export function listLlmVendorKinds(): { id: string; label: string; hint?: string }[] {
  return LLM_VENDOR_OPTIONS.map(({ id, label, hint }) => ({ id, label, hint }));
}
