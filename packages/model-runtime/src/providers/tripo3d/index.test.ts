// @vitest-environment node
import { ModelProvider } from 'model-bank';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeTripo3DAI, params } from './index';

const buildJsonResponse = (body: unknown, init: ResponseInit = { status: 200 }) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

describe('LobeTripo3DAI', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      // @ts-expect-error reset fetch
      delete global.fetch;
    }
  });

  it('should expose provider metadata', () => {
    expect(params.provider).toBe(ModelProvider.Tripo3D);
    expect(params.baseURL).toBe('https://api.tripo3d.ai/v2/openapi');
  });

  it('submits text_to_model tasks and resolves output', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        buildJsonResponse({ code: 0, data: { task_id: 'task-text-001' } }, { status: 200 }),
      )
      .mockResolvedValueOnce(
        buildJsonResponse(
          {
            code: 0,
            data: {
              status: 'success',
              output: {
                model: { url: 'https://tripo.cdn/model.glb', format: 'glb' },
                rendered_image: ['https://tripo.cdn/preview.png'],
              },
            },
          },
          { status: 200 },
        ),
      );
    global.fetch = fetchMock as any;

    const runtime = new LobeTripo3DAI({ apiKey: 'test-api-key' });
    const result = await runtime.create3DModel!({
      model: 'tripo3d-v2-5-20250123',
      params: {
        prompt: 'a tiny robot',
        geometryQuality: 'detailed',
      } as any,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.tripo3d.ai/v2/openapi/task',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
      }),
    );
    const submittedBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(submittedBody).toMatchObject({
      type: 'text_to_model',
      prompt: 'a tiny robot',
      model_version: 'v2.5-20250123',
      geometry_quality: 'detailed',
    });
    expect(submittedBody).not.toHaveProperty('result_format');

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.tripo3d.ai/v2/openapi/task/task-text-001',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
      }),
    );

    expect(result).toEqual({
      format: 'GLB',
      jobId: 'task-text-001',
      modelUrl: 'https://tripo.cdn/model.glb',
      modelUsage: undefined,
      previewUrl: 'https://tripo.cdn/preview.png',
    });
  });

  it('submits image_to_model tasks with file url', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        buildJsonResponse({ code: 0, data: { task_id: 'task-image-001' } }, { status: 200 }),
      )
      .mockResolvedValueOnce(
        buildJsonResponse(
          {
            code: 0,
            data: {
              status: 'success',
              output: {
                pbr_model: { url: 'https://tripo.cdn/model-pbr.fbx', format: 'fbx' },
              },
            },
          },
          { status: 200 },
        ),
      );
    global.fetch = fetchMock as any;

    const runtime = new LobeTripo3DAI({ apiKey: 'test-api-key' });
    const result = await runtime.create3DModel!({
      model: 'tripo3d-v3-20250812',
      params: {
        imageUrl: 'https://example.com/cat.png',
        imageFileType: 'png',
        prompt: 'cute cat',
        generateParts: true,
        resultFormat: 'fbx',
      } as any,
    });

    const submittedBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(submittedBody).toMatchObject({
      type: 'image_to_model',
      model_version: 'v3.0-20250812',
      prompt: 'cute cat',
      generate_parts: true,
      texture: false,
      pbr: false,
      quad: false,
      file: {
        type: 'png',
        url: 'https://example.com/cat.png',
      },
    });
    expect(submittedBody).not.toHaveProperty('result_format');

    expect(result).toEqual({
      format: 'FBX',
      jobId: 'task-image-001',
      modelUrl: 'https://tripo.cdn/model-pbr.fbx',
      modelUsage: undefined,
      previewUrl: undefined,
    });
  });

  it('throws when task finishes with failure status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        buildJsonResponse({ code: 0, data: { task_id: 'task-failed-001' } }, { status: 200 }),
      )
      .mockResolvedValueOnce(
        buildJsonResponse(
          {
            code: 0,
            data: {
              status: 'failed',
              message: 'generation failed',
            },
          },
          { status: 200 },
        ),
      );
    global.fetch = fetchMock as any;

    const runtime = new LobeTripo3DAI({ apiKey: 'test-api-key' });

    await expect(
      runtime.create3DModel!({
        model: 'tripo3d-v2-5-20250123',
        params: { prompt: 'broken' } as any,
      }),
    ).rejects.toThrow(/generation failed/);
  });

  it('throws when API key is missing', async () => {
    const runtime = new LobeTripo3DAI({});
    await expect(
      runtime.create3DModel!({
        model: 'tripo3d-v2-5-20250123',
        params: { prompt: 'hello' } as any,
      }),
    ).rejects.toThrow('Missing Tripo 3D API key');
  });
});
