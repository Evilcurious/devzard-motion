export const themes = [
  { id: 'light', label: 'Light · pure white', color: '#111111' },
  { id: 'dark', label: 'Dark · pure black', color: '#ffffff' },
  { id: 'green', label: 'Green & white', color: '#315944' },
  { id: 'black', label: 'Black & white', color: '#27272a' },
  { id: 'red', label: 'Red & white', color: '#ac3039' },
  { id: 'blue', label: 'Blue & white', color: '#2457a6' },
  { id: 'yellow', label: 'Yellow & white', color: '#8b6900' },
  { id: 'gold', label: 'Gold & white', color: '#926719' },
] as const;
export type Theme = (typeof themes)[number]['id'];
export function isTheme(value: unknown): value is Theme {
  return themes.some((theme) => theme.id === value);
}
