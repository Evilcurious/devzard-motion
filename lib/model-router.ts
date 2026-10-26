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
  | 'firecrawl'
  | 'parallel'
  | 'keenable';
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
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'models',
    baseURL: 'https://openrouter.ai/api/v1',
    keyRequired: true,
    docsURL: 'https://openrouter.ai/settings/keys',
  },
  {
    id: 'ollama-cloud',
    name: 'Ollama Cloud',
    category: 'models',
    baseURL: 'https://ollama.com/v1',
    keyRequired: true,
    docsURL: 'https://ollama.com/settings/keys',
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
    id: 'firecrawl',
    name: 'Firecrawl',
    category: 'search',
    baseURL: null,
    keyRequired: true,
    docsURL: 'https://firecrawl.dev',
    note: 'Search credential management only; Relay does not invoke this provider yet.',
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
  }>;
  contextTokens: number | null;
  availableTokens: number | null;
};
export type RouterStrategy =
  'manual' | 'fallback' | 'fusion' | 'balanced' | 'fastest' | 'reliable' | 'smartest';
export type RouterSelection = {
  providerId: RouterProviderId;
  modelId: string;
  strategy: RouterStrategy;
  fallbackChain: Array<{ providerId: RouterProviderId; modelId: string }>;
  fusionModels: Array<{ providerId: RouterProviderId; modelId: string }>;
};

export function getRouterProvider(id: string): RouterProvider | undefined {
  return routerProviders.find((provider) => provider.id === id);
}

export function canonicalModelKey(modelId: string): string {
  return modelId.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function routerModelIds(body: unknown): Array<{
  id: string;
  name: string;
  contextTokens: number | null;
  availableTokens: number | null;
  supportsTools: boolean | null;
}> {
  const entries = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && 'data' in body && Array.isArray(body.data)
      ? body.data
      : body && typeof body === 'object' && 'models' in body && Array.isArray(body.models)
        ? body.models
        : [];
  const output = new Map<
    string,
    {
      id: string;
      name: string;
      contextTokens: number | null;
      availableTokens: number | null;
      supportsTools: boolean | null;
    }
  >();
  for (const item of entries.slice(0, 2000)) {
    if (!item || typeof item !== 'object') continue;
    const rawId = 'id' in item ? item.id : 'name' in item ? item.name : undefined;
    if (typeof rawId !== 'string') continue;
    const id = rawId.trim();
    if (!id || id.length > 200 || !/^[\w./:-]+$/.test(id)) continue;
    const rawContext =
      'context_length' in item
        ? item.context_length
        : 'context_window' in item
          ? item.context_window
          : 'contextWindow' in item
            ? item.contextWindow
            : null;
    const contextTokens =
      typeof rawContext === 'number' && Number.isSafeInteger(rawContext) && rawContext > 0
        ? rawContext
        : null;
    const rawAvailable =
      'available_tokens' in item
        ? item.available_tokens
        : 'remaining_tokens' in item
          ? item.remaining_tokens
          : 'monthly_tokens_remaining' in item
            ? item.monthly_tokens_remaining
            : null;
    const availableTokens =
      typeof rawAvailable === 'number' && Number.isSafeInteger(rawAvailable) && rawAvailable >= 0
        ? rawAvailable
        : null;
    const supportsTools =
      'supports_tools' in item && typeof item.supports_tools === 'boolean'
        ? item.supports_tools
        : null;
    if (!output.has(id))
      output.set(id, {
        id,
        name: 'name' in item && typeof item.name === 'string' ? item.name.slice(0, 160) : id,
        contextTokens,
        availableTokens,
        supportsTools,
      });
  }
  return [...output.values()];
}
