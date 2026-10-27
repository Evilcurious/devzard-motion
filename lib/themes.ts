export const themes = [
  {
    id: 'light',
    label: 'Soft white',
    color: '#34745f',
    background: '#f5f8f6',
    surface: '#ffffff',
    ink: '#20352b',
  },
  {
    id: 'dark',
    label: 'Midnight',
    color: '#8ed8b8',
    background: '#111815',
    surface: '#1b241f',
    ink: '#e7f0eb',
  },
  {
    id: 'green',
    label: 'Sage garden',
    color: '#4c8066',
    background: '#eff5f0',
    surface: '#ffffff',
    ink: '#233a2d',
  },
  {
    id: 'forest',
    label: 'Forest green',
    color: '#2e7250',
    background: '#eaf3ed',
    surface: '#ffffff',
    ink: '#1e3327',
  },
  {
    id: 'black',
    label: 'Obsidian black',
    color: '#52677f',
    background: '#0b0d10',
    surface: '#15191f',
    ink: '#f1f4f8',
  },
  {
    id: 'red',
    label: 'Soft rose',
    color: '#bd586b',
    background: '#fbf2f3',
    surface: '#ffffff',
    ink: '#422b30',
  },
  {
    id: 'blue',
    label: 'Ocean mist',
    color: '#3977bd',
    background: '#f1f5fb',
    surface: '#ffffff',
    ink: '#25344a',
  },
  {
    id: 'yellow',
    label: 'Citrus cream',
    color: '#987425',
    background: '#faf7ec',
    surface: '#ffffff',
    ink: '#413819',
  },
  {
    id: 'gold',
    label: 'Warm sand',
    color: '#a8754c',
    background: '#f7f2eb',
    surface: '#ffffff',
    ink: '#403126',
  },
] as const;
export type Theme = (typeof themes)[number]['id'];
export function isTheme(value: unknown): value is Theme {
  return themes.some((theme) => theme.id === value);
}
