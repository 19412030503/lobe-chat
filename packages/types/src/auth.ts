/* eslint-disable typescript-sort-keys/interface */
export interface ClientSecretPayload {
  /**
   * password
   */
  accessCode?: string;
  /**
   * Represents the user's API key
   *
   * If provider need multi keys like bedrock,
   * this will be used as the checker whether to use frontend key
   */
  apiKey?: string;
  /**
   * Represents the endpoint of provider
   */
  baseURL?: string;

  runtimeProvider?: string;

  azureApiVersion?: string;

  awsAccessKeyId?: string;
  awsRegion?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;

  cloudflareBaseURLOrAccountID?: string;

  vertexAIRegion?: string;

  hunyuan3dEndpoint?: string;
  hunyuan3dPollInterval?: string | number;
  hunyuan3dPollTimeout?: string | number;
  hunyuan3dRegion?: string;
  hunyuan3dSecretId?: string;
  hunyuan3dSecretKey?: string;
  hunyuan3dVersion?: string;

  tripo3dPollInterval?: string | number;
  tripo3dPollTimeout?: string | number;

  /**
   * user id
   * in client db mode it's a uuid
   * in server db mode it's a user id
   */
  userId?: string;
}
/* eslint-enable */
