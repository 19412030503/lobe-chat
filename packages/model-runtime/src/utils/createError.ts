import {
  AgentInitErrorPayload,
  ChatCompletionErrorPayload,
  Create3DModelErrorPayload,
  CreateImageErrorPayload,
} from '../types';
import { ILobeAgentRuntimeErrorType } from '../types/error';

export const AgentRuntimeError = {
  chat: (error: ChatCompletionErrorPayload): ChatCompletionErrorPayload => error,
  create3DModel: (error: Create3DModelErrorPayload): Create3DModelErrorPayload => error,
  createError: (
    errorType: ILobeAgentRuntimeErrorType | string | number,
    error?: any,
  ): AgentInitErrorPayload => ({ error, errorType }),
  createImage: (error: CreateImageErrorPayload): CreateImageErrorPayload => error,
  textToImage: (error: any): any => error,
};
