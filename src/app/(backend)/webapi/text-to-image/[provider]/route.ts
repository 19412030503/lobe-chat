import { ChatCompletionErrorPayload, TextToImagePayload } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { NextResponse } from 'next/server';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { getServerDB } from '@/database/server';
import { initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';
import { ModelCreditError, ModelCreditService } from '@/server/services/modelCredit';
import { calculateImageCredits } from '@/server/services/modelCredit/creditCalculator';
import { createAiInfraRepos, resolveModelPricing } from '@/server/services/modelCredit/pricing';
import { createErrorResponse } from '@/utils/errorResponse';

export const preferredRegion = [
  'arn1',
  'bom1',
  'cdg1',
  'cle1',
  'cpt1',
  'dub1',
  'fra1',
  'gru1',
  'hnd1',
  'iad1',
  'icn1',
  'kix1',
  'lhr1',
  'pdx1',
  'sfo1',
  'sin1',
  'syd1',
];

// return NextResponse.json(
//   {
//     body: {
//       endpoint: 'https://ai****ix.com/v1',
//       error: {
//         code: 'content_policy_violation',
//         message:
//           'Your request was rejected as a result of our safety system. Image descriptions generated from your prompt may contain text that is not allowed by our safety system. If you believe this was done in error, your request may succeed if retried, or by adjusting your prompt.',
//         param: null,
//         type: 'invalid_request_error',
//       },
//       provider: 'openai',
//     },
//     errorType: 'OpenAIBizError',
//   },
//   { status: 400 },
// );

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

export const POST = checkAuth(async (req: Request, { params, jwtPayload }) => {
  const { provider } = await params;

  try {
    if (!jwtPayload.userId) {
      return createCreditErrorResponse(
        new ModelCreditError('USER_ORGANIZATION_REQUIRED', 'User must belong to an organization'),
        provider,
      );
    }
    // ============  1. init chat model   ============ //
    const agentRuntime = await initModelRuntimeWithUserPayload(provider, jwtPayload);

    const db = await getServerDB();
    const creditService = new ModelCreditService(db);
    const aiInfraRepos = await createAiInfraRepos(db, jwtPayload.userId);

    // ============  2. create image generation   ============ //
    const data = (await req.json()) as TextToImagePayload;
    const pricing = await resolveModelPricing(aiInfraRepos, provider, data.model);

    const requestedCount = data.n ?? 1;
    const estimatedCredits = calculateImageCredits(requestedCount, pricing);

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

    const images = await agentRuntime.textToImage(data);

    const actualCount = Array.isArray(images) ? images.length : requestedCount;
    const actualCredits = calculateImageCredits(actualCount, pricing);

    try {
      await creditService.charge(
        {
          credits: actualCredits,
          organizationId: allowanceContext.organizationId,
          reason: 'image_generation',
          usage: {
            countUsed: actualCount,
            metadata: {
              actualCredits,
              estimatedCredits,
            },
            model: data.model,
            provider,
            usageType: 'image',
          },
          userId: jwtPayload.userId,
        },
        allowanceContext,
      );
    } catch (error) {
      if (error instanceof ModelCreditError) {
        return createCreditErrorResponse(error, provider);
      }
      throw error;
    }

    return NextResponse.json(images);
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
    // track the error at server side
    console.error(`Route: [${provider}] ${errorType}:`, error);

    return createErrorResponse(errorType, { error, ...res, provider });
  }
});
