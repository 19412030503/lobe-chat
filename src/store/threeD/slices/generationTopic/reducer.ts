import { produce } from 'immer';

import { UpdateTopicValue } from '@/server/routers/lambda/generationTopic';
import { ImageGenerationTopic } from '@/types/generation';

interface AddGenerationTopicAction {
  type: 'addTopic';
  value: Partial<ImageGenerationTopic> & { id: string };
}

interface UpdateGenerationTopicAction {
  id: string;
  type: 'updateTopic';
  value: UpdateTopicValue;
}

interface DeleteGenerationTopicAction {
  id: string;
  type: 'deleteTopic';
}

export type GenerationTopicDispatch =
  | AddGenerationTopicAction
  | UpdateGenerationTopicAction
  | DeleteGenerationTopicAction;

export const generationTopicReducer = (
  state: ImageGenerationTopic[] = [],
  payload: GenerationTopicDispatch,
): ImageGenerationTopic[] => {
  switch (payload.type) {
    case 'addTopic': {
      return produce(state, (draftState) => {
        const now = new Date();
        draftState.unshift({
          coverUrl: payload.value.coverUrl || null,
          createdAt: payload.value.createdAt || now,
          title: payload.value.title || null,
          updatedAt: payload.value.updatedAt || now,
          ...payload.value,
        });
      });
    }

    case 'updateTopic': {
      return produce(state, (draftState) => {
        const index = draftState.findIndex((t) => t.id === payload.id);
        if (index !== -1) {
          draftState[index] = { ...draftState[index], ...payload.value };
        }
      });
    }

    case 'deleteTopic': {
      return produce(state, (draftState) => {
        return draftState.filter((t) => t.id !== payload.id);
      });
    }

    default: {
      return state;
    }
  }
};
