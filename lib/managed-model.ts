import { readConnection } from './connection-store';
import type { ModelSettings } from './ai';

export type ManagedModelConfig = {
  provider: ModelSettings['provider'];
  model: string;
  baseURL: string;
  key: string;
  configured: boolean;
};

export async function getManagedModelConfig(): Promise<ManagedModelConfig> {
  const saved = await readConnection<ModelSettings>('model', 'owner');
  const envProvider = process.env.AI_PROVIDER;
  const provider =
    saved?.provider ||
    (envProvider === 'ollama' || envProvider === 'compatible' || envProvider === 'openai'
      ? envProvider
      : 'openai');
  const key =
    saved?.key ||
    (provider === (process.env.AI_PROVIDER || 'openai') ? process.env.AI_API_KEY : '') ||
    '';
  const baseURL = (
    saved?.baseURL ||
    (provider === 'ollama'
      ? process.env.OLLAMA_BASE_URL ||
        (process.env.AI_PROVIDER === 'ollama' ? process.env.AI_BASE_URL : '') ||
        'http://localhost:11434/v1'
      : provider === 'compatible'
        ? process.env.AI_BASE_URL || ''
        : 'https://api.openai.com/v1')
  ).replace(/\/$/, '');
  return {
    provider,
    model:
      saved?.model ||
      (provider === (process.env.AI_PROVIDER || 'openai') ? process.env.AI_MODEL : '') ||
      (provider === 'ollama' ? 'qwen2.5:7b' : 'gpt-4o-mini'),
    baseURL,
    key,
    configured: provider === 'ollama' || (provider === 'openai' ? !!key : !!baseURL),
  };
}
