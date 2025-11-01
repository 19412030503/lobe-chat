import { TRPCError } from '@trpc/server';
import debug from 'debug';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import {
  NewGeneration,
  NewGenerationBatch,
  asyncTasks,
  generationBatches,
  generations,
} from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { keyVaults, serverDatabase } from '@/libs/trpc/lambda/middleware';
import { createAsyncCaller } from '@/server/routers/async/caller';
import { FileService } from '@/server/services/file';
import { ModelCreditError, ModelCreditService } from '@/server/services/modelCredit';
import { calculateThreeDCredits } from '@/server/services/modelCredit/creditCalculator';
import { createAiInfraRepos, resolveModelPricing } from '@/server/services/modelCredit/pricing';
import {
  AsyncTaskError,
  AsyncTaskErrorType,
  AsyncTaskStatus,
  AsyncTaskType,
} from '@/types/asyncTask';
import { generateUniqueSeeds } from '@/utils/number';

const log = debug('lobe-threed:lambda');

const toTRPCCreditError = (error: ModelCreditError) =>
  new TRPCError({ code: 'FORBIDDEN', message: error.message });

const validateNoUrlsInConfig = (obj: any, path: string = ''): void => {
  if (typeof obj === 'string') {
    if (obj.startsWith('http://') || obj.startsWith('https://')) {
      throw new Error(
        `Invalid configuration: Found full URL instead of key at ${path || 'root'}. ` +
          `URL: "${obj.slice(0, 100)}${obj.length > 100 ? '...' : ''}". ` +
          `All URLs must be converted to storage keys before database insertion.`,
      );
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => validateNoUrlsInConfig(item, `${path}[${index}]`));
  } else if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;
      validateNoUrlsInConfig(value, currentPath);
    });
  }
};

const threeDProcedure = authedProcedure
  .use(keyVaults)
  .use(serverDatabase)
  .use(async (opts) => {
    const { ctx } = opts;
    const creditService = new ModelCreditService(ctx.serverDB);
    const aiInfraRepos = await createAiInfraRepos(ctx.serverDB, ctx.userId);

    return opts.next({
      ctx: {
        aiInfraRepos,
        asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
        creditService,
        fileService: new FileService(ctx.serverDB, ctx.userId),
        userId: ctx.userId,
      },
    });
  });

const createThreeDInputSchema = z.object({
  generationTopicId: z.string(),
  model: z.string(),
  modelNum: z.number().min(1).max(4).default(1).optional(),
  params: z
    .object({
      height: z.number().optional(),
      imageUrl: z.string().nullable().optional(),
      imageUrls: z.array(z.string()).optional(),
      prompt: z.string(),
      seed: z.number().nullable().optional(),
      width: z.number().optional(),
    })
    .passthrough(),
  provider: z.string(),
});

const convertThreeDInputSchema = z.object({
  model: z.string(),
  params: z
    .object({
      format: z.string(),
    })
    .passthrough(),
  provider: z.string(),
  sourceGenerationId: z.string(),
});

export type CreateThreeDServicePayload = z.infer<typeof createThreeDInputSchema>;
export type ConvertThreeDServicePayload = z.infer<typeof convertThreeDInputSchema>;

export const threeDRouter = router({
  convertModel: threeDProcedure.input(convertThreeDInputSchema).mutation(async ({ ctx, input }) => {
    const { asyncTaskModel, serverDB, userId } = ctx;
    const { sourceGenerationId, params, provider, model } = input;

    log('Starting 3D conversion process, input: %O', input);

    const sourceGeneration = await serverDB.query.generations.findFirst({
      where: and(eq(generations.id, sourceGenerationId), eq(generations.userId, userId)),
    });

    if (!sourceGeneration) {
      throw new Error(`Source generation ${sourceGenerationId} not found or not owned by user`);
    }

    const sourceBatch = await serverDB.query.generationBatches.findFirst({
      where: and(
        eq(generationBatches.id, sourceGeneration.generationBatchId),
        eq(generationBatches.userId, userId),
      ),
    });

    if (!sourceBatch) {
      throw new Error(
        `Generation batch ${sourceGeneration.generationBatchId} not found for conversion`,
      );
    }

    const sourceAsset = sourceGeneration.asset as Record<string, any> | null;
    const resolvedOriginalTaskId =
      (typeof params.originalTaskId === 'string' && params.originalTaskId.trim()) ||
      (typeof sourceAsset?.jobId === 'string' ? sourceAsset.jobId : undefined);

    if (!resolvedOriginalTaskId) {
      throw new Error('Source generation does not contain a jobId; conversion is not supported');
    }

    const conversionParams = {
      ...params,
      originalTaskId: resolvedOriginalTaskId,
    };

    const resolvedProviderId = sourceBatch.provider || provider;
    const resolvedModelId = sourceBatch.model || model;

    const pricing = await resolveModelPricing(
      ctx.aiInfraRepos,
      resolvedProviderId,
      resolvedModelId,
    );
    const creditsRequired = calculateThreeDCredits(1, pricing);

    let allowance;
    try {
      allowance = await ctx.creditService.ensureAllowance({
        requiredCredits: creditsRequired,
        userId,
      });
    } catch (error) {
      if (error instanceof ModelCreditError) {
        throw toTRPCCreditError(error);
      }
      throw error;
    }

    let asyncTaskId: string | undefined;
    let createdGeneration: (NewGeneration & { asyncTaskId: string | null }) | undefined;

    await serverDB.transaction(async (tx) => {
      const [createdAsyncTask] = await tx
        .insert(asyncTasks)
        .values({
          status: AsyncTaskStatus.Pending,
          type: AsyncTaskType.ModelingGeneration,
          userId,
        })
        .returning();

      asyncTaskId = createdAsyncTask.id;

      const [generation] = await tx
        .insert(generations)
        .values({
          generationBatchId: sourceGeneration.generationBatchId,
          seed: null,
          userId,
        })
        .returning();

      await tx
        .update(generations)
        .set({ asyncTaskId })
        .where(and(eq(generations.id, generation.id), eq(generations.userId, userId)));

      createdGeneration = { ...generation, asyncTaskId };
    });

    if (!asyncTaskId || !createdGeneration) {
      throw new Error('Failed to create conversion tasks');
    }

    if (!createdGeneration.id) {
      throw new Error('Failed to resolve generation id for conversion');
    }

    try {
      const asyncCaller = await createAsyncCaller({
        jwtPayload: ctx.jwtPayload,
        userId: ctx.userId,
      });

      await asyncCaller.threeD.convertModel({
        generationId: createdGeneration.id,
        model: resolvedModelId,
        originalTaskId: resolvedOriginalTaskId,
        params: conversionParams,
        provider: resolvedProviderId,
        sourceGenerationId,
        taskId: asyncTaskId,
      });

      await ctx.creditService.charge(
        {
          credits: creditsRequired,
          organizationId: allowance.organizationId,
          reason: 'three_d_conversion',
          usage: {
            countUsed: 1,
            metadata: {
              asyncTaskId,
              sourceGenerationId,
            },
            model: resolvedModelId,
            provider: resolvedProviderId,
            usageType: 'threeD',
          },
          userId,
        },
        allowance,
      );
    } catch (e) {
      if (e instanceof ModelCreditError) {
        throw toTRPCCreditError(e);
      }

      log('Failed to dispatch conversion async task: %O', e);

      await asyncTaskModel.update(asyncTaskId, {
        error: new AsyncTaskError(
          AsyncTaskErrorType.ServerError,
          'start async conversion task error: ' +
            (e instanceof Error ? e.message : 'Unknown error'),
        ),
        status: AsyncTaskStatus.Error,
      });
    }

    return {
      data: {
        generation: createdGeneration,
      },
      success: true,
    };
  }),
  createModel: threeDProcedure.input(createThreeDInputSchema).mutation(async ({ ctx, input }) => {
    const { userId, serverDB, asyncTaskModel, fileService } = ctx;
    const { generationTopicId, provider, model, params } = input;
    const modelNum = input.modelNum ?? 1;

    log('Starting 3D generation process, input: %O', input);

    let configForDatabase = { ...params };

    if (Array.isArray(params.imageUrls) && params.imageUrls.length > 0) {
      try {
        const imageKeys = params.imageUrls.map((url) => fileService.getKeyFromFullUrl(url));
        configForDatabase = {
          ...configForDatabase,
          imageUrls: imageKeys,
        };
      } catch (error) {
        log('Failed to convert imageUrls to keys: %O', error);
      }
    }

    if (typeof params.imageUrl === 'string' && params.imageUrl) {
      try {
        const key = fileService.getKeyFromFullUrl(params.imageUrl);
        configForDatabase = { ...configForDatabase, imageUrl: key };
      } catch (error) {
        log('Failed to convert imageUrl to key: %O', error);
      }
    }

    try {
      validateNoUrlsInConfig(configForDatabase, 'configForDatabase');
    } catch (error) {
      log('Validation failed when checking config URLs: %O', error);
      configForDatabase = { ...params };
    }

    const pricing = await resolveModelPricing(ctx.aiInfraRepos, provider, model);
    const creditsRequired = calculateThreeDCredits(modelNum, pricing);

    let allowance;
    try {
      allowance = await ctx.creditService.ensureAllowance({
        requiredCredits: creditsRequired,
        userId,
      });
    } catch (error) {
      if (error instanceof ModelCreditError) {
        throw toTRPCCreditError(error);
      }
      throw error;
    }

    const { batch: createdBatch, generationsWithTasks } = await serverDB.transaction(async (tx) => {
      const newBatch: NewGenerationBatch = {
        config: configForDatabase,
        generationTopicId,
        height: params.height,
        model,
        prompt: params.prompt,
        provider,
        type: 'threeD',
        userId,
        width: params.width,
      };

      const [batch] = await tx.insert(generationBatches).values(newBatch).returning();

      const seeds =
        'seed' in params && params.seed !== undefined && params.seed !== null
          ? generateUniqueSeeds(modelNum)
          : Array.from({ length: modelNum }, () => null);

      const newGenerations: NewGeneration[] = Array.from({ length: modelNum }, (_, index) => ({
        generationBatchId: batch.id,
        seed: seeds[index],
        userId,
      }));

      const createdGenerations = await tx.insert(generations).values(newGenerations).returning();

      const generationsWithTasks = await Promise.all(
        createdGenerations.map(async (generation) => {
          const [createdAsyncTask] = await tx
            .insert(asyncTasks)
            .values({
              status: AsyncTaskStatus.Pending,
              type: AsyncTaskType.ModelingGeneration,
              userId,
            })
            .returning();

          const asyncTaskId = createdAsyncTask.id;

          await tx
            .update(generations)
            .set({ asyncTaskId })
            .where(and(eq(generations.id, generation.id), eq(generations.userId, userId)));

          return { asyncTaskId, generation };
        }),
      );

      return {
        batch,
        generationsWithTasks,
      };
    });

    log(
      'Created 3D generation batch %s with %d task(s)',
      createdBatch.id,
      generationsWithTasks.length,
    );
    log(
      'Prepared async tasks: %O',
      generationsWithTasks.map(({ asyncTaskId, generation }) => ({
        asyncTaskId,
        generationId: generation.id,
        seed: generation.seed,
      })),
    );

    try {
      const chargeResult = await ctx.creditService.charge(
        {
          credits: creditsRequired,
          organizationId: allowance.organizationId,
          reason: 'three_d_generation',
          usage: {
            countUsed: modelNum,
            metadata: {
              batchId: createdBatch.id,
              generationTopicId,
            },
            model,
            provider,
            usageType: 'threeD',
          },
          userId,
        },
        allowance,
      );

      allowance = {
        memberQuota: chargeResult.memberQuota,
        organization: chargeResult.organization,
        organizationId: allowance.organizationId,
      };
    } catch (error) {
      if (error instanceof ModelCreditError) {
        throw toTRPCCreditError(error);
      }
      throw error;
    }

    try {
      const asyncCaller = await createAsyncCaller({
        jwtPayload: ctx.jwtPayload,
        userId: ctx.userId,
      });

      generationsWithTasks.forEach(({ generation, asyncTaskId }) => {
        log(
          'Dispatching async 3D task %s for generation %s (provider=%s, model=%s)',
          asyncTaskId,
          generation.id,
          provider,
          model,
        );
        asyncCaller.threeD.createModel({
          generationId: generation.id,
          model,
          params,
          provider,
          taskId: asyncTaskId,
        });
      });
    } catch (e) {
      console.error('[createThreeD] Failed to process async tasks:', e);

      await Promise.allSettled(
        generationsWithTasks.map(({ asyncTaskId }) =>
          asyncTaskModel.update(asyncTaskId, {
            error: new AsyncTaskError(
              AsyncTaskErrorType.ServerError,
              'start async task error: ' + (e instanceof Error ? e.message : 'Unknown error'),
            ),
            status: AsyncTaskStatus.Error,
          }),
        ),
      );
    }

    return {
      data: {
        batch: createdBatch,
        generations: generationsWithTasks.map((item) => item.generation),
      },
      success: true,
    };
  }),
});

export type ThreeDRouter = typeof threeDRouter;
