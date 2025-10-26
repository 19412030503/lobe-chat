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
import {
  AsyncTaskError,
  AsyncTaskErrorType,
  AsyncTaskStatus,
  AsyncTaskType,
} from '@/types/asyncTask';
import { generateUniqueSeeds } from '@/utils/number';

const log = debug('lobe-threed:lambda');

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

    return opts.next({
      ctx: {
        asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
        fileService: new FileService(ctx.serverDB, ctx.userId),
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

export type CreateThreeDServicePayload = z.infer<typeof createThreeDInputSchema>;

export const threeDRouter = router({
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

    try {
      const asyncCaller = await createAsyncCaller({
        jwtPayload: ctx.jwtPayload,
        userId: ctx.userId,
      });

      generationsWithTasks.forEach(({ generation, asyncTaskId }) => {
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
