import { createHash, createHmac } from 'node:crypto';

import { Create3DModelResponse } from '../../types';

const DEFAULT_ENDPOINT = 'ai3d.tencentcloudapi.com';
const DEFAULT_VERSION = '2025-05-13';
const DEFAULT_REGION = 'ap-guangzhou';
const DEFAULT_POLL_INTERVAL = 5000;
const DEFAULT_POLL_TIMEOUT = 5 * 60 * 1000;
const ALGORITHM = 'TC3-HMAC-SHA256';

const sha256 = (payload: string | Buffer) => createHash('sha256').update(payload).digest('hex');

const hmacSha256 = (key: Buffer | string, msg: string) =>
  createHmac('sha256', key).update(msg).digest();

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export interface TencentCloudCallerOptions {
  apiKey?: string;
  baseURL?: string;
  pollInterval?: number | string;
  pollTimeout?: number | string;
  region?: string;
  secretId?: string;
  secretKey?: string;
  version?: string;
}

const parseEndpoint = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      return new URL(trimmed).host || undefined;
    } catch {
      return trimmed.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    }
  }

  return trimmed.replace(/\/+$/, '');
};

const toNumber = (value: number | string | undefined, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
};

export const createTencentCloudCaller = (options: TencentCloudCallerOptions = {}) => {
  const secretId =
    options.secretId?.trim() || process.env.HUNYUAN3D_SECRET_ID || process.env.HUNYUAN_SECRET_ID;
  const secretKey =
    options.secretKey?.trim() ||
    options.apiKey?.trim() ||
    process.env.HUNYUAN3D_SECRET_KEY ||
    process.env.HUNYUAN_SECRET_KEY;
  const version =
    options.version?.trim() ||
    process.env.HUNYUAN3D_VERSION ||
    process.env.HUNYUAN_VERSION ||
    DEFAULT_VERSION;

  if (!secretId || !secretKey) {
    throw new Error('Missing Hunyuan 3D credentials (secretId / secretKey)');
  }

  const endpoint =
    parseEndpoint(options.baseURL) ||
    parseEndpoint(process.env.HUNYUAN3D_ENDPOINT) ||
    DEFAULT_ENDPOINT;
  const region =
    options.region?.trim() ||
    process.env.HUNYUAN3D_REGION?.trim() ||
    process.env.HUNYUAN_REGION?.trim() ||
    DEFAULT_REGION;

  const pollInterval = toNumber(
    options.pollInterval ?? process.env.HUNYUAN3D_POLL_INTERVAL,
    DEFAULT_POLL_INTERVAL,
  );
  const pollTimeout = toNumber(
    options.pollTimeout ?? process.env.HUNYUAN3D_POLL_TIMEOUT,
    DEFAULT_POLL_TIMEOUT,
  );

  const call = async (action: string, body: Record<string, any>) => {
    const host = endpoint;
    const service = host.split('.')[0];
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const payload = JSON.stringify(body ?? {});

    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = 'content-type;host;x-tc-action';
    const hashedRequestPayload = sha256(payload);

    const canonicalRequest = [
      'POST',
      '/',
      '',
      canonicalHeaders,
      signedHeaders,
      hashedRequestPayload,
    ].join('\n');

    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = [
      ALGORITHM,
      timestamp.toString(),
      credentialScope,
      sha256(canonicalRequest),
    ].join('\n');

    const secretDate = hmacSha256(`TC3${secretKey}`, date);
    const secretService = hmacSha256(secretDate, service);
    const secretSigning = hmacSha256(secretService, 'tc3_request');
    const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

    const authorization = `${ALGORITHM} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      'Authorization': authorization,
      'Content-Type': 'application/json',
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': version,
    };

    if (region) headers['X-TC-Region'] = region;

    let response: Response;
    try {
      response = await fetch(`https://${host}`, {
        body: payload,
        headers,
        method: 'POST',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Network error during Tencent Cloud request';
      throw new Error(`Tencent Cloud ${action} request failed: ${message}`);
    }

    const json = (await response.json()) as any;
    const error = json?.Response?.Error;
    if (!response.ok || error) {
      const errorMessage =
        error?.Message || json?.Message || response.statusText || 'Request failed';
      throw new Error(
        `Tencent Cloud ${action} failed: ${errorMessage}${error?.Code ? ` (${error.Code})` : ''}`,
      );
    }

    return json;
  };

  const waitForJob = async (jobId: string): Promise<Create3DModelResponse> => {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= pollTimeout) {
      const queryResponse = await call('QueryHunyuanTo3DRapidJob', {
        JobId: jobId,
      });

      const responseBody = queryResponse?.Response;
      if (!responseBody) {
        throw new Error('Tencent Cloud returned empty response for query');
      }

      const status = String(responseBody.Status || '').toUpperCase();
      if (status === 'DONE') {
        const files = responseBody.ResultFile3Ds || [];
        const primaryFile = files.find((file: any) => file?.Url) || files[0];
        if (!primaryFile?.Url) {
          throw new Error('Tencent Cloud returned DONE status but no model file');
        }

        return {
          format: primaryFile.Type,
          jobId,
          modelUrl: primaryFile.Url,
          previewUrl: primaryFile.PreviewImageUrl || undefined,
        };
      }

      if (status === 'FAILED' || status === 'FAIL' || status === 'ERROR') {
        const message =
          responseBody.ErrorMessage ||
          responseBody.Error?.Message ||
          'Hunyuan 3D generation failed';
        throw new Error(message);
      }

      await wait(pollInterval);
    }

    throw new Error('Hunyuan 3D generation polling timed out');
  };

  return {
    call,
    waitForJob,
  };
};
