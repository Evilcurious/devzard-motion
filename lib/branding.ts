import { defaultAppearance, normalizeAppearance, type Appearance } from './appearance';
import { isTheme, type Theme } from './themes';
import { readConnection, saveConnection } from './connection-store';

export type WorkspaceBranding = {
  theme: Theme;
  appearance: Appearance;
  logoDataUrl: string | null;
};

export const defaultBranding: WorkspaceBranding = {
  theme: 'green',
  appearance: defaultAppearance,
  logoDataUrl: null,
};

const safeLogo = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= 350_000 &&
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);

export function normalizeBranding(value: unknown): WorkspaceBranding {
  if (!value || typeof value !== 'object') return defaultBranding;
  const saved = value as Partial<WorkspaceBranding>;
  return {
    theme: isTheme(saved.theme) ? saved.theme : defaultBranding.theme,
    appearance: normalizeAppearance(saved.appearance),
    logoDataUrl: safeLogo(saved.logoDataUrl) ? saved.logoDataUrl : null,
  };
}

export async function getWorkspaceBranding() {
  return normalizeBranding(await readConnection<WorkspaceBranding>('workspace_branding', 'owner'));
}

export async function saveWorkspaceBranding(value: WorkspaceBranding) {
  await saveConnection('workspace_branding', value, 'owner');
}
