import type { FlowAction, MessageEvent, NoticeEvent, RequestEvent } from '@/types';
import type { JobContext } from '../types';
import { getValueByPath, interpolate } from '../step-template';

function extractEventTextForData(context: JobContext): string {
  const ev = context.event;
  if (ev.type === 'message') {
    return String((ev as MessageEvent).rawContent ?? '');
  }
  if (ev.type === 'request') {
    return String((ev as RequestEvent).comment ?? '');
  }
  if (ev.type === 'notice') {
    return String((ev as NoticeEvent).subType ?? '');
  }
  return '';
}

export async function executeExtractData(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    source?: string;
    variablePath?: string;
    extractionType?: 'regex' | 'jsonpath';
    pattern: string;
    saveAs: string;
    multiple?: boolean;
    captureGroups?: Record<string, string> | string;
  };

  const src = config.source ?? 'message';
  let sourceText: string;
  if (src === 'message') {
    sourceText = extractEventTextForData(context);
  } else if (src === 'variable') {
    const path = interpolate(String(config.variablePath ?? ''), context);
    sourceText = String(getValueByPath(context, path) ?? '');
  } else {
    sourceText = String(getValueByPath(context, interpolate(src, context)) ?? '');
  }

  const mode = config.extractionType ?? 'regex';

  let groupsMap: Record<string, string> = {};
  if (config.captureGroups) {
    try {
      groupsMap =
        typeof config.captureGroups === 'string'
          ? (JSON.parse(config.captureGroups) as Record<string, string>)
          : config.captureGroups;
    } catch {
      groupsMap = {};
    }
  }

  if (mode === 'regex') {
    const regex = new RegExp(config.pattern, config.multiple ? 'g' : '');
    if (config.multiple) {
      const matches = [...sourceText.matchAll(regex as RegExp)];
      const extracted = matches.map((m) => m[1] || m[0]);
      context.variables[config.saveAs] = extracted;
      return { extracted, count: extracted.length };
    }
    const match = regex.exec(sourceText);
    const extracted = match ? match[1] || match[0] : null;
    context.variables[config.saveAs] = extracted;
    if (match && Object.keys(groupsMap).length > 0) {
      for (const [idx, varName] of Object.entries(groupsMap)) {
        const i = parseInt(idx, 10);
        if (!Number.isNaN(i) && match[i] !== undefined) {
          context.variables[varName] = match[i];
        }
      }
    }
    return { extracted };
  }

  if (mode === 'jsonpath') {
    try {
      const data = JSON.parse(sourceText);
      const value = getValueByPath(data, config.pattern);
      context.variables[config.saveAs] = value;
      return { extracted: value };
    } catch (error) {
      throw new Error(`JSONPath extraction failed: ${error}`);
    }
  }

  return null;
}
