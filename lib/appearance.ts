export const fontOptions = [
  { id: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'georgia', label: 'Georgia', stack: 'Georgia, serif' },
  { id: 'palatino', label: 'Palatino', stack: 'Palatino, "Palatino Linotype", serif' },
  { id: 'times', label: 'Times New Roman', stack: '"Times New Roman", Times, serif' },
  { id: 'trebuchet', label: 'Trebuchet MS', stack: '"Trebuchet MS", sans-serif' },
  { id: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'tahoma', label: 'Tahoma', stack: 'Tahoma, Geneva, sans-serif' },
  { id: 'courier', label: 'Courier New', stack: '"Courier New", monospace' },
] as const;

export type FontId = (typeof fontOptions)[number]['id'];
export type FontFormat = 'woff2' | 'woff' | 'ttf' | 'otf';
export type CustomFont = { name: string; format: FontFormat; data: string } | null;
export type Appearance = { accentColor: string | null; fontId: FontId; customFont: CustomFont };
export const defaultAppearance: Appearance = {
  accentColor: null,
  fontId: 'arial',
  customFont: null,
};
const isFontId = (value: unknown): value is FontId => fontOptions.some((font) => font.id === value);
const isFontFormat = (value: unknown): value is FontFormat =>
  value === 'woff2' || value === 'woff' || value === 'ttf' || value === 'otf';
export const isAccentColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

export function normalizeAppearance(value: unknown): Appearance {
  if (!value || typeof value !== 'object') return defaultAppearance;
  const saved = value as Partial<Appearance>;
  let customFont: CustomFont = null;
  if (
    saved.customFont &&
    typeof saved.customFont.name === 'string' &&
    saved.customFont.name.length <= 100 &&
    isFontFormat(saved.customFont.format) &&
    typeof saved.customFont.data === 'string' &&
    saved.customFont.data.length <= 1_400_000 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(saved.customFont.data)
  ) {
    customFont = {
      name: saved.customFont.name,
      format: saved.customFont.format,
      data: saved.customFont.data,
    };
  }
  return {
    accentColor: isAccentColor(saved.accentColor) ? saved.accentColor : null,
    fontId: isFontId(saved.fontId) ? saved.fontId : 'arial',
    customFont,
  };
}
