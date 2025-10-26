// @vitest-environment node
import { ModelProvider } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeHunyuan3DAI, params } from './index';

const caller = {
  call: vi.fn().mockResolvedValue({
    Response: {
      JobId: 'job-123',
    },
  }),
  waitForJob: vi.fn().mockResolvedValue({
    format: 'STL',
    jobId: 'job-123',
    modelUrl: 'https://example.com/model.stl',
    previewUrl: 'https://example.com/preview.png',
  }),
};

const createTencentCloudCallerMock = vi.fn(() => caller);

vi.mock('./tencentCloud', () => ({
  createTencentCloudCaller: createTencentCloudCallerMock,
}));

describe('LobeHunyuan3DAI', () => {
  beforeEach(() => {
    createTencentCloudCallerMock.mockClear();
    caller.call.mockClear();
    caller.waitForJob.mockClear();
  });

  it('should initialize runtime with provider id', () => {
    const runtime = new LobeHunyuan3DAI({ apiKey: 'test-key' });
    expect(runtime).toBeInstanceOf(LobeHunyuan3DAI);
    expect(params.provider).toBe(ModelProvider.Hunyuan3D);
  });

  it('should call custom create3DModel handler', async () => {
    const runtime = new LobeHunyuan3DAI({
      apiKey: 'test-secret-key',
      hunyuan3dEndpoint: 'https://ai3d.tencentcloudapi.com',
      hunyuan3dRegion: 'ap-guangzhou',
      hunyuan3dSecretId: 'test-secret-id',
      hunyuan3dSecretKey: 'test-secret-key',
      hunyuan3dVersion: '2025-05-13',
    });
    const result = await runtime.create3DModel!({
      model: 'hunyuan-3d-pro',
      params: { prompt: 'test' } as any,
    });

    expect(caller.call).toHaveBeenCalledWith('SubmitHunyuanTo3DProJob', {
      Model: 'hunyuan-3d-pro',
      Prompt: 'test',
    });

    expect(result).toEqual({
      format: 'STL',
      jobId: 'job-123',
      modelUrl: 'https://example.com/model.stl',
      previewUrl: 'https://example.com/preview.png',
    });

    expect(createTencentCloudCallerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-secret-key',
        baseURL: 'https://ai3d.tencentcloudapi.com',
        region: 'ap-guangzhou',
        secretId: 'test-secret-id',
        secretKey: 'test-secret-key',
        version: '2025-05-13',
      }),
    );
  });

  it('throws when payload lacks prompt and reference image', async () => {
    const runtime = new LobeHunyuan3DAI({ apiKey: 'test-key', hunyuan3dSecretId: 'secret-id' });

    await expect(
      runtime.create3DModel!({
        model: 'hunyuan-3d-pro',
        params: {} as any,
      }),
    ).rejects.toThrow('Hunyuan 3D requires a prompt or reference image');

    expect(caller.call).not.toHaveBeenCalled();
  });

  it('sends reference images when provided', async () => {
    const runtime = new LobeHunyuan3DAI({ apiKey: 'test-key' });

    await runtime.create3DModel!({
      model: 'hunyuan-3d-pro',
      params: {
        imageUrl: 'https://example.com/reference.png',
        imageUrls: ['https://example.com/reference.png', 'https://example.com/alt.png'],
        prompt: 'test',
      } as any,
    });

    expect(caller.call).toHaveBeenCalledWith('SubmitHunyuanTo3DProJob', {
      ImageUrl: 'https://example.com/reference.png',
      ImageUrls: ['https://example.com/reference.png', 'https://example.com/alt.png'],
      Model: 'hunyuan-3d-pro',
      Prompt: 'test',
    });
  });
});
