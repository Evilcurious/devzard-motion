'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Activity, Conversation, Status, Workflow } from '@/lib/client-types';
import { initialWorkflows } from '@/lib/client-types';
import { isTheme, type Theme } from '@/lib/themes';
export type WorkspaceData = {
  conversations: Conversation[];
  activities: Activity[];
  workflows: Workflow[];
  theme: Theme;
};
const empty = (): WorkspaceData => ({
  conversations: [],
  activities: [],
  workflows: initialWorkflows,
  theme: 'green',
});
function localData(): WorkspaceData {
  const saved = JSON.parse(localStorage.getItem('relay.workspace.v1') || '{}');
  return {
    conversations: Array.isArray(saved.conversations) ? saved.conversations : [],
    activities: Array.isArray(saved.activities) ? saved.activities : [],
    workflows: Array.isArray(saved.workflows) ? saved.workflows : initialWorkflows,
    theme: isTheme(saved.theme) ? saved.theme : 'green',
  };
}
function sanitized(value: WorkspaceData): WorkspaceData {
  return {
    ...value,
    conversations: value.conversations.map((c) => ({
      ...c,
      messages: c.messages.map((m) => ({
        ...m,
        proposals: m.proposals?.map((p) => ({ ...p, token: '' })),
      })),
    })),
  };
}
export function useWorkspaceStorage(
  status: Status | null,
  value: WorkspaceData,
  onLoad: (value: WorkspaceData) => void,
) {
  const [hydrated, setHydrated] = useState(false);
  const [syncState, setSyncState] = useState<'loading' | 'local' | 'saving' | 'saved' | 'error'>(
    'loading',
  );
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const latest = useRef(value);
  latest.current = value;
  const load = useRef(onLoad);
  load.current = onLoad;
  const revision = useRef<number | null>(null);
  const saved = useRef('');
  const busy = useRef(false);
  const blocked = useRef(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authenticated = status?.authenticated;
  const database = !!status?.databaseConfigured;
  useEffect(() => {
    const id = ++generation.current;
    let disposed = false;
    setHydrated(false);
    saved.current = '';
    revision.current = null;
    blocked.current = false;
    if (!authenticated) return;
    setSyncState('loading');
    (async () => {
      try {
        let data = empty();
        if (database) {
          const response = await fetch('/api/workspace', { cache: 'no-store' });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Could not load database history.');
          if (disposed) return;
          revision.current = result.revision;
          if (result.data) {
            data = result.data;
            saved.current = JSON.stringify(sanitized(data));
          } else {
            data = localData();
          } // First connection only: import browser history into an empty database.
        } else data = localData();
        if (disposed) return;
        load.current(data);
        setError('');
        setSyncState(database ? 'saved' : 'local');
      } catch (e) {
        if (disposed) return;
        blocked.current = true;
        setError((e as Error).message);
        setSyncState('error');
        // Keep an offline draft available. Never write it over a database that failed to load.
        try {
          load.current(localData());
        } catch {
          load.current(empty());
        }
      } finally {
        if (!disposed && id === generation.current) setHydrated(true);
      }
    })();
    return () => {
      disposed = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [authenticated, database]);
  useEffect(() => {
    if (!hydrated || !authenticated) return;
    const snapshot = sanitized(value);
    try {
      localStorage.setItem('relay.workspace.v1', JSON.stringify(snapshot));
    } catch {
      setError('Browser backup could not be saved. Storage may be full.');
      if (!database) setSyncState('error');
    }
    if (!database || blocked.current) return;
    const id = generation.current;
    const flush = async () => {
      if (busy.current || blocked.current || id !== generation.current) return;
      busy.current = true;
      try {
        // Serialize saves. Edits made during a request are sent next with the returned revision.
        while (id === generation.current && !blocked.current) {
          const json = JSON.stringify(sanitized(latest.current));
          if (json === saved.current) break;
          if (revision.current === null)
            throw new Error(
              'History was not loaded. Download your draft, then reload before saving.',
            );
          if (json.length > 3_400_000)
            throw new Error(
              'Workspace exceeds the 3.4 MB save limit. Download a backup and clear old history.',
            );
          setSyncState('saving');
          const response = await fetch('/api/workspace', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: `{"revision":${revision.current},"data":${json}}`,
          });
          const result = await response.json();
          if (id !== generation.current) return;
          if (!response.ok)
            throw new Error(
              result.error || 'Database save failed. Your local draft is still available.',
            );
          revision.current = result.revision;
          saved.current = json;
        }
        if (id === generation.current) {
          setSyncState('saved');
          setError('');
        }
      } catch (e) {
        if (id === generation.current) {
          blocked.current = true;
          setSyncState('error');
          setError((e as Error).message);
        }
      } finally {
        busy.current = false;
      }
    };
    if (JSON.stringify(snapshot) !== saved.current) setSyncState('saving');
    timer.current = setTimeout(flush, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, hydrated, authenticated, database, retryCount]);
  // Prevent accidentally losing a write that has not reached PostgreSQL yet.
  useEffect(() => {
    if (syncState !== 'saving') return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [syncState]);
  const retry = useCallback(() => {
    if (revision.current === null) {
      setError(
        'The database was not loaded. Download your draft first, then reload after fixing the connection.',
      );
      return;
    }
    blocked.current = false;
    setRetryCount((n) => n + 1);
  }, []);
  const downloadBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(sanitized(latest.current), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relay-workspace-backup.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);
  return { hydrated, syncState, syncError: error, retry, downloadBackup };
}
