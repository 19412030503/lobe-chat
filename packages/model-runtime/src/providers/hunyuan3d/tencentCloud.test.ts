// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTencentCloudCaller } from './tencentCloud';

const mockFetch = vi.fn();

globalThis.fetch = mockFetch as any;

describe('createTencentCloudCaller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HUNYUAN3D_SECRET_ID;
    delete process.env.HUNYUAN3D_SECRET_KEY;
    delete process.env.HUNYUAN3D_VERSION;
    delete process.env.HUNYUAN3D_ENDPOINT;
    delete process.env.HUNYUAN3D_REGION;
    delete process.env.HUNYUAN3D_POLL_INTERVAL;
    delete process.env.HUNYUAN3D_POLL_TIMEOUT;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('throws when credentials are missing', () => {
    expect(() => createTencentCloudCaller()).toThrow();
  });

  it('calls submit and wait successfully with explicit options', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Response: { JobId: 'job-123' } }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Response: {
              ResultFile3Ds: [
                {
                  Type: 'STL',
                  Url: 'https://example.com/model.stl',
                },
              ],
              Status: 'DONE',
            },
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          },
        ),
      );

    const caller = createTencentCloudCaller({
      apiKey: 'custom-secret-key',
      baseURL: 'https://ai3d.tencentcloudapi.com',
      pollInterval: 1,
      pollTimeout: 100,
      region: 'ap-guangzhou',
      secretId: 'custom-secret-id',
      version: '2025-05-13',
    });
    const submitResult = await caller.call('SubmitHunyuanTo3DProJob', {});
    expect(submitResult.Response.JobId).toBe('job-123');

    const queryResult = await caller.waitForJob('job-123', 'QueryHunyuanTo3DProJob');
    const secondCall = mockFetch.mock.calls[1];
    expect(secondCall?.[1]?.headers?.['X-TC-Action']).toBe('QueryHunyuanTo3DProJob');
    expect(queryResult).toEqual({
      format: 'STL',
      jobId: 'job-123',
      modelUrl: 'https://example.com/model.stl',
      modelUsage: undefined,
      previewUrl: undefined,
    });
  });

  it('falls back to environment variables when options are not provided', async () => {
    process.env.HUNYUAN3D_SECRET_ID = 'env-secret-id';
    process.env.HUNYUAN3D_SECRET_KEY = 'env-secret-key';
    process.env.HUNYUAN3D_VERSION = '2025-05-13';
    process.env.HUNYUAN3D_ENDPOINT = 'https://custom.tencentcloudapi.com';
    process.env.HUNYUAN3D_REGION = 'ap-beijing';
    process.env.HUNYUAN3D_POLL_INTERVAL = '5';
    process.env.HUNYUAN3D_POLL_TIMEOUT = '200';

    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Response: { JobId: 'env-job' } }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Response: {
              ModelFormat: 'OBJ',
              ModelUrl: 'https://example.com/model.obj',
              Status: 'DONE',
            },
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          },
        ),
      );

    const caller = createTencentCloudCaller();
    const submitResult = await caller.call('SubmitHunyuanTo3DProJob', {});
    expect(submitResult.Response.JobId).toBe('env-job');
    const waitResult = await caller.waitForJob('env-job');
    expect(waitResult.modelUrl).toBe('https://example.com/model.obj');
  });

  it('extracts model url from alternative fields', async () => {
    process.env.HUNYUAN3D_SECRET_ID = 'env-secret-id';
    process.env.HUNYUAN3D_SECRET_KEY = 'env-secret-key';
    process.env.HUNYUAN3D_POLL_INTERVAL = '1';
    process.env.HUNYUAN3D_POLL_TIMEOUT = '50';

    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ Response: { JobId: 'alt-job' } }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Response: {
              ResultFile3Ds: [
                {
                  FileType: 'GLB',
                  FileUrl: 'https://example.com/model.glb',
                  PreviewUrl: 'https://example.com/preview.png',
                },
              ],
              Status: 'DONE',
            },
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          },
        ),
      );

    const caller = createTencentCloudCaller();
    const waitResult = await caller.waitForJob('alt-job');
    expect(waitResult).toEqual({
      format: 'GLB',
      jobId: 'alt-job',
      modelUrl: 'https://example.com/model.glb',
      modelUsage: undefined,
      previewUrl: 'https://example.com/preview.png',
    });
  });
});
