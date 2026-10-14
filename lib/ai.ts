import { cookies } from 'next/headers';
import { unseal } from './security';
export type ModelSettings = {
  provider: 'openai' | 'ollama' | 'compatible';
  model: string;
  key?: string;
};
export async function aiConfig() {
  const jar = await cookies();
  const saved = unseal<ModelSettings>(jar.get('relay_model')?.value || '');
  const provider = saved?.provider || process.env.AI_PROVIDER || 'openai';
  const key =
    saved?.key ||
    (provider === (process.env.AI_PROVIDER || 'openai') ? process.env.AI_API_KEY : '') ||
    '';
  const baseURL = (
    provider === 'ollama'
      ? process.env.OLLAMA_BASE_URL ||
        (process.env.AI_PROVIDER === 'ollama' ? process.env.AI_BASE_URL : '') ||
        'http://localhost:11434/v1'
      : provider === 'compatible'
        ? process.env.AI_BASE_URL || ''
        : 'https://api.openai.com/v1'
  ).replace(/\/$/, '');
  return {
    provider,
    model:
      saved?.model ||
      process.env.AI_MODEL ||
      (provider === 'ollama' ? 'qwen2.5:7b' : 'gpt-4o-mini'),
    baseURL,
    key,
    configured: provider === 'ollama' || (provider === 'openai' ? !!key : !!baseURL),
  };
}
