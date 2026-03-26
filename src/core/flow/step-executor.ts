import type { FlowAction, Step } from '@/types';
import type { JobContext, StepResult } from './types';
import { runToolImplementationSteps as runToolStepsImpl } from './step-tool-implementation';
import { executeCallApi, executeCallBot } from './step-handlers/network';
import {
  executeSendMessage,
  executeHardcode,
  executeRandomReply,
  executeTemplateMessage,
  executeForwardMessage,
} from './step-handlers/messaging';
import { executeLog, executeGetUserInfo, executeGetGroupInfo } from './step-handlers/log-users';
import { executeSetVariable, executeConditional, executeDelay } from './step-handlers/control';
import { executeHandleRequest, executeRecallMessage } from './step-handlers/request-recall';
import { executeExtractData } from './step-handlers/extract';
import {
  executeParseJson,
  executeStringifyJson,
  executeBase64Encode,
  executeBase64Decode,
  executeUrlEncode,
  executeUrlDecode,
} from './step-handlers/codec';
import { executeLlmAgent } from './step-handlers/llm-agent';

/**
 * Step 执行器（分发到 step-handlers/*）
 */
export class StepExecutor {
  static async execute(step: Step, context: JobContext): Promise<StepResult> {
    const startTime = Date.now();
    const action = step as FlowAction;

    console.debug('[Step] Start', {
      jobId: context.job.id,
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      config: step.config,
      availableVariables:
        Object.keys(context.variables).length > 0
          ? Object.entries(context.variables).map(([k, v]) => {
              if (typeof v === 'object' && v !== null) {
                return `${k}: ${JSON.stringify(v).substring(0, 100)}...`;
              }
              return `${k}: ${String(v).substring(0, 100)}`;
            })
          : ['(no variables yet)'],
      stepResults: context.stepResults.length,
    });

    try {
      let data: unknown;

      switch (step.type) {
        case 'call_api':
          data = await executeCallApi(action, context);
          break;
        case 'call_bot':
          data = await executeCallBot(action, context);
          break;
        case 'send_message':
          data = await executeSendMessage(action, context);
          break;
        case 'hardcode':
          data = await executeHardcode(action, context);
          break;
        case 'log':
          data = await executeLog(action, context);
          break;
        case 'get_user_info':
          data = await executeGetUserInfo(action, context);
          break;
        case 'get_group_info':
          data = await executeGetGroupInfo(action, context);
          break;
        case 'set_variable':
          data = await executeSetVariable(action, context);
          break;
        case 'conditional':
          data = await executeConditional(action, context);
          break;
        case 'delay':
          data = await executeDelay(action, context);
          break;
        case 'random_reply':
          data = await executeRandomReply(action, context);
          break;
        case 'template_message':
          data = await executeTemplateMessage(action, context);
          break;
        case 'forward_message':
          data = await executeForwardMessage(action, context);
          break;
        case 'handle_request':
          data = await executeHandleRequest(action, context);
          break;
        case 'recall_message':
          data = await executeRecallMessage(action, context);
          break;
        case 'extract_data':
          data = await executeExtractData(action, context);
          break;
        case 'llm_agent':
          data = await executeLlmAgent(action, context, (steps, parent, args) =>
            runToolStepsImpl((s, c) => StepExecutor.execute(s, c), steps, parent, args)
          );
          break;
        case 'parse_json':
          data = executeParseJson(action, context);
          break;
        case 'stringify_json':
          data = executeStringifyJson(action, context);
          break;
        case 'base64_encode':
          data = executeBase64Encode(action, context);
          break;
        case 'base64_decode':
          data = executeBase64Decode(action, context);
          break;
        case 'url_encode':
          data = executeUrlEncode(action, context);
          break;
        case 'url_decode':
          data = executeUrlDecode(action, context);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      return {
        stepId: step.id,
        success: true,
        data,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  static async runToolImplementationSteps(
    steps: Step[],
    parentContext: JobContext,
    toolArgs: Record<string, unknown>
  ): Promise<{ ok: boolean; payload: string }> {
    return runToolStepsImpl((s, c) => StepExecutor.execute(s, c), steps, parentContext, toolArgs);
  }
}
