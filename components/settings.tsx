'use client';
import { useState } from 'react';
import { Database, Palette } from 'lucide-react';
import { databaseLabel } from '@/lib/database-label';
import type { Appearance } from '@/lib/appearance';
import type { Theme } from '@/lib/themes';
import type { Status } from '@/lib/client-types';
import { AppearanceSettings, StorageSettings } from './settings-extras';
export { api } from '@/lib/client-api';

export function Settings({
  status,
  refresh,
  notify,
  theme,
  onThemeChange,
  initialTab = 'appearance',
  appearance,
  onAppearanceChange,
}: {
  status: Status;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab === 'storage' ? 'storage' : 'appearance');
  return (
    <div className="page-content settings-page">
      <div className="page-heading">
        <div className="eyebrow">A QUIETER, CLEARER WORKSPACE</div>
        <h1>Settings</h1>
        <p>
          Manage your workspace preferences, data, providers, integrations, and tools in one place.
        </p>
      </div>
      <div className="tabs settings-tabs" role="tablist" aria-label="Workspace settings">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'appearance'}
          className={tab === 'appearance' ? 'active' : ''}
          onClick={() => setTab('appearance')}
        >
          <Palette size={15} /> Appearance
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'storage'}
          className={tab === 'storage' ? 'active' : ''}
          onClick={() => setTab('storage')}
        >
          <Database size={15} /> Database
        </button>
      </div>
      {tab === 'appearance' ? (
        <AppearanceSettings
          theme={theme}
          onChange={onThemeChange}
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
          database={!!status.databaseConfigured}
          storageName={databaseLabel(status)}
        />
      ) : (
        <StorageSettings status={status} refresh={refresh} notify={notify} />
      )}
    </div>
  );
}
