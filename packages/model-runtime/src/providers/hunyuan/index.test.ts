// @vitest-environment node
import { LobeOpenAICompatibleRuntime } from '@lobechat/model-runtime';
import { ModelProvider } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testProvider } from '../../providerTestUtils';
import { LobeHunyuanAI, params } from './index';

testProvider({
  Runtime: LobeHunyuanAI,
  provider: ModelProvider.Hunyuan,
  defaultBaseURL: 'https://api.hunyuan.cloud.tencent.com/v1',
  chatDebugEnv: 'DEBUG_HUNYUAN_CHAT_COMPLETION',
  chatModel: 'hunyuan-lite',
});

vi.spyOn(console, 'error').mockImplementation(() => {});

let instance: LobeOpenAICompatibleRuntime;

beforeEach(() => {
  instance = new LobeHunyuanAI({ apiKey: 'test' });
  vi.spyOn(instance['client'].chat.completions, 'create').mockResolvedValue(
    new ReadableStream() as any,
  );
});

describe('LobeHunyuanAI', () => {
  describe('chat', () => {
    it('should emit grounding events when search is enabled', async () => {
      const data = [
        {
          id: 'chunk-1',
          object: 'chat.completion.chunk',
          created: 1741000456,
          model: 'hunyuan-turbo',
          system_fingerprint: '',
          choices: [
            {
              index: 0,
              delta: { role: 'assistant', content: '为您' },
              finish_reason: null,
            },
          ],
          note: '以上内容为AI生成，不代表开发者立场，请勿删除或修改本标记',
          search_info: {
            search_results: [
              {
                index: 1,
                title: 'Example article',
                url: 'https://example.com/1',
                icon: 'https://example.com/icon1.png',
                text: 'Example 1',
              },
              {
                index: 2,
                title: 'Example article 2',
                url: 'https://example.com/2',
                icon: 'https://example.com/icon2.png',
                text: 'Example 2',
              },
            ],
          },
        },
        {
          id: 'chunk-1',
          object: 'chat.completion.chunk',
          created: 1741000456,
          model: 'hunyuan-turbo',
          system_fingerprint: '',
          choices: [
            {
              index: 0,
              delta: { role: 'assistant', content: '找到' },
              finish_reason: null,
            },
          ],
        },
      ];

      const mockStream = new ReadableStream({
        start(controller) {
          data.forEach((chunk) => controller.enqueue(chunk));
          controller.close();
        },
      });

      vi.spyOn(instance['client'].chat.completions, 'create').mockResolvedValue(mockStream as any);

      const result = await instance.chat({
        messages: [{ content: 'Hello', role: 'user' }],
        model: 'hunyuan-turbo',
        temperature: 0,
      });

      const decoder = new TextDecoder();
      const reader = result.body!.getReader();
      const chunks: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      expect(chunks.some((chunk) => chunk.includes('event: grounding'))).toBe(true);
    });
  });
});

describe('LobeHunyuanAI - custom features', () => {
  describe('Debug Configuration', () => {
    it('should disable debug by default', () => {
      delete process.env.DEBUG_HUNYUAN_CHAT_COMPLETION;
      const result = params.debug.chatCompletion();
      expect(result).toBe(false);
    });

    it('should enable debug when env is set', () => {
      process.env.DEBUG_HUNYUAN_CHAT_COMPLETION = '1';
      const result = params.debug.chatCompletion();
      expect(result).toBe(true);
      delete process.env.DEBUG_HUNYUAN_CHAT_COMPLETION;
    });
  });

  describe('handlePayload', () => {
    const handlePayload = params.chatCompletion.handlePayload!;

    it('should remove penalties from payload', () => {
      const payload = {
        model: 'hunyuan-lite',
        messages: [{ role: 'user', content: 'test' }],
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
        temperature: 0.7,
      } as any;

      const result = handlePayload(payload);

      expect(result.frequency_penalty).toBeUndefined();
      expect(result.presence_penalty).toBeUndefined();
      expect(result.stream).toBe(true);
      expect(result.temperature).toBe(0.7);
    });

    it('should add search params when enabledSearch is true', () => {
      const payload = {
        model: 'hunyuan-turbo',
        messages: [{ role: 'user', content: 'test' }],
        enabledSearch: true,
      } as any;

      const result = handlePayload(payload);

      expect(result.citation).toBe(true);
      expect(result.enable_enhancement).toBe(true);
      expect(result.search_info).toBe(true);
    });

    it('should respect speed search env', () => {
      process.env.HUNYUAN_ENABLE_SPEED_SEARCH = '1';
      const payload = {
        model: 'hunyuan-turbo',
        messages: [{ role: 'user', content: 'test' }],
        enabledSearch: true,
      } as any;

      const result = handlePayload(payload);
      expect(result.enable_speed_search).toBe(true);
      delete process.env.HUNYUAN_ENABLE_SPEED_SEARCH;
    });

    it('should handle thinking flag for hunyuan-a13b', () => {
      const payload = {
        model: 'hunyuan-a13b',
        messages: [{ role: 'user', content: 'test' }],
        thinking: { type: 'enabled' },
      } as any;

      const result = handlePayload(payload);
      expect(result.enable_thinking).toBe(true);
    });
  });

  describe('models', () => {
    const mockClient = {
      models: {
        list: vi.fn(),
      },
    } as any;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should detect function call models', async () => {
      mockClient.models.list.mockResolvedValue({
        data: [{ id: 'hunyuan-functioncall' }, { id: 'hunyuan-turbo' }, { id: 'hunyuan-pro' }],
      });

      const models = await params.models({ client: mockClient });
      expect(models.filter((m) => m.functionCall)).toHaveLength(3);
    });

    it('should merge known models from default list', async () => {
      mockClient.models.list.mockResolvedValue({
        data: [{ id: 'hunyuan-lite' }],
      });

      const models = await params.models({ client: mockClient });
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('hunyuan-lite');
    });
  });
});
