/**
 * This file contains the root router of Lobe Chat tRPC-backend
 */
import { publicProcedure, router } from '@/libs/trpc/lambda';

import { adminUserRouter } from './adminUser';
import { agentRouter } from './agent';
import { aiChatRouter } from './aiChat';
import { aiModelRouter } from './aiModel';
import { aiProviderRouter } from './aiProvider';
import { apiKeyRouter } from './apiKey';
import { chunkRouter } from './chunk';
import { configRouter } from './config';
import { courseRouter } from './course';
import { documentRouter } from './document';
import { exporterRouter } from './exporter';
import { fileRouter } from './file';
import { generationRouter } from './generation';
import { generationBatchRouter } from './generationBatch';
import { generationTopicRouter } from './generationTopic';
import { groupRouter } from './group';
import { imageRouter } from './image';
import { importerRouter } from './importer';
import { inviteRouter } from './invite';
import { knowledgeBaseRouter } from './knowledgeBase';
import { marketRouter } from './market';
import { messageRouter } from './message';
import { organizationRouter } from './organization';
import { pluginRouter } from './plugin';
import { quotaRouter } from './quota';
import { ragEvalRouter } from './ragEval';
import { roleRouter } from './role';
import { sessionRouter } from './session';
import { sessionGroupRouter } from './sessionGroup';
import { threadRouter } from './thread';
import { threeDRouter } from './threeD';
import { topicRouter } from './topic';
import { uploadRouter } from './upload';
import { userRouter } from './user';

export const lambdaRouter = router({
  adminUser: adminUserRouter,
  agent: agentRouter,
  aiChat: aiChatRouter,
  aiModel: aiModelRouter,
  aiProvider: aiProviderRouter,
  apiKey: apiKeyRouter,
  chunk: chunkRouter,
  config: configRouter,
  course: courseRouter,
  document: documentRouter,
  exporter: exporterRouter,
  file: fileRouter,
  generation: generationRouter,
  generationBatch: generationBatchRouter,
  generationTopic: generationTopicRouter,
  group: groupRouter,
  healthcheck: publicProcedure.query(() => "i'm live!"),
  image: imageRouter,
  importer: importerRouter,
  invite: inviteRouter,
  knowledgeBase: knowledgeBaseRouter,
  market: marketRouter,
  message: messageRouter,
  organization: organizationRouter,
  plugin: pluginRouter,
  quota: quotaRouter,
  ragEval: ragEvalRouter,
  role: roleRouter,
  session: sessionRouter,
  sessionGroup: sessionGroupRouter,
  thread: threadRouter,
  threeD: threeDRouter,
  topic: topicRouter,
  upload: uploadRouter,
  user: userRouter,
});

export type LambdaRouter = typeof lambdaRouter;
