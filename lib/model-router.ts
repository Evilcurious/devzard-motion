export type RouterProviderId =
  | 'openrouter'
  | 'ollama-cloud'
  | 'kilo'
  | 'ovh'
  | 'agnes'
  | 'routeway'
  | 'bazaarlink'
  | 'requesty'
  | 'aihorde'
  | 'electronhub'
  | 'xkiro'
  | 'septorlabs'
  | 'bluesminds'
  | 'firecrawl'
  | 'parallel'
  | 'keenable'
  | 'gemini'
  | 'groq'
  | 'cerebras'
  | 'opencode-zen'
  | 'mistral'
  | 'cohere'
  | 'zai'
  | 'nvidia'
  | 'huggingface'
  | 'modelscope'
  | 'openai'
  | 'speka'
  | 'kenari'
  | 'kiosapi'
  | 'typhoon'
  | 'plugsky'
  | 'inferbase'
  | 'simplellm'
  | 'llmtr'
  | 'gizmo'
  | 'blockrun'
  | 'experiential'
  | 'router9'
  | 'clod'
  | 'blaze'
  | 'lucidity'
  | 'airforce'
  | 'dreamprompting'
  | 'waterfall'
  | 'logfare'
  | 'apinex'
  | 'onomeo'
  | 'iteracompute'
  | 'bai'
  | 'anyapi'
  | 'llm7'
  | 'ainative'
  | 'aion'
  | 'navy'
  | 'nara'
  | 'sealion'
  | 'orcarouter'
  | 'unorouter'
  | 'qianfan'
  | 'volcengine'
  | 'longcat'
  | 'xfyun'
  | 'siliconflow'
  | 'managed';
export type RouterProviderCategory = 'models' | 'search';
export type RouterProvider = {
  id: RouterProviderId;
  name: string;
  category: RouterProviderCategory;
  baseURL: string | null;
  modelsPath?: string;
  keyRequired: boolean;
  docsURL: string;
  note?: string;
  userAgent?: string;
};

// Provider hosts are fixed in code so saved keys can never be sent to a
// user-supplied destination. Unknown providers can be added as reviewed
// templates in this registry; editable URLs continue to use AI_ALLOWED_ORIGINS.
export const routerProviders: RouterProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'models',
    baseURL: 'https://api.openai.com/v1',
    keyRequired: true,
    docsURL: 'https://platform.openai.com/api-keys',
    note: 'Personal OpenAI keys are billed by OpenAI. Capped accounts require provider-reported token usage.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini API',
    category: 'models',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelsPath: '/v1beta/models?pageSize=1000',
    keyRequired: true,
    docsURL: 'https://aistudio.google.com/app/apikey',
    note: 'Gemini lists models available to the connected API key; Google applies its own quota, paid-access, and regional limits.',
  },
  {
    id: 'groq',
    name: 'Groq',
    category: 'models',
    baseURL: 'https://api.groq.com/openai/v1',
    keyRequired: true,
    docsURL: 'https://console.groq.com/keys',
    note: 'FreeLLMAPI lists eligible free-tier models; Groq also has model- and usage-specific limits or paid options. Verify current quotas and pricing with Groq.',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    category: 'models',
    baseURL: 'https://api.cerebras.ai/v1',
    keyRequired: true,
    docsURL: 'https://cloud.cerebras.ai/platform',
    note: 'FreeLLMAPI lists eligible free-tier models; availability, rate limits, and paid options vary by model and account.',
  },
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    category: 'models',
    baseURL: 'https://opencode.ai/zen/v1',
    keyRequired: true,
    docsURL: 'https://opencode.ai/docs/zen/',
    note: 'FreeLLMAPI lists selected models; Zen access and pricing are model-specific and may include paid models. Check current terms before use.',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    category: 'models',
    baseURL: 'https://api.mistral.ai/v1',
    keyRequired: true,
    docsURL: 'https://console.mistral.ai/api-keys/',
    note: 'FreeLLMAPI lists eligible evaluation/free-tier models where available; other API use may be billed. Check current Mistral terms and per-model pricing.',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    category: 'models',
    baseURL: 'https://api.cohere.com/compatibility/v1',
    keyRequired: true,
    docsURL: 'https://dashboard.cohere.com/api-keys',
    note: 'FreeLLMAPI lists eligible trial/free-tier models; trial limits and paid production usage differ. Check current Cohere terms.',
  },
  {
    id: 'zai',
    name: 'Z.ai (Zhipu)',
    category: 'models',
    baseURL: 'https://api.z.ai/api/paas/v4',
    keyRequired: true,
    docsURL: 'https://z.ai/model-api',
    note: 'FreeLLMAPI lists eligible free-tier models; quotas and paid access vary by model, region, and account.',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA API Catalog',
    category: 'models',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    keyRequired: true,
    docsURL: 'https://build.nvidia.com/',
    note: 'FreeLLMAPI lists eligible NVIDIA-hosted endpoints; trial credits, rate limits, model availability, and paid terms can change.',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Inference Providers',
    category: 'models',
    baseURL: 'https://router.huggingface.co/v1',
    keyRequired: true,
    docsURL: 'https://huggingface.co/settings/tokens',
    note: 'FreeLLMAPI lists selected endpoints; provider/model compatibility, included credits, and paid usage vary. Check current Hugging Face pricing.',
  },
  {
    id: 'modelscope',
    name: 'ModelScope',
    category: 'models',
    baseURL: 'https://api-inference.modelscope.cn/v1',
    keyRequired: true,
    docsURL: 'https://modelscope.cn/my/myaccesstoken',
    note: 'FreeLLMAPI lists some ModelScope endpoints; cloud access may require account/region binding and availability is model-specific. Check current ModelScope terms.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'models',
    baseURL: 'https://openrouter.ai/api/v1',
    modelsPath: '/api/v1/models/user?limit=500',
    keyRequired: true,
    docsURL: 'https://openrouter.ai/settings/keys',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    category: 'models',
    baseURL: 'https://api.siliconflow.com/v1',
    keyRequired: true,
    docsURL: 'https://cloud.siliconflow.cn/account/ak',
    note: 'Uses the OpenAI-compatible chat API and reads the account credit balance when the provider exposes it.',
  },
  {
    id: 'ollama-cloud',
    name: 'Ollama Cloud',
    category: 'models',
    baseURL: 'https://ollama.com/v1',
    keyRequired: true,
    docsURL: 'https://ollama.com/settings/keys',
    note: 'Checks the official balance API; included credits apply to Ollama’s documented free-usage models, and purchased credits apply to listed models.',
  },
  {
    id: 'kilo',
    name: 'Kilo Gateway',
    category: 'models',
    baseURL: 'https://api.kilo.ai/api/gateway/v1',
    modelsPath: '/api/gateway/models',
    keyRequired: false,
    docsURL: 'https://app.kilo.ai',
    note: 'Anonymous free routes may be rate-limited.',
  },
  {
    id: 'ovh',
    name: 'OVH AI Endpoints',
    category: 'models',
    baseURL: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
    keyRequired: false,
    docsURL: 'https://endpoints.ai.cloud.ovh.net',
  },
  {
    id: 'agnes',
    name: 'Agnes AI',
    category: 'models',
    baseURL: 'https://apihub.agnes-ai.com/v1',
    keyRequired: true,
    docsURL: 'https://platform.agnes-ai.com',
  },
  {
    id: 'routeway',
    name: 'Routeway',
    category: 'models',
    baseURL: 'https://api.routeway.ai/v1',
    keyRequired: true,
    docsURL: 'https://routeway.ai',
    userAgent: 'Mozilla/5.0 Relay/1.0',
  },
  {
    id: 'bazaarlink',
    name: 'BazaarLink',
    category: 'models',
    baseURL: 'https://bazaarlink.ai/api/v1',
    keyRequired: true,
    docsURL: 'https://bazaarlink.ai',
  },
  {
    id: 'requesty',
    name: 'Requesty',
    category: 'models',
    baseURL: 'https://router.requesty.ai/v1',
    keyRequired: true,
    docsURL: 'https://requesty.ai',
  },
  {
    id: 'aihorde',
    name: 'AI Horde',
    category: 'models',
    baseURL: 'https://oai.aihorde.net/v1',
    keyRequired: false,
    docsURL: 'https://aihorde.net/register',
    note: 'Volunteer-powered; responses can be slow and tools are not supported.',
  },
  {
    id: 'electronhub',
    name: 'Electron Hub',
    category: 'models',
    baseURL: 'https://api.electronhub.ai/v1',
    keyRequired: true,
    docsURL: 'https://app.electronhub.ai',
    note: 'Only models reported free or with remaining-token data are shown.',
  },
  {
    id: 'xkiro',
    name: 'xKiro',
    category: 'models',
    baseURL: 'https://api.xkiro.com/v1',
    modelsPath: '/v1/models?modality=chat',
    keyRequired: true,
    docsURL: 'https://docs.xkiro.com/',
    note: 'OpenAI-compatible chat models; image generation is available through a separate image job API.',
  },
  {
    id: 'septorlabs',
    name: 'Septor Labs',
    category: 'models',
    baseURL: 'https://api.septorlabs.com/v1',
    keyRequired: true,
    docsURL: 'https://septorlabs.com/docs/introduction',
    note: 'OpenAI-compatible model gateway with image generation on paid plans.',
  },
  {
    id: 'bluesminds',
    name: 'BluesMinds',
    category: 'models',
    baseURL: 'https://api.bluesminds.com/v1',
    modelsPath: '/v1/models',
    keyRequired: true,
    docsURL: 'https://api.bluesminds.com/',
    note: 'OpenAI-compatible model gateway. Save your key, then select one of the model IDs returned for that account. Provider billing and access rules apply.',
  },
  // Additional OpenAI-compatible provider gateways ported from FreeLLMAPI's
  // provider registry. Their models are loaded only from the authenticated
  // provider model list; provider-side quota and billing remain authoritative.
  {
    id: 'speka',
    name: 'Speka',
    category: 'models',
    baseURL: 'https://speka.me/v1',
    keyRequired: true,
    docsURL: 'https://speka.me',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Speka.',
  },
  {
    id: 'kenari',
    name: 'Kenari',
    category: 'models',
    baseURL: 'https://kenari.id/v1',
    keyRequired: true,
    docsURL: 'https://kenari.id',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Kenari.',
  },
  {
    id: 'kiosapi',
    name: 'KiosAPI',
    category: 'models',
    baseURL: 'https://api.kiosapi.id/v1',
    keyRequired: true,
    docsURL: 'https://kiosapi.id',
    note: 'OpenAI-compatible provider. Verify account access and current billing with KiosAPI.',
  },
  {
    id: 'typhoon',
    name: 'Typhoon',
    category: 'models',
    baseURL: 'https://api.opentyphoon.ai/v1',
    keyRequired: true,
    docsURL: 'https://opentyphoon.ai',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Typhoon.',
  },
  {
    id: 'plugsky',
    name: 'Plugsky',
    category: 'models',
    baseURL: 'https://plugsky.com/v1',
    keyRequired: true,
    docsURL: 'https://plugsky.com',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Plugsky.',
  },
  {
    id: 'inferbase',
    name: 'Inferbase',
    category: 'models',
    baseURL: 'https://api.inferbase.ai/v1',
    keyRequired: true,
    docsURL: 'https://inferbase.ai',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Inferbase.',
  },
  {
    id: 'simplellm',
    name: 'SimpleLLM',
    category: 'models',
    baseURL: 'https://api.simplellm.eu/v1',
    keyRequired: true,
    docsURL: 'https://simplellm.eu',
    note: 'OpenAI-compatible provider. Verify account access and current billing with SimpleLLM.',
  },
  {
    id: 'llmtr',
    name: 'LLMTR',
    category: 'models',
    baseURL: 'https://llmtr.com/v1',
    keyRequired: true,
    docsURL: 'https://llmtr.com',
    note: 'OpenAI-compatible provider. Verify account access and current billing with LLMTR.',
  },
  {
    id: 'gizmo',
    name: 'Gizmo',
    category: 'models',
    baseURL: 'https://api.gizmoplatforms.com/api/v1',
    keyRequired: true,
    docsURL: 'https://gizmoplatforms.com',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Gizmo.',
  },
  {
    id: 'blockrun',
    name: 'BlockRun',
    category: 'models',
    baseURL: 'https://api.blockrun.ai/v1',
    keyRequired: true,
    docsURL: 'https://blockrun.ai',
    note: 'OpenAI-compatible provider. Verify account access and current billing with BlockRun.',
  },
  {
    id: 'experiential',
    name: 'Experiential Labs',
    category: 'models',
    baseURL: 'https://api.experientiallabs.ai/v1',
    keyRequired: true,
    docsURL: 'https://experientiallabs.ai',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Experiential Labs.',
  },
  {
    id: 'router9',
    name: 'Router9',
    category: 'models',
    baseURL: 'https://api.router9.com/v1',
    keyRequired: true,
    docsURL: 'https://router9.com',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Router9.',
  },
  {
    id: 'clod',
    name: 'CLōD',
    category: 'models',
    baseURL: 'https://api.clod.io/v1',
    keyRequired: true,
    docsURL: 'https://clod.io',
    note: 'OpenAI-compatible provider. Verify account access and current billing with CLōD.',
  },
  {
    id: 'blaze',
    name: 'BlazeAPI',
    category: 'models',
    baseURL: 'https://api.blazeapi.org/paid/v1',
    keyRequired: true,
    docsURL: 'https://blazeapi.org',
    note: 'OpenAI-compatible provider. Verify account access and current billing with BlazeAPI.',
  },
  {
    id: 'lucidity',
    name: 'Lucidity',
    category: 'models',
    baseURL: 'https://composite.lucidity.sh/v1',
    keyRequired: true,
    docsURL: 'https://lucidity.sh',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Lucidity.',
  },
  {
    id: 'airforce',
    name: 'Api.Airforce',
    category: 'models',
    baseURL: 'https://api.airforce/v1',
    keyRequired: true,
    docsURL: 'https://api.airforce',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Api.Airforce.',
  },
  {
    id: 'dreamprompting',
    name: 'DreamPrompting',
    category: 'models',
    baseURL: 'https://dreamprompting.com/api/v1',
    keyRequired: true,
    docsURL: 'https://dreamprompting.com',
    note: 'OpenAI-compatible provider. Verify account access and current billing with DreamPrompting.',
  },
  {
    id: 'waterfall',
    name: 'Waterfall',
    category: 'models',
    baseURL: 'https://api.getwaterfall.org/v1',
    keyRequired: true,
    docsURL: 'https://getwaterfall.org',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Waterfall.',
  },
  {
    id: 'logfare',
    name: 'Logfare',
    category: 'models',
    baseURL: 'https://logfare.ai/v1',
    keyRequired: true,
    docsURL: 'https://logfare.ai',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Logfare.',
  },
  {
    id: 'apinex',
    name: 'APINex',
    category: 'models',
    baseURL: 'https://api.apinex.bond/v1',
    keyRequired: true,
    docsURL: 'https://apinex.bond',
    note: 'OpenAI-compatible provider. Verify account access and current billing with APINex.',
  },
  {
    id: 'onomeo',
    name: 'Onomeo',
    category: 'models',
    baseURL: 'https://onomeo.com/v1',
    keyRequired: true,
    docsURL: 'https://onomeo.com',
    note: 'OpenAI-compatible provider. Verify account access and current billing with Onomeo.',
  },
  {
    id: 'iteracompute',
    name: 'IteraCompute',
    category: 'models',
    baseURL: 'https://api.iteracompute.com/v1',
    keyRequired: true,
    docsURL: 'https://iteracompute.com',
    note: 'OpenAI-compatible provider. Verify account access and current billing with IteraCompute.',
  },
  {
    id: 'bai',
    name: 'B.AI',
    category: 'models',
    baseURL: 'https://api.b.ai/v1',
    keyRequired: true,
    docsURL: 'https://b.ai',
    note: 'OpenAI-compatible provider. Verify account access and current billing with B.AI.',
  },
  {
    id: 'anyapi',
    name: 'AnyAPI',
    category: 'models',
    baseURL: 'https://api.anyapi.ai/v1',
    keyRequired: true,
    docsURL: 'https://anyapi.ai',
    note: 'OpenAI-compatible provider. Verify account access and current billing with AnyAPI.',
  },
  {
    id: 'llm7',
    name: 'LLM7',
    category: 'models',
    baseURL: 'https://api.llm7.io/v1',
    keyRequired: false,
    docsURL: 'https://llm7.io',
    note: 'OpenAI-compatible provider. Anonymous access may be rate-limited; verify model terms with LLM7.',
  },
  {
    id: 'ainative',
    name: 'AINative Studio',
    category: 'models',
    baseURL: 'https://api.ainative.studio/api/v1',
    keyRequired: true,
    docsURL: 'https://ainative.studio',
    note: 'OpenAI-compatible provider. Verify account access and current quotas with AINative Studio.',
  },
  {
    id: 'aion',
    name: 'Aion Labs',
    category: 'models',
    baseURL: 'https://api.aionlabs.ai/v1',
    keyRequired: true,
    docsURL: 'https://aionlabs.ai',
    note: 'OpenAI-compatible provider. Verify account access and current quotas with Aion Labs.',
  },
  {
    id: 'navy',
    name: 'NavyAI',
    category: 'models',
    baseURL: 'https://api.navy/v1',
    keyRequired: true,
    docsURL: 'https://api.navy',
    userAgent: 'FreeLLMAPI/1.0',
    note: 'OpenAI-compatible provider. Verify account access and current quotas with NavyAI.',
  },
  {
    id: 'nara',
    name: 'NaraRouter',
    category: 'models',
    baseURL: 'https://router.bynara.id/v1',
    keyRequired: true,
    docsURL: 'https://bynara.id',
    note: 'OpenAI-compatible provider. Verify account access and current quotas with NaraRouter.',
  },
  {
    id: 'sealion',
    name: 'SEA-LION',
    category: 'models',
    baseURL: 'https://api.sea-lion.ai/v1',
    keyRequired: true,
    docsURL: 'https://sea-lion.ai',
    note: 'OpenAI-compatible provider. Verify account access and current quotas with SEA-LION.',
  },
  {
    id: 'orcarouter',
    name: 'OrcaRouter',
    category: 'models',
    baseURL: 'https://api.orcarouter.ai/v1',
    keyRequired: true,
    docsURL: 'https://orcarouter.ai',
    note: 'OpenAI-compatible provider. Verify account access and current quotas with OrcaRouter.',
  },
  {
    id: 'unorouter',
    name: 'UnoRouter',
    category: 'models',
    baseURL: 'https://api.unorouter.com/v1',
    keyRequired: true,
    docsURL: 'https://unorouter.com',
    note: 'OpenAI-compatible provider. Verify account access and current quotas with UnoRouter.',
  },
  {
    id: 'qianfan',
    name: 'Baidu Qianfan',
    category: 'models',
    baseURL: 'https://qianfan.baidubce.com/v2',
    keyRequired: true,
    docsURL: 'https://cloud.baidu.com/product/wenxinworkshop',
    note: 'OpenAI-compatible provider. Account and region restrictions may apply.',
  },
  {
    id: 'volcengine',
    name: 'Volcengine Ark',
    category: 'models',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    keyRequired: true,
    docsURL: 'https://www.volcengine.com/product/ark',
    note: 'OpenAI-compatible provider. Account and region restrictions may apply.',
  },
  {
    id: 'longcat',
    name: 'LongCat',
    category: 'models',
    baseURL: 'https://api.longcat.chat/openai/v1',
    keyRequired: true,
    docsURL: 'https://longcat.chat',
    note: 'OpenAI-compatible provider. Verify account access and current quotas with LongCat.',
  },
  {
    id: 'xfyun',
    name: 'iFlytek Spark',
    category: 'models',
    baseURL: 'https://spark-api-open.xf-yun.com/v1',
    keyRequired: true,
    docsURL: 'https://xinghuo.xfyun.cn',
    note: 'OpenAI-compatible provider. Account and region restrictions may apply.',
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    category: 'search',
    baseURL: 'https://api.firecrawl.dev/v2',
    keyRequired: true,
    docsURL: 'https://docs.firecrawl.dev/api-reference/endpoint/search',
    note: 'Web search is called when you turn on Search the web in chat.',
  },
  {
    id: 'parallel',
    name: 'Parallel',
    category: 'search',
    baseURL: null,
    keyRequired: true,
    docsURL: 'https://parallel.ai',
    note: 'Search credential storage only; Relay does not invoke this API yet.',
  },
  {
    id: 'keenable',
    name: 'KeenAble',
    category: 'search',
    baseURL: null,
    keyRequired: true,
    docsURL: 'https://keenable.com',
    note: 'Search credential storage only; Relay does not invoke this API yet.',
  },
];

export type RouterModel = {
  key: string;
  id: string;
  name: string;
  providers: Array<{
    id: RouterProviderId;
    name: string;
    modelId: string;
    contextTokens: number | null;
    availableTokens: number | null;
    supportsTools: boolean | null;
    supportsVision?: boolean | null;
    monthlyTokenBudget?: string | null;
    isFree: boolean;
    accountCreditsAvailable?: boolean;
  }>;
  contextTokens: number | null;
  availableTokens: number | null;
  isFree: boolean;
};
export type RouterStrategy = 'auto' | 'fallback' | 'fusion' | 'auto-fusion';
export type AIDensity = 'auto' | 'fast' | 'faster' | 'high' | 'slow';
export type RoutingStrategy = 'balanced' | 'fastest' | 'most-reliable' | 'largest-context';
export type ObservedModelMetric = {
  requests: number;
  successRate: number;
  averageLatencyMs: number | null;
};
export type RouterTarget = {
  providerId: RouterProviderId;
  modelId: string;
  availableTokens?: number | null;
  contextTokens?: number | null;
  supportsTools?: boolean | null;
  isFree?: boolean;
  accountCreditsAvailable?: boolean;
};
export type RouterSelection = RouterTarget & {
  strategy: RouterStrategy;
  autoPick?: boolean;
  fallbackChain?: RouterTarget[];
  fusionModels: RouterTarget[];
};

export function filterRouterModels<
  T extends {
    name: string;
    id: string;
    providers: Array<{ id: string; name: string; modelId: string }>;
  },
>(models: T[], query: string): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return models;
  return models.flatMap((model) => {
    if (`${model.name} ${model.id}`.toLowerCase().includes(normalized)) return [model];
    const providers = model.providers.filter((provider) =>
      `${provider.id} ${provider.name} ${provider.modelId}`.toLowerCase().includes(normalized),
    );
    return providers.length ? [{ ...model, providers } as T] : [];
  });
}

export function modelParameterBillions(modelId: string): number | null {
  const matches = [...modelId.matchAll(/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)b(?:[^a-z0-9]|$)/gi)];
  const sizes = matches
    .map((match) => Number(match[1]))
    .filter((size) => Number.isFinite(size) && size > 0 && size <= 2000);
  return sizes.length ? Math.max(...sizes) : null;
}

export function rankCodeTargets<T extends RouterTarget>(targets: T[]): T[] {
  return targets
    .filter((target) => target.availableTokens !== 0)
    .map((target, index) => ({ target, index, size: modelParameterBillions(target.modelId) }))
    .sort((a, b) => {
      if (a.size !== null && b.size === null) return -1;
      if (a.size === null && b.size !== null) return 1;
      if (a.size !== null && b.size !== null && a.size !== b.size) return b.size - a.size;
      const codeName =
        /coder|codestral|codegemma|starcoder|devstral|code[-_ ]?qwen|deepseek[-_ ]?coder/i;
      const aCode = codeName.test(a.target.modelId);
      const bCode = codeName.test(b.target.modelId);
      if (aCode !== bCode) return aCode ? -1 : 1;
      const contextDifference = (b.target.contextTokens ?? -1) - (a.target.contextTokens ?? -1);
      return contextDifference || a.index - b.index;
    })
    .map(({ target }) => target);
}

export function selectRouterCandidates<T extends RouterTarget>(
  ranked: T[],
  selected: RouterTarget | null,
  autoPick: boolean,
) {
  if (autoPick) return ranked;
  if (!selected) return [];
  const key = `${selected.providerId}::${selected.modelId}`;
  const pinned = ranked.find((target) => `${target.providerId}::${target.modelId}` === key);
  return pinned ? [pinned] : [];
}

export function selectFallbackCandidates<T extends RouterTarget>(
  available: T[],
  primary: RouterTarget,
  fallbackChain: RouterTarget[],
  limit = 4,
): T[] {
  const byKey = new Map(
    available
      .filter((target) => target.availableTokens !== 0)
      .map((target) => [`${target.providerId}::${target.modelId}`, target]),
  );
  const ordered = [primary, ...fallbackChain]
    .map((target) => byKey.get(`${target.providerId}::${target.modelId}`))
    .filter((target): target is T => !!target);
  return [
    ...new Map(
      ordered.map((target) => [`${target.providerId}::${target.modelId}`, target]),
    ).values(),
  ].slice(0, limit);
}

export function selectAutoFusionTargets<T extends RouterTarget>(
  prompt: string,
  targets: T[],
  density: AIDensity = 'auto',
  metrics: ReadonlyMap<string, number> = new Map(),
  strategy: RoutingStrategy = 'balanced',
  observedMetrics: ReadonlyMap<string, ObservedModelMetric> = new Map(),
  limit = 4,
): T[] {
  const query = prompt.toLowerCase();
  const codeTask =
    /\b(code|coding|program|debug|bug|typescript|javascript|python|sql|function|api|website|script|repository)\b/.test(
      query,
    );
  const reasoningTask =
    /\b(analy[sz]e|reason|compare|evaluate|proof|math|calculate|strategy|trade.?off|complex|why|diagnos)\b/.test(
      query,
    );
  const creativeTask =
    /\b(write|story|creative|poem|rewrite|brand|tagline|marketing|email|tone|draft)\b/.test(query);
  const multilingualTask =
    /[\u0600-\u06ff\u0900-\u097f\u4e00-\u9fff]|\b(translate|translation|urdu|arabic|hindi|spanish|french|multilingual)\b/.test(
      query,
    );
  const longTask =
    prompt.length > 12000 ||
    /\b(entire|full document|long document|whole book|all files)\b/.test(query);
  const ranked = rankRouterTargets(targets, density, metrics, strategy, observedMetrics);
  const scored = ranked.map((target, index) => {
    const model = target.modelId.toLowerCase();
    const skill =
      (codeTask && /coder|codestral|code|starcoder|deepseek-v[23]|qwen.*coder/.test(model)
        ? 40
        : 0) +
      (reasoningTask && /reason|deepseek-r1|qwq|o1|o3|thinking|r1/.test(model) ? 40 : 0) +
      (creativeTask && /claude|gemini|gpt|command|mistral|llama/.test(model) ? 25 : 0) +
      (multilingualTask && /qwen|gemini|claude|gpt|llama|aya/.test(model) ? 25 : 0) +
      (longTask && (target.contextTokens || 0) >= 64000 ? 30 : 0);
    return { target, index, score: skill - index * 0.001 };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen: T[] = [];
  const used = new Set<string>();
  const add = (candidate: (typeof scored)[number]) => {
    const key = `${candidate.target.providerId}::${candidate.target.modelId}`;
    if (!used.has(key)) {
      used.add(key);
      chosen.push(candidate.target);
    }
  };
  // Prefer a diverse provider set, then use the next-best eligible models to fill the ensemble.
  const providers = new Set<string>();
  for (const candidate of scored) {
    if (providers.has(candidate.target.providerId)) continue;
    providers.add(candidate.target.providerId);
    add(candidate);
    if (chosen.length >= limit) return chosen;
  }
  for (const candidate of scored) {
    add(candidate);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

export function rankRouterTargets<T extends RouterTarget>(
  targets: T[],
  density: AIDensity,
  measuredLatencyMs: ReadonlyMap<string, number> = new Map(),
  strategy: RoutingStrategy = 'balanced',
  observedMetrics: ReadonlyMap<string, ObservedModelMetric> = new Map(),
): T[] {
  const eligible = targets.filter((target) => target.availableTokens !== 0);
  return eligible
    .map((target, index) => ({ target, index }))
    .sort((a, b) => {
      const keyA = `${a.target.providerId}::${a.target.modelId}`;
      const keyB = `${b.target.providerId}::${b.target.modelId}`;
      const quotaA = a.target.availableTokens;
      const quotaB = b.target.availableTokens;
      const contextA = a.target.contextTokens ?? -1;
      const contextB = b.target.contextTokens ?? -1;
      const metricA = observedMetrics.get(keyA);
      const metricB = observedMetrics.get(keyB);
      const latencyA = metricA?.averageLatencyMs ?? measuredLatencyMs.get(keyA);
      const latencyB = metricB?.averageLatencyMs ?? measuredLatencyMs.get(keyB);
      const reliableA = metricA && metricA.requests >= 3 ? metricA.successRate : null;
      const reliableB = metricB && metricB.requests >= 3 ? metricB.successRate : null;
      const compareQuotaPresence = () => {
        const knownA = quotaA !== null && quotaA !== undefined;
        const knownB = quotaB !== null && quotaB !== undefined;
        return knownA === knownB ? 0 : knownA ? -1 : 1;
      };
      const compareQuota = () =>
        quotaA !== null &&
        quotaA !== undefined &&
        quotaB !== null &&
        quotaB !== undefined &&
        quotaA !== quotaB
          ? quotaB - quotaA
          : 0;
      const compareLatency = () => {
        if (latencyA === undefined && latencyB !== undefined) return 1;
        if (latencyB === undefined && latencyA !== undefined) return -1;
        return latencyA !== undefined && latencyB !== undefined ? latencyA - latencyB : 0;
      };
      const compareReliability = () => {
        if (reliableA === null && reliableB !== null) return 1;
        if (reliableB === null && reliableA !== null) return -1;
        return reliableA !== null && reliableB !== null ? reliableB - reliableA : 0;
      };
      const compareContext = () => {
        const knownA = contextA >= 0;
        const knownB = contextB >= 0;
        if (knownA !== knownB) return knownA ? -1 : 1;
        return contextA !== contextB ? contextB - contextA : 0;
      };
      const densityOrder = () => {
        if (density === 'faster') return compareLatency() || compareQuota();
        if (density === 'high') return compareContext() || compareQuota();
        return (
          compareQuota() ||
          (density === 'fast' ? compareLatency() : 0) ||
          (density === 'slow' ? compareContext() : 0)
        );
      };
      if (strategy === 'balanced') {
        const balancedOrder = compareQuotaPresence() || densityOrder();
        if (balancedOrder) return balancedOrder;
        const performanceOrder = compareReliability() || compareLatency();
        if (performanceOrder) return performanceOrder;
      } else {
        const strategyOrder =
          strategy === 'fastest'
            ? compareLatency() || compareReliability() || compareQuotaPresence() || compareQuota()
            : strategy === 'most-reliable'
              ? compareReliability() || compareQuotaPresence() || compareQuota() || compareLatency()
              : compareContext() ||
                compareQuotaPresence() ||
                compareQuota() ||
                compareReliability();
        if (strategyOrder) return strategyOrder;
        const densityTieBreak = densityOrder();
        if (densityTieBreak) return densityTieBreak;
      }
      const freeRankA = a.target.isFree ? 0 : 1;
      const freeRankB = b.target.isFree ? 0 : 1;
      if (freeRankA !== freeRankB) return freeRankA - freeRankB;
      return a.index - b.index;
    })
    .map(({ target }) => target);
}

export function getRouterProvider(id: string): RouterProvider | undefined {
  if (id === 'managed')
    return {
      id: 'managed',
      name: 'Admin-managed model',
      category: 'models',
      baseURL: null,
      keyRequired: false,
      docsURL: '',
    };
  return routerProviders.find((provider) => provider.id === id);
}

export function canonicalModelKey(modelId: string): string {
  return modelId.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

const POSITIVE_CREDIT_FIELDS = new Set([
  'availablebalance',
  'availablecredits',
  'availabletokens',
  'balance',
  'creditsavailable',
  'creditsremaining',
  'limitremaining',
  'quotaavailable',
  'quotaremaining',
  'remainingbalance',
  'remainingcredits',
  'remainingquota',
  'remainingtokens',
  'tokensremaining',
]);
const POSITIVE_REMAINING_PERCENT_FIELDS = new Set([
  'creditsremainingpercent',
  'remainingpercent',
  'remainingpercentage',
  'quotaremainingpercent',
  'quotaremainingpercentage',
]);
const ACCOUNT_QUOTA_CONTAINERS = new Set([
  'account',
  'balance',
  'billing',
  'credits',
  'data',
  'freecredits',
  'freeusage',
  'limit',
  'limits',
  'meta',
  'metadata',
  'plan',
  'quota',
  'usage',
]);

function finiteNumber(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Detect explicit positive provider/account credit fields across common response wrappers. */
export function hasPositiveAccountCredits(body: unknown): boolean {
  const pending: Array<{ value: unknown; depth: number; quotaContext: boolean }> = [
    { value: body, depth: 0, quotaContext: false },
  ];
  const seen = new Set<object>();
  while (pending.length) {
    const current = pending.pop()!;
    if (!current.value || typeof current.value !== 'object' || Array.isArray(current.value))
      continue;
    if (seen.has(current.value)) continue;
    seen.add(current.value);
    const record = current.value as Record<string, unknown>;
    const normalizedKeys = new Map(
      Object.entries(record).map(([key, value]) => [
        key.toLowerCase().replace(/[^a-z0-9]/g, ''),
        value,
      ]),
    );
    for (const [key, value] of normalizedKeys) {
      const number = finiteNumber(value);
      if (number !== null && POSITIVE_CREDIT_FIELDS.has(key) && number > 0) return true;
      if (
        number !== null &&
        POSITIVE_REMAINING_PERCENT_FIELDS.has(key) &&
        number > 0 &&
        number <= 100
      )
        return true;
    }
    const totalCredits = finiteNumber(normalizedKeys.get('totalcredits'));
    const totalUsage = finiteNumber(normalizedKeys.get('totalusage'));
    if (totalCredits !== null && totalUsage !== null && totalCredits - totalUsage > 0) return true;
    if (current.quotaContext) {
      const usagePercent = finiteNumber(
        normalizedKeys.get('usagepercent') ??
          normalizedKeys.get('usedpercent') ??
          normalizedKeys.get('percentused') ??
          normalizedKeys.get('percentageused') ??
          normalizedKeys.get('usagepercentage'),
      );
      if (usagePercent !== null && usagePercent >= 0 && usagePercent < 100) return true;
      const remaining = finiteNumber(normalizedKeys.get('remaining'));
      const limit = finiteNumber(normalizedKeys.get('limit'));
      const used = finiteNumber(normalizedKeys.get('used'));
      const total = finiteNumber(normalizedKeys.get('total'));
      if (remaining !== null && remaining > 0) return true;
      if (limit !== null && used !== null && limit - used > 0) return true;
      if (total !== null && used !== null && total - used > 0) return true;
    }
    if (current.depth < 4)
      for (const [key, value] of normalizedKeys)
        if (
          ACCOUNT_QUOTA_CONTAINERS.has(key) &&
          value &&
          typeof value === 'object' &&
          !Array.isArray(value)
        )
          pending.push({
            value,
            depth: current.depth + 1,
            quotaContext: current.quotaContext || key !== 'data',
          });
  }
  return false;
}

export function routerModelIds(body: unknown): Array<{
  id: string;
  name: string;
  contextTokens: number | null;
  availableTokens: number | null;
  supportsTools: boolean | null;
  isFree: boolean;
}> {
  const wrappedEntries =
    body && typeof body === 'object' && !Array.isArray(body)
      ? ['data', 'models', 'items', 'results', 'model_list', 'modelList']
          .map((key) => (body as Record<string, unknown>)[key])
          .find(Array.isArray)
      : null;
  const entries = Array.isArray(body) ? body : Array.isArray(wrappedEntries) ? wrappedEntries : [];
  const output = new Map<
    string,
    {
      id: string;
      name: string;
      contextTokens: number | null;
      availableTokens: number | null;
      supportsTools: boolean | null;
      isFree: boolean;
    }
  >();
  for (const item of entries.slice(0, 2000)) {
    if (!item || typeof item !== 'object') continue;
    const itemRecord = item as Record<string, unknown>;
    const rawId =
      typeof itemRecord.id === 'string'
        ? itemRecord.id
        : typeof itemRecord.name === 'string'
          ? itemRecord.name
          : itemRecord.model;
    if (typeof rawId !== 'string') continue;
    const id = rawId.trim();
    if (!id || id.length > 200 || !/^[\w./:-]+$/.test(id)) continue;
    const nestedRecords = [
      itemRecord,
      itemRecord.metadata,
      itemRecord.quota,
      itemRecord.limits,
      itemRecord.usage,
      itemRecord.availability,
      itemRecord.entitlement,
    ].filter(
      (value): value is Record<string, unknown> =>
        !!value && typeof value === 'object' && !Array.isArray(value),
    );
    const findField = (keys: string[]) => {
      for (const record of nestedRecords)
        for (const key of keys)
          if (key in record && record[key] !== undefined && record[key] !== null)
            return record[key];
      return null;
    };
    const rawContext = findField(['context_length', 'context_window', 'contextWindow']);
    const context = finiteNumber(rawContext);
    const contextTokens =
      context !== null && Number.isSafeInteger(context) && context > 0 ? context : null;
    const rawAvailable = findField([
      'available_tokens',
      'remaining_tokens',
      'monthly_tokens_remaining',
      'tokens_remaining',
      'quota_remaining',
      'remaining_quota',
      'free_tokens_remaining',
      'limit_remaining',
    ]);
    const available = finiteNumber(rawAvailable);
    const availableTokens =
      available !== null && Number.isSafeInteger(available) && available >= 0 ? available : null;
    const rawSupportsTools = findField(['supports_tools', 'supportsTools', 'tool_calling']);
    const supportsTools = typeof rawSupportsTools === 'boolean' ? rawSupportsTools : null;
    const pricing = findField(['pricing', 'cost']);
    const prices =
      pricing && typeof pricing === 'object'
        ? ['prompt', 'completion', 'input', 'output']
            .map((key) => (pricing as Record<string, unknown>)[key])
            .filter((value) => value !== undefined && value !== null)
            .map((value) => (typeof value === 'string' ? Number(value) : value))
        : [];
    const isFree =
      id.toLowerCase().endsWith(':free') ||
      nestedRecords.some(
        (record) =>
          record.free === true ||
          record.is_free === true ||
          record.isFree === true ||
          record.free_tier === true ||
          record.free_usage_eligible === true,
      ) ||
      (prices.length >= 2 && prices.every((value) => typeof value === 'number' && value === 0));
    if (!output.has(id))
      output.set(id, {
        id,
        name: 'name' in item && typeof item.name === 'string' ? item.name.slice(0, 160) : id,
        contextTokens,
        availableTokens,
        supportsTools,
        isFree,
      });
  }
  return [...output.values()];
}
