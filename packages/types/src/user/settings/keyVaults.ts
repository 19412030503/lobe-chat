export interface OpenAICompatibleKeyVault {
  apiKey?: string;
  baseURL?: string;
}

export interface FalKeyVault {
  apiKey?: string;
}

export interface AzureOpenAIKeyVault {
  apiKey?: string;
  apiVersion?: string;
  baseURL?: string;
  /**
   * @deprecated
   */
  endpoint?: string;
}

export interface AWSBedrockKeyVault {
  accessKeyId?: string;
  region?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

export interface VertexAIKeyVault {
  apiKey?: string;
  region?: string;
}

export interface CloudflareKeyVault {
  apiKey?: string;
  baseURLOrAccountID?: string;
}

export interface Hunyuan3DKeyVault extends OpenAICompatibleKeyVault {
  /**
   * 轮询间隔（毫秒）
   */
  pollInterval?: string;
  /**
   * 轮询超时（毫秒）
   */
  pollTimeout?: string;
  /**
   * 接入区域，例如 ap-guangzhou（默认）
   */
  region?: string;
  /**
   * 腾讯云账户的 SecretId
   */
  secretId?: string;
  /**
   * 腾讯云 API 版本，默认 2025-05-13
   */
  version?: string;
}

export interface Tripo3DKeyVault extends OpenAICompatibleKeyVault {
  /**
   * 轮询间隔（毫秒）
   */
  pollInterval?: string;
  /**
   * 轮询超时（毫秒）
   */
  pollTimeout?: string;
}

export interface SearchEngineKeyVaults {
  searchxng?: {
    apiKey?: string;
    baseURL?: string;
  };
}

export interface UserKeyVaults extends SearchEngineKeyVaults {
  ai21?: OpenAICompatibleKeyVault;
  ai302?: OpenAICompatibleKeyVault;
  ai360?: OpenAICompatibleKeyVault;
  aihubmix?: OpenAICompatibleKeyVault;
  akashchat?: OpenAICompatibleKeyVault;
  anthropic?: OpenAICompatibleKeyVault;
  azure?: AzureOpenAIKeyVault;
  azureai?: AzureOpenAIKeyVault;
  baichuan?: OpenAICompatibleKeyVault;
  bedrock?: AWSBedrockKeyVault;
  bfl?: any;
  cerebras?: OpenAICompatibleKeyVault;
  cloudflare?: CloudflareKeyVault;
  cohere?: OpenAICompatibleKeyVault;
  cometapi?: OpenAICompatibleKeyVault;
  deepseek?: OpenAICompatibleKeyVault;
  fal?: FalKeyVault;
  fireworksai?: OpenAICompatibleKeyVault;
  giteeai?: OpenAICompatibleKeyVault;
  github?: OpenAICompatibleKeyVault;
  google?: OpenAICompatibleKeyVault;
  groq?: OpenAICompatibleKeyVault;
  higress?: OpenAICompatibleKeyVault;
  huggingface?: OpenAICompatibleKeyVault;
  hunyuan?: OpenAICompatibleKeyVault;
  hunyuan3d?: Hunyuan3DKeyVault;
  infiniai?: OpenAICompatibleKeyVault;
  internlm?: OpenAICompatibleKeyVault;
  jina?: OpenAICompatibleKeyVault;
  lmstudio?: OpenAICompatibleKeyVault;
  lobehub?: any;
  minimax?: OpenAICompatibleKeyVault;
  mistral?: OpenAICompatibleKeyVault;
  modelscope?: OpenAICompatibleKeyVault;
  moonshot?: OpenAICompatibleKeyVault;
  nebius?: OpenAICompatibleKeyVault;
  newapi?: OpenAICompatibleKeyVault;
  novita?: OpenAICompatibleKeyVault;
  nvidia?: OpenAICompatibleKeyVault;
  ollama?: OpenAICompatibleKeyVault;
  ollamacloud?: OpenAICompatibleKeyVault;
  openai?: OpenAICompatibleKeyVault;
  openrouter?: OpenAICompatibleKeyVault;
  password?: string;
  perplexity?: OpenAICompatibleKeyVault;
  ppio?: OpenAICompatibleKeyVault;
  qiniu?: OpenAICompatibleKeyVault;
  qwen?: OpenAICompatibleKeyVault;
  sambanova?: OpenAICompatibleKeyVault;
  search1api?: OpenAICompatibleKeyVault;
  sensenova?: OpenAICompatibleKeyVault;
  siliconcloud?: OpenAICompatibleKeyVault;
  spark?: OpenAICompatibleKeyVault;
  stepfun?: OpenAICompatibleKeyVault;
  taichu?: OpenAICompatibleKeyVault;
  tencentcloud?: OpenAICompatibleKeyVault;
  togetherai?: OpenAICompatibleKeyVault;
  tripo3d?: Tripo3DKeyVault;
  upstage?: OpenAICompatibleKeyVault;
  v0?: OpenAICompatibleKeyVault;
  vercelaigateway?: OpenAICompatibleKeyVault;
  vertexai?: VertexAIKeyVault;
  vllm?: OpenAICompatibleKeyVault;
  volcengine?: OpenAICompatibleKeyVault;
  wenxin?: OpenAICompatibleKeyVault;
  xai?: OpenAICompatibleKeyVault;
  xinference?: OpenAICompatibleKeyVault;
  zeroone?: OpenAICompatibleKeyVault;
  zhipu?: OpenAICompatibleKeyVault;
}
