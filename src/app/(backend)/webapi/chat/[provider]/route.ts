import {
  AGENT_RUNTIME_ERROR_SET,
  ChatCompletionErrorPayload,
  ModelRuntime,
} from '@lobechat/model-runtime';
import type { ChatStreamCallbacks } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { getServerDB } from '@/database/server';
import { createTraceOptions, initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';
import { ModelCreditError, ModelCreditService } from '@/server/services/modelCredit';
import {
  calculateTextCreditsFromUsage,
  estimateTextCredits,
} from '@/server/services/modelCredit/creditCalculator';
import { createAiInfraRepos, resolveModelPricing } from '@/server/services/modelCredit/pricing';
import type { ModelUsage } from '@/types/message';
import { ChatStreamPayload } from '@/types/openai/chat';
import { createErrorResponse } from '@/utils/errorResponse';
import { getTracePayload } from '@/utils/trace';

const mapCreditErrorToChatError = (
  error: ModelCreditError,
): (typeof ChatErrorType)[keyof typeof ChatErrorType] => {
  switch (error.code) {
    case 'ORGANIZATION_CREDIT_INSUFFICIENT': {
      return ChatErrorType.OrganizationCreditInsufficient;
    }
    case 'MEMBER_QUOTA_EXCEEDED': {
      return ChatErrorType.MemberQuotaExceeded;
    }
    case 'USER_ORGANIZATION_REQUIRED': {
      return ChatErrorType.UserOrganizationRequired;
    }
    default: {
      return ChatErrorType.InternalServerError;
    }
  }
};

const createCreditErrorResponse = (error: ModelCreditError, provider: string) =>
  createErrorResponse(mapCreditErrorToChatError(error), {
    error: { code: error.code, message: error.message },
    provider,
  });

const mergeCallbacks = (
  base: ChatStreamCallbacks | undefined,
  addition: ChatStreamCallbacks,
): ChatStreamCallbacks => ({
  onCompletion: async (payload) => {
    if (addition.onCompletion) await addition.onCompletion(payload);
    if (base?.onCompletion) await base.onCompletion(payload);
  },
  onFinal: async (payload) => {
    if (addition.onFinal) await addition.onFinal(payload);
    if (base?.onFinal) await base.onFinal(payload);
  },
  onStart: async () => {
    if (addition.onStart) await addition.onStart();
    if (base?.onStart) await base.onStart();
  },
  onToolsCalling: async (payload) => {
    if (addition.onToolsCalling) await addition.onToolsCalling(payload);
    if (base?.onToolsCalling) await base.onToolsCalling(payload);
  },
});

export const maxDuration = 300;

export const POST = checkAuth(async (req: Request, { params, jwtPayload, createRuntime }) => {
  const { provider } = await params;

  if (!jwtPayload.userId) {
    return createErrorResponse(ChatErrorType.UserOrganizationRequired, {
      error: { code: 'USER_ID_MISSING', message: 'User identifier is required for credit checks' },
      provider,
    });
  }

  try {
    // ============  1. init chat model   ============ //
    let modelRuntime: ModelRuntime;
    if (createRuntime) {
      modelRuntime = createRuntime(jwtPayload);
    } else {
      modelRuntime = await initModelRuntimeWithUserPayload(provider, jwtPayload);
    }

    // ============  2. prepare pricing & credit service   ============ //
    const db = await getServerDB();
    const creditService = new ModelCreditService(db);
    const aiInfraRepos = await createAiInfraRepos(db, jwtPayload.userId);

    // ============  3. create chat completion   ============ //

    const data = (await req.json()) as ChatStreamPayload;
    const pricing = await resolveModelPricing(aiInfraRepos, provider, data.model);

    const estimatedCredits = estimateTextCredits(data, pricing);

    let allowanceContext;
    try {
      allowanceContext = await creditService.ensureAllowance({
        requiredCredits: estimatedCredits,
        userId: jwtPayload.userId,
      });
    } catch (error) {
      if (error instanceof ModelCreditError) {
        return createCreditErrorResponse(error, provider);
      }
      throw error;
    }

    const tracePayload = getTracePayload(req);

    let finalUsage: ModelUsage | undefined;
    const usageCapture: ChatStreamCallbacks = {
      onCompletion: async ({ usage }) => {
        finalUsage = usage as ModelUsage | undefined;
      },
    };

    let traceOptions: Record<string, unknown> = {};
    // If user enable trace
    if (tracePayload?.enabled) {
      traceOptions = createTraceOptions(data, { provider, trace: tracePayload });
    }

    const mergedCallbacks = mergeCallbacks(
      (traceOptions.callback as ChatStreamCallbacks | undefined) ?? undefined,
      usageCapture,
    );

    traceOptions = { ...traceOptions, callback: mergedCallbacks };

    const response = await modelRuntime.chat(data, {
      user: jwtPayload.userId,
      ...traceOptions,
      signal: req.signal,
    });

    const creditsToCharge = finalUsage
      ? calculateTextCreditsFromUsage(finalUsage, pricing)
      : estimatedCredits;

    try {
      const chargeResult = await creditService.charge(
        {
          credits: creditsToCharge,
          organizationId: allowanceContext.organizationId,
          reason: 'chat_completion',
          usage: {
            inputTokens: finalUsage?.totalInputTokens ?? finalUsage?.inputTextTokens ?? undefined,
            metadata: {
              actualCredits: creditsToCharge,
              estimatedCredits,
            },
            model: data.model,
            outputTokens: finalUsage?.totalOutputTokens ?? finalUsage?.outputTextTokens,
            provider,
            totalTokens: finalUsage?.totalTokens,
            usageType: 'text',
          },
          userId: jwtPayload.userId,
        },
        allowanceContext,
      );

      allowanceContext = {
        memberQuota: chargeResult.memberQuota,
        organization: chargeResult.organization,
        organizationId: allowanceContext.organizationId,
      };
    } catch (error) {
      if (error instanceof ModelCreditError) {
        return createCreditErrorResponse(error, provider);
      }
      throw error;
    }

    return response;
  } catch (e) {
    if (e instanceof ModelCreditError) {
      return createCreditErrorResponse(e, provider);
    }

    const {
      errorType = ChatErrorType.InternalServerError,
      error: errorContent,
      ...res
    } = e as ChatCompletionErrorPayload;

    const error = errorContent || e;

    const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';
    // track the error at server side
    console[logMethod](`Route: [${provider}] ${errorType}:`, error);

    return createErrorResponse(errorType, { error, ...res, provider });
  }
});
