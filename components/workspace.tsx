'use client';
import { databaseLabel } from '@/lib/database-label';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity as ActivityIcon,
  BarChart3,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cpu,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe2,
  Github,
  History,
  Image as ImageIcon,
  LayoutGrid,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Triangle,
  Unplug,
  Video,
  Workflow as WorkflowIcon,
  X,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type { AIDensity, RouterModel, RouterTarget } from '@/lib/model-router';
import { isImageGenerationPrompt } from '@/lib/media-intent';
import type {
  Activity,
  Attachment,
  Conversation,
  Message,
  Page,
  Proposal,
  Status,
  Workflow,
} from '@/lib/client-types';
import { initialWorkflows } from '@/lib/client-types';
import { AppIcon, EmptyState, Mark, Modal, Steps, WorkflowCard } from './ui';
import { api, Settings } from './settings';
import { useWorkspaceStorage, type WorkspaceData } from './use-workspace-storage';
import { type Theme } from '@/lib/themes';
import { ModelHub } from './model-hub';
import { Analytics } from './analytics';
import {
  defaultAppearance,
  fontOptions,
  normalizeAppearance,
  type Appearance,
} from '@/lib/appearance';

const titles: Record<Page, string> = {
  chat: 'Agent chat',
  workflows: 'Workflows',
  models: 'Models & providers',
  connections: 'Connections',
  activity: 'Activity',
  analytics: 'Analytics',
  settings: 'Settings',
};
const navigation = [
  { id: 'chat', icon: MessageSquare, label: 'Agent chat' },
  { id: 'workflows', icon: WorkflowIcon, label: 'Workflows' },
  { id: 'models', icon: Cpu, label: 'Models & providers' },
  { id: 'connections', icon: LayoutGrid, label: 'Connections' },
  { id: 'activity', icon: ActivityIcon, label: 'Activity' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
] as const;
const uid = () => crypto.randomUUID();
const friendlyDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function Workspace() {
  const [page, setPage] = useState<Page>('chat');
  const [settingsTab, setSettingsTab] = useState('appearance');
  const [status, setStatus] = useState<Status | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows);
  const [theme, setTheme] = useState<Theme>('light');
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  const [text, setText] = useState('');
  const [mediaMode, setMediaMode] = useState<'chat' | 'image' | 'video'>('chat');
  const [webSearch, setWebSearch] = useState(false);
  const [density, setDensity] = useState<AIDensity>('auto');
  const [densityReady, setDensityReady] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelChoices, setModelChoices] = useState<RouterModel[]>([]);
  const [routerSelection, setRouterSelection] = useState<RouterTarget | null>(null);
  const [routerAutoPick, setRouterAutoPick] = useState(false);
  const [modelPickerBusy, setModelPickerBusy] = useState(false);
  const [modelPickerError, setModelPickerError] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<'search' | 'workflow' | 'help' | 'clear' | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [query, setQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const actionRef = useRef(false);
  const fileRequest = useRef(0);
  const active = conversations.find((c) => c.id === currentId);
  const messages = active?.messages || [];
  const notify = useCallback((message: string) => setToast(message), []);
  const closeModal = useCallback(() => setModal(null), []);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error();
      setStatus(await response.json());
    } catch {
      notify('Could not reach your workspace server. Please refresh the page.');
    }
  }, [notify]);
  useEffect(() => {
    refresh();
    const params = new URLSearchParams(window.location.search);
    if (params.has('connected')) {
      setPage('connections');
      notify(
        params.get('connected') === 'github'
          ? 'GitHub connected. Choose a repository to use in chats.'
          : 'Google connected. Gmail and Sheets are ready to use.',
      );
    }
    if (params.has('connection_error')) {
      setPage('connections');
      notify(params.get('connection_error')!);
    }
    if (params.has('connected') || params.has('connection_error'))
      window.history.replaceState({}, '', '/');
    function keyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setModal((m) => (m === 'search' ? null : 'search'));
      }
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [refresh, notify]);
  useEffect(() => {
    const saved = window.localStorage.getItem('relay-ai-density');
    if (saved && ['slow', 'fast', 'faster', 'high', 'auto'].includes(saved))
      setDensity(saved as AIDensity);
    setDensityReady(true);
  }, []);
  useEffect(() => {
    if (densityReady) window.localStorage.setItem('relay-ai-density', density);
  }, [density, densityReady]);
  useEffect(() => {
    if (!status?.authenticated) return;
    api<{ selection: (RouterTarget & { autoPick?: boolean }) | null }>(
      '/api/router/selection',
      undefined,
      'GET',
    )
      .then(({ selection }) => {
        setRouterSelection(selection);
        setRouterAutoPick(selection?.autoPick ?? true);
      })
      .catch(() => {});
  }, [status?.authenticated]);
  const snapshot = useMemo(
    () => ({ conversations, activities, workflows, theme, appearance }),
    [conversations, activities, workflows, theme, appearance],
  );
  const loadWorkspace = useCallback((data: WorkspaceData) => {
    setConversations(data.conversations);
    setActivities(data.activities);
    setWorkflows(data.workflows);
    setTheme(data.theme);
    setAppearance(normalizeAppearance(data.appearance));
  }, []);
  const storage = useWorkspaceStorage(status, snapshot, loadWorkspace);
  const hydrated = storage.hydrated;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    if (appearance.accentColor) root.style.setProperty('--user-accent', appearance.accentColor);
    else root.style.removeProperty('--user-accent');
    const selected = fontOptions.find((font) => font.id === appearance.fontId) || fontOptions[0];
    root.style.setProperty('--font', selected.stack);
    const font = appearance.customFont;
    if (!font) return;
    let cancelled = false;
    const face = new FontFace('Relay Custom', `url(data:font/${font.format};base64,${font.data})`, {
      style: 'normal',
      weight: '100 900',
    });
    face
      .load()
      .then((loaded) => {
        if (cancelled) return;
        document.fonts.add(loaded);
        root.style.setProperty('--font', `'Relay Custom', ${selected.stack}`);
      })
      .catch(() => {
        if (!cancelled) {
          root.style.setProperty('--font', selected.stack);
          notify(
            'Relay could not load that font file, so the selected built-in font is being used instead.',
          );
        }
      });
    return () => {
      cancelled = true;
      document.fonts.delete(face);
    };
  }, [theme, appearance, notify]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, busy]);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);
  function go(next: Page) {
    setPage(next);
    if (next === 'settings') setSettingsTab('appearance');
    setSidebar(false);
  }
  function openDatabaseSettings() {
    setSettingsTab('storage');
    setPage('settings');
    setSidebar(false);
  }
  function newChat(prompt = '') {
    if (busyRef.current || uploading || actionRef.current) {
      notify('Wait for the current task to finish first.');
      return;
    }
    setCurrentId(null);
    setText(prompt);
    setAttachment(null);
    setMediaMode('chat');
    setWebSearch(false);
    go('chat');
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  function openConversation(id: string) {
    if (busyRef.current || uploading || actionRef.current) {
      notify('Wait for the current task to finish first.');
      return;
    }
    setCurrentId(id);
    setText('');
    setAttachment(null);
    go('chat');
    setModal(null);
  }
  function addActivity(title: string, description: string, type: Activity['type']) {
    setActivities((a) =>
      [{ id: uid(), title, description, type, at: new Date().toISOString() }, ...a].slice(0, 200),
    );
  }
  function updateMessages(id: string, updater: (messages: Message[]) => Message[]) {
    setConversations((all) =>
      all.map((c) =>
        c.id === id
          ? { ...c, messages: updater(c.messages), updated: new Date().toISOString() }
          : c,
      ),
    );
  }
  async function openModelPicker() {
    setModelPickerOpen(true);
    setModelPickerBusy(true);
    setModelPickerError('');
    try {
      const [catalog, saved] = await Promise.all([
        api<{ models: RouterModel[] }>('/api/router/models', undefined, 'GET'),
        api<{ selection: (RouterTarget & { autoPick?: boolean }) | null }>(
          '/api/router/selection',
          undefined,
          'GET',
        ),
      ]);
      setModelChoices(catalog.models);
      setRouterSelection(saved.selection);
      setRouterAutoPick(saved.selection?.autoPick ?? true);
    } catch (error) {
      setModelPickerError((error as Error).message);
    } finally {
      setModelPickerBusy(false);
    }
  }
  async function chooseChatModel(model: RouterModel, provider: RouterModel['providers'][number]) {
    const target: RouterTarget = {
      providerId: provider.id,
      modelId: provider.modelId,
      availableTokens: provider.availableTokens,
      contextTokens: provider.contextTokens,
      supportsTools: provider.supportsTools,
      isFree: provider.isFree,
    };
    setModelPickerBusy(true);
    setModelPickerError('');
    try {
      await api('/api/router/selection', {
        ...target,
        strategy: 'auto',
        autoPick: false,
        fusionModels: [],
      });
      setRouterSelection(target);
      setRouterAutoPick(false);
      setModelPickerOpen(false);
      await refresh();
      notify(
        `${model.name} · ${provider.name} selected. Relay will use only this model; switch to Auto-pick if you want it to choose another when unavailable.`,
      );
    } catch (error) {
      setModelPickerError((error as Error).message);
    } finally {
      setModelPickerBusy(false);
    }
  }
  async function chooseAutomaticModel() {
    const firstProvider = modelChoices.flatMap((model) =>
      model.providers.map((provider) => ({ model, provider })),
    )[0];
    const target =
      routerSelection ||
      (firstProvider
        ? {
            providerId: firstProvider.provider.id,
            modelId: firstProvider.provider.modelId,
            availableTokens: firstProvider.provider.availableTokens,
            contextTokens: firstProvider.provider.contextTokens,
            supportsTools: firstProvider.provider.supportsTools,
            isFree: firstProvider.provider.isFree,
          }
        : null);
    if (!target) {
      setModelPickerError('No eligible API models are available to auto-select.');
      return;
    }
    setModelPickerBusy(true);
    setModelPickerError('');
    try {
      await api('/api/router/selection', {
        ...target,
        strategy: 'auto',
        autoPick: true,
        fusionModels: [],
      });
      setRouterSelection(target);
      setRouterAutoPick(true);
      setModelPickerOpen(false);
      await refresh();
      notify(
        `Auto-pick enabled. The best eligible model will be chosen using ${density} chat density.`,
      );
    } catch (error) {
      setModelPickerError((error as Error).message);
    } finally {
      setModelPickerBusy(false);
    }
  }
  async function send() {
    if (!hydrated || busyRef.current || uploading || (!text.trim() && !attachment)) return;
    const content = text.trim() || 'Please summarize the attached document.';
    const inferredImageRequest =
      mediaMode === 'chat' && !webSearch && !attachment && isImageGenerationPrompt(content);
    const mode = inferredImageRequest ? 'image' : mediaMode;
    if (inferredImageRequest) setMediaMode('image');
    const message: Message = {
      id: uid(),
      role: 'user',
      content,
      ...(attachment ? { attachment } : {}),
    };
    const id = currentId || uid();
    const history = [...messages, message];
    if (!currentId) {
      setConversations((all) => [
        {
          id,
          title: content.length > 43 ? content.slice(0, 43) + '…' : content,
          messages: [message],
          updated: new Date().toISOString(),
        },
        ...all,
      ]);
      setCurrentId(id);
    } else updateMessages(id, (old) => [...old, message]);
    setText('');
    setAttachment(null);
    setBusy(true);
    busyRef.current = true;
    abortRef.current = new AbortController();
    try {
      const response = await fetch(mode === 'chat' ? '/api/chat' : '/api/router/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify(
          mode === 'chat'
            ? {
                density,
                webSearch,
                messages: history
                  .filter((m) => !m.error)
                  .slice(-24)
                  .map((m) => ({
                    role: m.role,
                    content:
                      m.content +
                      (m.attachment
                        ? `\n\n<untrusted_document name=${JSON.stringify(m.attachment.name)}>\n${m.attachment.text}\n</untrusted_document>`
                        : '') +
                      (m.proposals?.length
                        ? `\n[UI action status: ${m.proposals.map((p) => `${p.name}: ${p.state || 'awaiting approval'}${p.result ? ` (${p.result})` : ''}`).join('; ')}]`
                        : ''),
                  })),
              }
            : { action: 'generate', type: mode, prompt: content },
        ),
      });
      let result = await response.json();
      if (!response.ok) {
        if (response.status === 401) refresh();
        throw new Error(result.error || 'Could not complete this request.');
      }
      if (mode === 'image' && result.status === 'processing') {
        const deadline = Date.now() + 180_000;
        while (result.status === 'processing' && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          const poll = await fetch('/api/router/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortRef.current?.signal,
            body: JSON.stringify({ action: 'poll', token: result.token }),
          });
          const next = await poll.json();
          if (!poll.ok) throw new Error(next.error || 'Could not check image generation status.');
          result = next;
        }
        if (result.status !== 'succeeded')
          throw new Error(
            'The image is still processing. Try again in a moment; your provider may take a little longer.',
          );
      }
      const assistantResult =
        mode === 'chat'
          ? result
          : {
              content: `Image generated with ${result.providerName} (${result.modelId}).`,
              media: {
                type: 'image' as const,
                urls: [result.url],
                providerName: result.providerName,
                modelId: result.modelId,
              },
            };
      if (mode !== 'chat') setMediaMode('chat');
      if (mode === 'chat') setWebSearch(false);
      if (result.modelUsed) {
        setRouterSelection({
          providerId: result.modelUsed.providerId,
          modelId: result.modelUsed.modelId,
        });
        if (typeof result.autoPick === 'boolean') setRouterAutoPick(result.autoPick);
      }
      updateMessages(id, (old) => [...old, { id: uid(), role: 'assistant', ...assistantResult }]);
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      updateMessages(id, (old) => [
        ...old,
        {
          id: uid(),
          role: 'assistant',
          error: true,
          content: aborted
            ? 'Response stopped. No email was sent and no spreadsheet was changed.'
            : (error as Error).message,
        },
      ]);
    } finally {
      setBusy(false);
      busyRef.current = false;
      abortRef.current = null;
    }
  }
  async function upload(file?: File) {
    if (!file || uploading || busyRef.current) return;
    if (file.size > 3_000_000) {
      notify('Choose a file smaller than 3 MB.');
      return;
    }
    const requestId = ++fileRequest.current;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not read this file.');
      if (fileRequest.current !== requestId) return;
      setAttachment(data);
      addActivity('Document ready', data.name, 'file');
      if (data.truncated)
        notify('Large document: only the first 50 pages and 40,000 characters will be used.');
      inputRef.current?.focus();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  async function approve(messageId: string, proposal: Proposal) {
    if (!currentId || actionRef.current) return;
    actionRef.current = true;
    setApproving(proposal.id);
    const id = currentId;
    try {
      const result = await api<{ message: string; branchUrl?: string }>('/api/actions', {
        token: proposal.token,
      });
      updateMessages(id, (list) =>
        list.map((m) =>
          m.id === messageId
            ? {
                ...m,
                proposals: m.proposals?.map((p) =>
                  p.id === proposal.id
                    ? {
                        ...p,
                        state: 'done',
                        result: result.message,
                        resultUrl: result.branchUrl,
                        token: '',
                      }
                    : p,
                ),
              }
            : m,
        ),
      );
      addActivity(
        proposal.name === 'github_push_files'
          ? 'GitHub branch created'
          : proposal.name === 'send_email'
            ? 'Email sent'
            : 'Spreadsheet updated',
        result.message,
        proposal.name === 'send_email'
          ? 'email'
          : proposal.name === 'append_to_sheet'
            ? 'sheet'
            : 'file',
      );
      notify(result.message);
    } catch (error) {
      const result = `${(error as Error).message} Check the destination before preparing another action; a network error does not always mean the operation failed.`;
      updateMessages(id, (list) =>
        list.map((m) =>
          m.id === messageId
            ? {
                ...m,
                proposals: m.proposals?.map((p) =>
                  p.id === proposal.id ? { ...p, state: 'failed', result, token: '' } : p,
                ),
              }
            : m,
        ),
      );
      addActivity('Action needs attention', result, 'error');
    } finally {
      actionRef.current = false;
      setApproving(null);
    }
  }
  function cancel(messageId: string, proposalId: string) {
    if (!currentId) return;
    updateMessages(currentId, (list) =>
      list.map((m) =>
        m.id === messageId
          ? {
              ...m,
              proposals: m.proposals?.map((p) =>
                p.id === proposalId ? { ...p, state: 'cancelled', token: '' } : p,
              ),
            }
          : m,
      ),
    );
  }
  async function connect() {
    try {
      const data = await api<{ url: string }>('/api/google/connect');
      window.location.assign(data.url);
    } catch (error) {
      notify((error as Error).message);
    }
  }
  const setupCount = 1 + (status?.aiConfigured ? 1 : 0) + (status?.googleEmail ? 1 : 0);
  const composer = (
    <div className={`composer-wrap ${messages.length ? 'in-chat' : ''}`}>
      <div
        className={`composer ${uploading ? 'is-uploading' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files[0]);
        }}
      >
        {(attachment || uploading) && (
          <div className="attachment-chip">
            <span className="file-mini">
              {uploading ? <LoaderCircle size={16} className="spin" /> : <FileText size={16} />}
            </span>
            <span>
              {uploading ? 'Reading your document…' : attachment?.name}
              <small>
                {attachment &&
                  `${attachment.text.length.toLocaleString()} characters ready${attachment.truncated ? ' · truncated' : ''}`}
              </small>
            </span>
            {!uploading && (
              <button
                className="icon-button"
                aria-label="Remove attachment"
                onClick={() => setAttachment(null)}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            mediaMode === 'image'
              ? 'Describe the image you want to create…'
              : messages.length
                ? 'What would you like to do next?'
                : 'Ask anything, or hand off a task…'
          }
          aria-label="Message your agent"
          rows={2}
          maxLength={12000}
          disabled={busy || !hydrated}
        />
        <div className="composer-toolbar">
          <div className="composer-tools">
            <div className="composer-mode-tools" role="group" aria-label="Message mode">
              <button
                className={mediaMode === 'chat' && !webSearch ? 'active' : ''}
                onClick={() => {
                  setMediaMode('chat');
                  setWebSearch(false);
                }}
                title="Chat with your selected or automatic model"
              >
                <MessageSquare size={14} /> Chat
              </button>
              <button
                className={mediaMode === 'image' ? 'active' : ''}
                onClick={() => {
                  setMediaMode('image');
                  setWebSearch(false);
                }}
                title="Generate an image with a connected image-capable provider"
              >
                <ImageIcon size={14} /> Image
              </button>
              <button
                disabled
                title="Video generation is not available from the connected providers yet"
              >
                <Video size={14} /> Video
              </button>
              <button
                className={webSearch ? 'active' : ''}
                onClick={() => {
                  setMediaMode('chat');
                  setWebSearch((value) => !value);
                }}
                title="Search the web and include sources with your answer"
              >
                <Globe2 size={14} /> Web search
              </button>
            </div>
            <button
              className="icon-button attach-button"
              title="Attach PDF, TXT, CSV, Markdown or JSON (up to 3 MB)"
              aria-label="Attach a document"
              disabled={uploading || busy}
              onClick={() => fileRef.current?.click()}
            >
              <Plus size={21} />
            </button>
            <span className="toolbar-divider" />
            <button className="model-select" onClick={openModelPicker} aria-haspopup="dialog">
              <span className={`status-dot ${status?.aiConfigured ? '' : 'muted'}`} />
              {routerAutoPick && routerSelection
                ? `Auto · ${density}`
                : routerSelection?.modelId ||
                  (status?.aiConfigured ? status.model : 'Choose a model')}
              <ChevronDown size={13} />
            </button>
            <label className="density-control">
              <span>AI density</span>
              <select
                aria-label="AI density"
                title="Only API-listed models marked free or reporting remaining tokens are candidates. Slow favors quota then context; Fast favors quota then observed latency; Faster favors observed latency; High favors reported context; Auto favors quota."
                value={density}
                onChange={(event) => setDensity(event.target.value as AIDensity)}
                disabled={busy}
              >
                <option value="slow">Slow</option>
                <option value="fast">Fast</option>
                <option value="faster">Faster</option>
                <option value="high">High</option>
                <option value="auto">Auto</option>
              </select>
            </label>
          </div>
          <div className="send-tools">
            <span>Enter to send</span>
            {busy ? (
              <button
                className="send-button stop"
                onClick={() => abortRef.current?.abort()}
                aria-label="Stop response"
              >
                <Square size={15} fill="currentColor" />
              </button>
            ) : (
              <button
                className="send-button"
                onClick={send}
                disabled={!hydrated || uploading || (!text.trim() && !attachment)}
                aria-label="Send message"
              >
                <ArrowUp size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="composer-footnote">
        <ShieldCheck size={13} />
        <span>
          {mediaMode === 'image'
            ? 'Image jobs use your connected provider’s image service and may use its free allowance or account credits.'
            : webSearch
              ? 'Web search uses your saved Firecrawl key and returns clickable sources.'
              : 'You’re in control. Relay asks before taking action.'}
        </span>
      </div>
      <input
        hidden
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,.csv,.md,.json"
        onChange={(e) => upload(e.target.files?.[0])}
      />
    </div>
  );

  if (status && !status.authenticated)
    return <Login setupRequired={status.setupRequired} onLogin={refresh} />;
  if (!status || (status.authenticated && !hydrated))
    return (
      <div className="workspace-loading">
        <Mark />
        <p>{toast || 'Loading your workspace…'}</p>
        {toast && (
          <button className="button" onClick={refresh}>
            Retry connection
          </button>
        )}
      </div>
    );
  return (
    <div className="workspace">
      {sidebar && <div className="sidebar-overlay" onClick={() => setSidebar(false)} />}
      <aside className={`sidebar ${sidebar ? 'is-open' : ''}`}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            newChat();
          }}
        >
          <Mark />
          <span>
            relay<span className="brand-period">.</span>
          </span>
        </a>
        <button
          className="workspace-picker"
          onClick={() => {
            go('settings');
          }}
        >
          <span className="workspace-avatar">P</span>
          <span>
            Personal workspace<small>Just you. Supercharged.</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <button className="new-chat" onClick={() => newChat()}>
          <Plus size={17} />
          New conversation
        </button>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => go(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === 'connections' && status?.googleEmail && (
                <span className="nav-count">2</span>
              )}
              {item.id === 'chat' && page === 'chat' && <span className="active-nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="recent-heading">
          <span className="nav-caption">RECENT CONVERSATIONS</span>
          <button
            className="icon-button"
            onClick={() => {
              setQuery('');
              setModal('search');
            }}
            aria-label="Search conversations"
          >
            <Search size={13} />
          </button>
        </div>
        <div className="recent-list">
          {conversations.length ? (
            conversations.slice(0, 5).map((c) => (
              <button
                className={`recent-chat ${currentId === c.id && page === 'chat' ? 'selected' : ''}`}
                key={c.id}
                onClick={() => openConversation(c.id)}
              >
                <MessageSquare size={14} />
                <span>{c.title}</span>
              </button>
            ))
          ) : (
            <div className="recent-empty">
              A fresh start, a clear mind.
              <br />
              Your conversations will live here.
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          <button
            className="setup-card"
            onClick={() => go(status?.aiConfigured ? 'connections' : 'models')}
          >
            <span className="setup-title">
              <span>
                <Sparkles size={15} />
                Make yourself at home
              </span>
              <ChevronRight size={14} />
            </span>
            <span className="setup-description">A few steps to your everyday sidekick.</span>
            <span className="setup-progress">
              <span style={{ width: `${(setupCount / 3) * 100}%` }} />
            </span>
            <span className="setup-count">{setupCount} of 3 steps complete</span>
          </button>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => go('settings')}
          >
            <Settings2 size={18} />
            Settings
          </button>
          <button className="nav-item" onClick={() => setModal('help')}>
            <CircleHelp size={18} />
            Help & getting started
            <ArrowUpRight size={14} className="nav-end" />
          </button>
          <div className="profile">
            <span className="profile-avatar">Y</span>
            <div>
              Your workspace
              <small>
                <span className="status-dot" />
                {status?.deployment === 'vercel' ? 'Hosted on Vercel' : 'Self-hosted & yours'}
              </small>
            </div>
            {status?.passwordProtected ? (
              <button
                className="icon-button"
                title="Sign out"
                aria-label="Sign out"
                onClick={async () => {
                  await api('/api/auth/logout');
                  refresh();
                }}
              >
                <LogOut size={16} />
              </button>
            ) : (
              <button
                className="icon-button"
                title="Workspace settings"
                aria-label="Workspace settings"
                onClick={() => go('settings')}
              >
                <MoreHorizontal size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-layout">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open menu"
              onClick={() => setSidebar(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb-home">Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <span>{titles[page]}</span>
            {page === 'chat' && <span className="beta-label">BETA</span>}
          </div>
          <div className="topbar-actions">
            <span className={`workspace-status ${status?.aiConfigured ? 'ready' : ''}`}>
              <span className="status-dot" />
              {!status ? 'Connecting…' : status.aiConfigured ? 'Agent ready' : 'Ready when you are'}
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button search-top"
              onClick={() => {
                setQuery('');
                setModal('search');
              }}
              aria-label="Search workspace"
            >
              <Search size={18} />
              <kbd>⌘ K</kbd>
            </button>
            <button className="icon-button" aria-label="Help" onClick={() => setModal('help')}>
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        {(status?.databaseConfigured || storage.syncState === 'error') && (
          <div
            className={`sync-banner ${storage.syncState === 'error' ? 'has-error' : ''}`}
            role="status"
          >
            <span>
              {storage.syncState === 'saving'
                ? `Saving to ${databaseLabel(status)}…`
                : storage.syncState === 'error'
                  ? status?.databaseConfigured
                    ? `Not saved to ${databaseLabel(status)}`
                    : 'Browser history could not be saved'
                  : status?.databaseConfigured && status.databaseReady === false
                    ? `${databaseLabel(status)} needs setup`
                    : `Saved to ${databaseLabel(status)}`}
            </span>
            {storage.syncError && (
              <>
                <span>{storage.syncError}</span>
                {status?.databaseConfigured && status.databaseReady && storage.canRetry && (
                  <button className="text-button" onClick={storage.retry}>
                    Retry save
                  </button>
                )}
                <button className="text-button" onClick={storage.downloadBackup}>
                  Download browser draft
                </button>
              </>
            )}
            {status?.databaseConfigured && status.databaseReady === false && (
              <>
                <span>
                  {status.databaseError ||
                    'Neon is connected, but Relay tables need initialization.'}
                </span>
                <button className="text-button" onClick={openDatabaseSettings}>
                  Open Settings → Database
                </button>
              </>
            )}
          </div>
        )}
        <main
          className={`main-content ${page === 'chat' && messages.length ? 'conversation-page' : ''} ${page === 'chat' ? 'legacy-chat' : ''}`}
        >
          {page === 'chat' &&
            (messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-heading">
                  <div className="hello-badge">
                    <span className="status-dot" />
                    YOUR EVERYDAY, A LITTLE EASIER
                  </div>
                  <div className="hero-mark">
                    <Mark />
                    <span className="mark-spark spark-one" />
                    <span className="mark-spark spark-two" />
                  </div>
                  <h1>
                    Big ideas.
                    <br className="mobile-break" /> Less busywork
                    <span className="heading-dot">.</span>
                  </h1>
                  <p>
                    An extra pair of hands for everything on your list.
                    <br />
                    Just ask. Your personal AI agent will take it from here.
                  </p>
                </div>
                {composer}
                <div className="quick-prompts">
                  <button
                    onClick={() => {
                      setText(
                        'Help me write an email. Ask me who it’s for and what I’d like to say.',
                      );
                      inputRef.current?.focus();
                    }}
                  >
                    <Mail size={14} />
                    Write an email
                  </button>
                  <button onClick={() => fileRef.current?.click()}>
                    <FileText size={14} />
                    Work with a PDF
                  </button>
                  <button
                    onClick={() => {
                      setText(
                        'Help me organize my data in Google Sheets. Ask me for the data, spreadsheet URL and columns.',
                      );
                      inputRef.current?.focus();
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    Update a spreadsheet
                  </button>
                  <button
                    onClick={() => {
                      setText(
                        'Help me brainstorm ideas for a project. Ask me what I’m working on.',
                      );
                      inputRef.current?.focus();
                    }}
                  >
                    <Sparkles size={14} />
                    Explore an idea
                  </button>
                </div>
                <section className="starter-section">
                  <div className="section-heading">
                    <div>
                      <span className="small-section-label">A LITTLE INSPIRATION</span>
                      <h2>Start with something simple</h2>
                    </div>
                    <button className="text-button" onClick={() => go('workflows')}>
                      Explore workflows
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="workflow-grid">
                    {initialWorkflows.map((workflow) => (
                      <WorkflowCard
                        key={workflow.id}
                        workflow={workflow}
                        onRun={() => {
                          setText(workflow.prompt);
                          inputRef.current?.focus();
                        }}
                      />
                    ))}
                  </div>
                </section>
                <div className="connection-banner">
                  <div className="connection-stack">
                    <AppIcon type="email" />
                    <AppIcon type="sheet" />
                  </div>
                  <div>
                    <h3>Good on its own. Better with your tools.</h3>
                    <p>
                      {status?.googleEmail
                        ? 'Gmail and Google Sheets are connected and ready to help.'
                        : 'Connect your apps and let your agent connect the dots.'}
                    </p>
                  </div>
                  <button className="button small" onClick={() => go('connections')}>
                    {status?.googleEmail ? 'Manage connections' : 'Connect your apps'}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="welcome-footer">
                  <span>
                    <Monitor size={13} />
                    Runs locally
                  </span>
                  <span className="footer-dot" />
                  <span>
                    <Globe2 size={13} />
                    Lives in the cloud
                  </span>
                  <span className="footer-dot" />
                  <span>
                    <LockKeyhole size={12} />
                    Always your workspace
                  </span>
                </div>
              </div>
            ) : (
              <div className="chat-layout">
                <div className="conversation-heading">
                  <div>
                    <span className="small-section-label">YOUR CONVERSATION</span>
                    <h2>{active?.title}</h2>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Start a new conversation"
                    onClick={() => newChat()}
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="messages" aria-live="polite">
                  {messages.map((message) => (
                    <div key={message.id} className={`message ${message.role}`}>
                      <div className="message-avatar">
                        {message.role === 'assistant' ? <Mark small /> : <span>Y</span>}
                      </div>
                      <div className="message-main">
                        <div className="message-author">
                          {message.role === 'assistant' ? 'Relay' : 'You'}
                          {message.role === 'assistant' && <span>YOUR AGENT</span>}
                        </div>
                        {message.steps?.length ? <Steps items={message.steps} /> : null}
                        {message.attachment && (
                          <div className="message-document">
                            <FileText size={19} />
                            <span>
                              {message.attachment.name}
                              <small>Document attached</small>
                            </span>
                          </div>
                        )}
                        <div className={`message-content ${message.error ? 'message-error' : ''}`}>
                          {message.content}
                        </div>
                        {message.media?.type === 'image' && (
                          <div className="message-image-results" aria-label="Generated images">
                            {message.media.urls
                              .filter((url) => url.startsWith('https://'))
                              .map((url) => (
                                <a key={url} href={url} target="_blank" rel="noreferrer">
                                  <img src={url} alt="AI-generated result" loading="lazy" />
                                </a>
                              ))}
                          </div>
                        )}
                        {!!message.sources?.length && (
                          <div className="message-sources">
                            <strong>Sources</strong>
                            {message.sources.map((source, index) =>
                              source.url.startsWith('https://') ? (
                                <a
                                  key={source.url}
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <span>
                                    {index + 1}. {source.title}
                                  </span>
                                  <small>{new URL(source.url).hostname}</small>
                                </a>
                              ) : null,
                            )}
                          </div>
                        )}
                        {message.modelUsed && (
                          <button className="message-model-used" onClick={openModelPicker}>
                            <Cpu size={12} />
                            Used {message.modelUsed.modelId} · {message.modelUsed.providerName}
                          </button>
                        )}
                        {message.error && !status?.aiConfigured && (
                          <button className="text-button" onClick={() => go('models')}>
                            Connect your AI model
                            <ArrowRight size={14} />
                          </button>
                        )}
                        {message.proposals?.map((proposal) => (
                          <ApprovalCard
                            key={proposal.id}
                            proposal={proposal}
                            working={approving === proposal.id}
                            disabled={!!approving}
                            onApprove={() => approve(message.id, proposal)}
                            onCancel={() => cancel(message.id, proposal.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {busy && (
                    <div className="message assistant">
                      <div className="message-avatar">
                        <Mark small />
                      </div>
                      <div className="message-main">
                        <div className="message-author">Relay</div>
                        <div className="thinking">
                          <span />
                          <span />
                          <span />
                          <small>
                            {mediaMode === 'image'
                              ? 'Generating your image…'
                              : webSearch
                                ? 'Searching the web and preparing an answer…'
                                : 'Working on it…'}
                          </small>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
                {composer}
              </div>
            ))}
          {page === 'workflows' && (
            <div className="page-content">
              <div className="page-heading with-action">
                <div>
                  <div className="eyebrow">LESS REPETITION. MORE MOMENTUM.</div>
                  <h1>Your everyday, on repeat</h1>
                  <p>Turn your go-to tasks into a single starting point.</p>
                </div>
                <button className="button primary" onClick={() => setModal('workflow')}>
                  <Plus size={16} />
                  New workflow
                </button>
              </div>
              <div className="info-callout workflow-info">
                <WorkflowIcon size={20} />
                <div>
                  <strong>A shortcut to getting things done</strong>
                  <p>
                    Choose a workflow to start a conversation with a ready-made prompt. You trigger
                    each run and approve any changes. No background scheduling.
                  </p>
                </div>
              </div>
              <div className="section-heading">
                <h2>
                  My workflows <span className="count-label">{workflows.length}</span>
                </h2>
                <span className="muted-text">Made for the way you work</span>
              </div>
              <div className="workflow-page-grid">
                {workflows.map((workflow) => (
                  <div className="saved-workflow" key={workflow.id}>
                    <div className="card-top">
                      <AppIcon type={workflow.icon} />
                      <span className="small-badge">{workflow.custom ? 'Custom' : 'Starter'}</span>
                    </div>
                    <h3>{workflow.title}</h3>
                    <p>{workflow.description}</p>
                    <div className="workflow-prompt">{workflow.prompt}</div>
                    <div className="workflow-bottom">
                      <button className="text-button" onClick={() => newChat(workflow.prompt)}>
                        <Play size={13} />
                        Start workflow
                        <ArrowRight size={14} />
                      </button>
                      {workflow.custom && (
                        <button
                          className="icon-button"
                          aria-label={`Delete ${workflow.title}`}
                          onClick={() => {
                            setWorkflows((all) => all.filter((w) => w.id !== workflow.id));
                            notify('Workflow removed.');
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button className="create-workflow" onClick={() => setModal('workflow')}>
                  <span>
                    <Plus size={23} />
                  </span>
                  <h3>Make it your own</h3>
                  <p>Your next useful shortcut starts here.</p>
                </button>
              </div>
              <div className="subtle-note">
                <ShieldCheck size={15} />
                Your agent always asks before sending emails or changing your spreadsheet.
              </div>
            </div>
          )}
          {page === 'connections' && (
            <div className="page-content">
              <div className="page-heading">
                <div className="eyebrow">YOUR TOOLS. WORKING TOGETHER.</div>
                <h1>A more connected workspace</h1>
                <p>Give your agent the right tools, and a little more possibility.</p>
              </div>
              <div className="connections-summary">
                <span>
                  <span
                    className={`status-dot ${status?.googleEmail || status?.githubAccount || status?.vercelConnected ? '' : 'muted'}`}
                  />
                  {[
                    status?.googleEmail && 'Google',
                    status?.githubAccount && 'GitHub',
                    status?.vercelConnected && 'Vercel',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No apps connected yet'}
                </span>
                <span>
                  <ShieldCheck size={15} />
                  You choose what your agent can do
                </span>
              </div>
              <div className="integration-grid">
                {[
                  {
                    icon: 'email',
                    name: 'Gmail',
                    label: 'A little peace for your inbox.',
                    description:
                      'Find messages, summarize conversations, and draft emails that sound like you.',
                    abilities: ['Search and read messages', 'Compose emails for your approval'],
                  },
                  {
                    icon: 'sheet',
                    name: 'Google Sheets',
                    label: 'Give your data a place to land.',
                    description:
                      'Turn document details and chat instructions into neatly organized spreadsheet rows.',
                    abilities: [
                      'Extract details from your documents',
                      'Append rows after your approval',
                    ],
                  },
                ].map((item) => (
                  <section className="integration-card" key={item.name}>
                    <div className="card-top">
                      <AppIcon type={item.icon as 'email' | 'sheet'} large />
                      <span className={`small-badge ${status?.googleEmail ? 'green' : ''}`}>
                        {status?.googleEmail ? (
                          <>
                            <Check size={12} />
                            Connected
                          </>
                        ) : (
                          'Not connected'
                        )}
                      </span>
                    </div>
                    <h2>{item.name}</h2>
                    <h3>{item.label}</h3>
                    <p>{item.description}</p>
                    <ul>
                      {item.abilities.map((ability) => (
                        <li key={ability}>
                          <CheckCircle2 size={14} />
                          {ability}
                        </li>
                      ))}
                    </ul>
                    {status?.googleEmail ? (
                      <div className="connected-account">
                        <span className="status-dot" />
                        {status.googleEmail}
                      </div>
                    ) : (
                      <button className="button" onClick={connect}>
                        Sign in with Google
                        <ArrowUpRight size={15} />
                      </button>
                    )}
                  </section>
                ))}
                <GitHubConnectionCard status={status} refresh={refresh} notify={notify} />
                <VercelConnectionCard status={status} refresh={refresh} notify={notify} />
              </div>
              {status?.googleEmail ? (
                <div className="info-callout">
                  <ShieldCheck size={19} />
                  <div>
                    <strong>One Google account, two helpful connections</strong>
                    <p>
                      Your OAuth tokens are encrypted{' '}
                      {status?.databaseConfigured
                        ? `in ${databaseLabel(status)}`
                        : 'in a secure HTTP-only cookie'}
                      . Disconnecting removes both app connections from this workspace. You can
                      revoke access entirely in your Google account.
                    </p>
                    <button
                      className="text-button danger-text"
                      onClick={async () => {
                        try {
                          await api('/api/google/disconnect');
                          await refresh();
                          notify('Google disconnected from this workspace.');
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      Disconnect Google
                      <Unplug size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="info-callout">
                  <LockKeyhole size={19} />
                  <div>
                    <strong>Private by design. Connected by choice.</strong>
                    <p>
                      {status?.googleConfigured
                        ? 'One Google sign-in authorizes Gmail and Sheets together. You choose the account in Google’s permission screen; writes still wait for your approval.'
                        : 'Google sign-in needs one-time deployment-owner setup. In Vercel → relay → Settings → Environment Variables, configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL, and a stable SESSION_SECRET; enable Gmail and Google Sheets APIs in Google Cloud, add the authorized redirect URI shown below, then redeploy. Never paste client secrets into chat.'}
                    </p>
                    {!status?.googleConfigured && <GoogleOAuthSetupHint />}
                  </div>
                </div>
              )}
              <div className="more-integrations">
                <span className="empty-icon">
                  <Plus size={22} />
                </span>
                <div>
                  <h3>Room for whatever comes next</h3>
                  <p>
                    Relay is built to grow. New integrations can be added through the server’s tool
                    registry.
                  </p>
                </div>
                <span className="small-badge">Extensible by design</span>
              </div>
            </div>
          )}
          {page === 'activity' && (
            <div className="page-content">
              <div className="page-heading with-action">
                <div>
                  <div className="eyebrow">NOTHING BEHIND THE SCENES</div>
                  <h1>A little transparency goes a long way</h1>
                  <p>Documents processed, actions taken, and everything in between.</p>
                </div>
                <button className="button" onClick={() => setModal('clear')}>
                  <Trash2 size={15} />
                  {status?.databaseConfigured ? 'Clear workspace data' : 'Clear local data'}
                </button>
              </div>
              <div className="stats-grid">
                <Stat
                  label="Emails sent"
                  value={activities.filter((a) => a.type === 'email').length}
                  icon={<Mail size={19} />}
                />
                <Stat
                  label="Sheets updated"
                  value={activities.filter((a) => a.type === 'sheet').length}
                  icon={<FileSpreadsheet size={19} />}
                />
                <Stat
                  label="Documents read"
                  value={activities.filter((a) => a.type === 'file').length}
                  icon={<FileText size={19} />}
                />
              </div>
              <div className="activity-toolbar">
                <h2>Activity log</h2>
                <select
                  aria-label="Filter activity"
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                >
                  <option value="all">All activity</option>
                  <option value="email">Emails</option>
                  <option value="sheet">Spreadsheets</option>
                  <option value="file">Documents</option>
                  <option value="error">Needs attention</option>
                </select>
              </div>
              {activities.filter((a) => activityFilter === 'all' || a.type === activityFilter)
                .length ? (
                <div className="activity-list">
                  {activities
                    .filter((a) => activityFilter === 'all' || a.type === activityFilter)
                    .map((item) => (
                      <div className="activity-row" key={item.id}>
                        <span className={`activity-type ${item.type}`}>
                          {item.type === 'email' ? (
                            <Mail size={19} />
                          ) : item.type === 'sheet' ? (
                            <FileSpreadsheet size={19} />
                          ) : item.type === 'error' ? (
                            <CircleHelp size={19} />
                          ) : (
                            <FileText size={19} />
                          )}
                        </span>
                        <div>
                          <h3>{item.title}</h3>
                          <p>{item.description}</p>
                        </div>
                        <time>
                          {friendlyDate(item.at)}
                          <small>
                            {new Date(item.at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </small>
                        </time>
                        <span className={`small-badge ${item.type === 'error' ? '' : 'green'}`}>
                          {item.type === 'error' ? 'Check' : 'Complete'}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <EmptyState
                  icon={<History size={27} />}
                  title={
                    activities.length ? 'Nothing in this category yet' : 'A clean slate, for now'
                  }
                  description="When your agent processes a document or completes an approved action, you’ll see it here."
                >
                  <button className="button" onClick={() => newChat()}>
                    Start a conversation
                    <ArrowRight size={14} />
                  </button>
                </EmptyState>
              )}
              <div className="subtle-note">
                <Monitor size={15} />
                {status?.databaseConfigured
                  ? `Activity is saved to ${databaseLabel(status)} with your workspace.`
                  : 'Activity is stored only in this browser.'}{' '}
                Up to 200 recent events are kept.
              </div>
            </div>
          )}
          {page === 'analytics' && <Analytics onOpenStorage={openDatabaseSettings} />}
          {page === 'models' && <ModelHub onSelect={refresh} notify={notify} />}
          {page === 'settings' && status && (
            <Settings
              key={`${status.provider}-${status.model}`}
              status={status}
              theme={theme}
              onThemeChange={setTheme}
              appearance={appearance}
              onAppearanceChange={setAppearance}
              refresh={refresh}
              notify={notify}
              initialTab={settingsTab}
            />
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>
            <CircleHelp size={17} />
          </span>
          <p>{toast}</p>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modelPickerOpen && (
        <Modal
          wide
          title="Choose an available model"
          subtitle="Choose one model to pin every reply to it, or leave Relay on Auto-pick to use the best eligible model."
          onClose={() => setModelPickerOpen(false)}
        >
          {modelPickerError && (
            <div className="model-hub-error" role="alert">
              {modelPickerError}
            </div>
          )}
          <button
            className={`chat-auto-model-option ${routerAutoPick ? 'selected' : ''}`}
            onClick={() => void chooseAutomaticModel()}
            disabled={modelPickerBusy || !modelChoices.length}
          >
            <Zap size={16} />
            <span>
              <strong>Automatically choose a model</strong>
              <small>
                Relay picks the best eligible model for each request and can try another if a
                provider rejects it.
              </small>
            </span>
            {routerAutoPick && <Check size={16} />}
          </button>
          {modelPickerBusy && !modelChoices.length ? (
            <div className="model-picker-loading">
              <LoaderCircle className="spin" size={18} /> Checking your API model access…
            </div>
          ) : modelChoices.length ? (
            <div className="chat-model-picker-list">
              {modelChoices.flatMap((model) =>
                model.providers.map((provider) => {
                  const isSelected =
                    routerSelection?.providerId === provider.id &&
                    routerSelection.modelId === provider.modelId;
                  const availability = provider.isFree
                    ? 'Free on this API'
                    : provider.availableTokens !== null
                      ? `${provider.availableTokens.toLocaleString()} tokens reported`
                      : 'Account credits available';
                  return (
                    <button
                      key={`${provider.id}::${provider.modelId}`}
                      className={`chat-model-option ${isSelected ? 'selected' : ''}`}
                      disabled={modelPickerBusy}
                      onClick={() => void chooseChatModel(model, provider)}
                    >
                      <span className="chat-model-option-copy">
                        <strong>{model.name}</strong>
                        <small>
                          {provider.modelId} · {provider.name}
                        </small>
                        <small className="chat-model-availability">{availability}</small>
                      </span>
                      {isSelected ? <Check size={16} /> : <ChevronRight size={16} />}
                    </button>
                  );
                }),
              )}
            </div>
          ) : (
            <div className="model-picker-empty">
              <CircleHelp size={20} />
              <strong>No eligible models are listed</strong>
              <span>
                Refresh your provider keys or check the provider’s quota and model access. Quota can
                change after this catalog check.
              </span>
            </div>
          )}
          <div className="model-picker-footer">
            <span>
              Model availability is a provider-reported snapshot. The provider can still return a
              quota error.
            </span>
            <button
              className="button small"
              onClick={() => void openModelPicker()}
              disabled={modelPickerBusy}
            >
              <RefreshCw size={14} /> Refresh list
            </button>
          </div>
        </Modal>
      )}
      {modal === 'search' && (
        <Modal
          title="Find your next step"
          subtitle="Search conversations and workflows."
          onClose={closeModal}
        >
          <div className="search-input">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Search your workspace…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>ESC</kbd>
          </div>
          <div className="search-results">
            <div className="small-section-label">CONVERSATIONS</div>
            {conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
              .length ? (
              conversations
                .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 8)
                .map((c) => (
                  <button key={c.id} onClick={() => openConversation(c.id)}>
                    <MessageSquare size={17} />
                    <span>{c.title}</span>
                    <ChevronRight size={15} />
                  </button>
                ))
            ) : (
              <p>No matching conversations.</p>
            )}
            <div className="small-section-label">WORKFLOWS</div>
            {workflows
              .filter((w) => (w.title + w.description).toLowerCase().includes(query.toLowerCase()))
              .map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    closeModal();
                    newChat(w.prompt);
                  }}
                >
                  <WorkflowIcon size={17} />
                  <span>{w.title}</span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {modal === 'workflow' && (
        <WorkflowModal
          onClose={closeModal}
          onSave={(workflow) => {
            setWorkflows((all) => [...all, { ...workflow, id: uid(), custom: true }]);
            closeModal();
            notify('Your new workflow is ready.');
          }}
        />
      )}
      {modal === 'help' && (
        <Modal
          title="Meet your extra pair of hands"
          subtitle="A quick guide to making Relay your own."
          onClose={closeModal}
        >
          <div className="help-steps">
            <div>
              <span>1</span>
              <section>
                <h3>Give your agent a brain</h3>
                <p>
                  Connect an AI API in Settings, or run a local model with Ollama. Your data goes
                  only to the provider you choose.
                </p>
              </section>
            </div>
            <div>
              <span>2</span>
              <section>
                <h3>Bring your tools along</h3>
                <p>
                  Connect Google to work with Gmail and Sheets. Upload text-based PDFs, CSVs and
                  notes right in your chat.
                </p>
              </section>
            </div>
            <div>
              <span>3</span>
              <section>
                <h3>Ask, review, and get it done</h3>
                <p>
                  Describe a task in your own words. Relay prepares it, you approve it. Save
                  repetitive instructions as a workflow.
                </p>
              </section>
            </div>
          </div>
          <div className="modal-footer">
            <span>
              <ShieldCheck size={14} />
              No actions without your say-so.
            </span>
            <button
              className="button primary"
              onClick={() => {
                closeModal();
                go('settings');
              }}
            >
              Open settings
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {modal === 'clear' && (
        <Modal
          title="A fresh start?"
          subtitle={
            status?.databaseConfigured
              ? `This clears chats, document text, activity and custom workflows from the shared ${databaseLabel(status)} workspace and this browser. Other devices will see the cleared history after reloading. API connections stay saved.`
              : 'This permanently clears this browser’s chats, document text, activity and custom workflows. Your AI and Google connections will stay connected.'
          }
          onClose={closeModal}
        >
          <div className="modal-footer">
            <button className="button" onClick={closeModal}>
              Keep my data
            </button>
            <button
              className="button danger"
              disabled={busy || uploading || !!approving}
              onClick={() => {
                setConversations([]);
                setActivities([]);
                setWorkflows(initialWorkflows);
                setCurrentId(null);
                setAttachment(null);
                setText('');
                closeModal();
                notify(
                  status?.databaseConfigured
                    ? `Workspace cleared locally. Wait for the ${databaseLabel(status)} save confirmation above.`
                    : 'Your local workspace data has been cleared.',
                );
              }}
            >
              {status?.databaseConfigured ? 'Clear workspace data' : 'Clear local data'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ApprovalCard({
  proposal,
  working,
  disabled,
  onApprove,
  onCancel,
}: {
  proposal: Proposal;
  working: boolean;
  disabled: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const email = proposal.name === 'send_email';
  const github = proposal.name === 'github_push_files';
  return (
    <div className={`approval-card ${proposal.state || ''}`}>
      <div className="approval-heading">
        <span>
          {github ? (
            <Github size={17} />
          ) : email ? (
            <Mail size={17} />
          ) : (
            <FileSpreadsheet size={17} />
          )}{' '}
          {github
            ? 'Review generated repository files'
            : email
              ? 'An email, ready for your review'
              : 'Your spreadsheet update'}
        </span>
        <span className={`small-badge ${proposal.state === 'done' ? 'green' : ''}`}>
          {proposal.state === 'done'
            ? 'Completed'
            : proposal.state === 'cancelled'
              ? 'Cancelled'
              : proposal.state === 'failed'
                ? 'Needs attention'
                : 'Approval needed'}
        </span>
      </div>
      {email ? (
        <div className="email-preview">
          <div>
            <span>TO</span>
            {proposal.args.to}
          </div>
          <div>
            <span>SUBJECT</span>
            {proposal.args.subject}
          </div>
          <p>{proposal.args.body}</p>
        </div>
      ) : github && proposal.name === 'github_push_files' ? (
        <div className="github-proposal-preview">
          <p>
            <strong>Repository</strong>
            <a href={proposal.repository?.htmlUrl} target="_blank" rel="noreferrer">
              {proposal.repository?.fullName || 'Selected repository'}
              <ExternalLink size={12} />
            </a>
          </p>
          <p>
            <strong>Target</strong>
            New <code>relay/…</code> branch · based on{' '}
            <code>{proposal.repository?.defaultBranch || 'default branch'}</code>
          </p>
          <p>
            <strong>Commit</strong>
            {proposal.args.commitMessage}
          </p>
          <strong className="github-file-count">
            {proposal.args.files.length} file(s) to add or update
          </strong>
          <div className="github-file-list">
            {proposal.args.files.map((file) => (
              <details key={file.path}>
                <summary>
                  <code>{file.path}</code>
                  <span>{file.content.length.toLocaleString()} chars</span>
                </summary>
                <pre>{file.content}</pre>
              </details>
            ))}
          </div>
          <small>
            The default branch will not be changed. Review the files, then approve to push this new
            branch.
          </small>
        </div>
      ) : (
        <div className="sheet-preview">
          <p>
            <strong>Spreadsheet</strong>
            <a
              href={`https://docs.google.com/spreadsheets/d/${proposal.args.spreadsheetId}/edit`}
              target="_blank"
              rel="noreferrer"
            >
              Open destination
              <ExternalLink size={12} />
            </a>
          </p>
          <p>
            <strong>Range</strong>
            {proposal.args.range}
          </p>
          <div className="sheet-table-wrap">
            <table>
              <tbody>
                {proposal.args.values.map((row, i) => (
                  <tr key={i}>
                    <th>{i + 1}</th>
                    {row.map((cell, j) => (
                      <td key={j}>{String(cell ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small>
            {proposal.args.values.length} row(s) will be appended. Existing rows will not be
            overwritten.
          </small>
        </div>
      )}
      {proposal.result && (
        <div className={proposal.state === 'failed' ? 'error-box' : 'action-result'}>
          {proposal.state === 'done' && <CheckCircle2 size={16} />} {proposal.result}
          {proposal.resultUrl && (
            <a href={proposal.resultUrl} target="_blank" rel="noreferrer">
              View GitHub branch <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}
      {!proposal.state && (
        <div className="approval-actions">
          <span>
            <ShieldCheck size={13} />
            {proposal.token
              ? 'Nothing has changed yet'
              : 'Approval expired — ask Relay to prepare it again.'}
          </span>
          <div>
            <button className="button small" disabled={disabled} onClick={onCancel}>
              Cancel
            </button>
            <button
              className="button primary small"
              disabled={disabled || !proposal.token}
              onClick={onApprove}
            >
              {working ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}{' '}
              {github ? 'Approve & push branch' : email ? 'Approve & send' : 'Approve & add rows'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
type GitHubRepositoryOption = {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
};
function GitHubConnectionCard({
  status,
  refresh,
  notify,
}: {
  status: Status | null;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [repositories, setRepositories] = useState<GitHubRepositoryOption[]>([]);
  const [selection, setSelection] = useState<GitHubRepositoryOption | null>(null);
  const [account, setAccount] = useState<string | null>(status?.githubAccount || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{
        connected: boolean;
        account: string | null;
        repositories: GitHubRepositoryOption[];
        selection: GitHubRepositoryOption | null;
      }>('/api/github/repositories', undefined, 'GET');
      setAccount(data.account);
      setRepositories(data.repositories);
      setSelection(data.selection);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, status?.githubAccount]);
  async function connectGitHub() {
    setBusy(true);
    setError('');
    try {
      const { url } = await api<{ url: string }>('/api/github/connect');
      window.location.assign(url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function selectRepository(event: React.ChangeEvent<HTMLSelectElement>) {
    const repositoryId = Number(event.target.value);
    if (!repositoryId) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ selection: GitHubRepositoryOption }>('/api/github/repositories', {
        repositoryId,
      });
      setSelection(result.selection);
      notify(`Connected ${result.selection.fullName} to chat code proposals.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function disconnectGitHub() {
    if (
      !window.confirm(
        'Disconnect Relay and uninstall its GitHub App installation for this account?',
      )
    )
      return;
    setBusy(true);
    try {
      await api('/api/github/disconnect', {});
      setAccount(null);
      setRepositories([]);
      setSelection(null);
      await refresh();
      notify('GitHub disconnected from Relay.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="integration-card github-integration-card">
      <div className="card-top">
        <Github size={28} aria-hidden="true" />
        <span className={`small-badge ${account ? 'green' : ''}`}>
          {account ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <h2>GitHub</h2>
      <h3>Turn a chat into a reviewed code change.</h3>
      <p>
        Select a repository once. In any chat, ask Relay to create or update a site or app; it will
        prepare a structured file set and wait for your approval before pushing a new branch.
      </p>
      {account ? (
        <>
          <div className="connected-account">
            <span className="status-dot" />
            Connected as {account}
          </div>
          <label className="github-repository-select">
            <span>Repository Relay can use</span>
            <select
              value={selection?.id || ''}
              onChange={(event) => void selectRepository(event)}
              disabled={loading || busy || !repositories.length}
            >
              <option value="">{loading ? 'Loading repositories…' : 'Choose a repository'}</option>
              {repositories.map((repository) => (
                <option key={repository.id} value={repository.id}>
                  {repository.fullName}
                  {repository.private ? ' · Private' : ''}
                </option>
              ))}
            </select>
          </label>
          {selection && (
            <div className="github-branch-note">
              New code is proposed on a separate <code>relay/…</code> branch from{' '}
              <code>{selection.defaultBranch}</code>; the default branch is never changed directly.
              If this repository is already linked to a Vercel project, Vercel may build a Preview
              Deployment. Preview builds can execute repository scripts, so keep production secrets
              out of preview environments.
            </div>
          )}
          <button
            className="text-button danger-text"
            onClick={() => void disconnectGitHub()}
            disabled={busy}
          >
            <Unplug size={13} /> Disconnect GitHub
          </button>
        </>
      ) : (
        <>
          <ul>
            <li>
              <CheckCircle2 size={14} /> Choose only repositories granted to the GitHub App
            </li>
            <li>
              <CheckCircle2 size={14} /> Review every generated file before it is pushed
            </li>
          </ul>
          <button className="button" onClick={() => void connectGitHub()} disabled={busy}>
            {busy ? <LoaderCircle size={15} className="spin" /> : <Github size={15} />}
            Install & connect GitHub
            <ArrowUpRight size={15} />
          </button>
        </>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {!status?.githubConfigured && (
        <div className="github-setup-hint">
          GitHub needs a one-time GitHub App setup. The deployment owner configures{' '}
          <code>GITHUB_APP_ID</code>, <code>GITHUB_APP_SLUG</code>,{' '}
          <code>GITHUB_APP_PRIVATE_KEY</code>, <code>APP_URL</code>, and a stable{' '}
          <code>SESSION_SECRET</code> on the server, then installs the app with{' '}
          <code>Contents: read/write</code> and <code>Metadata: read</code>. Users then connect
          here; no personal access token is needed.
        </div>
      )}
    </section>
  );
}
function GoogleOAuthSetupHint() {
  const [redirectURI, setRedirectURI] = useState('');
  useEffect(() => {
    api<{ redirectURI: string }>('/api/google/config', undefined, 'GET')
      .then((result) => setRedirectURI(result.redirectURI))
      .catch(() => {});
  }, []);
  return redirectURI ? (
    <code className="oauth-redirect-uri">Authorized redirect URI: {redirectURI}</code>
  ) : null;
}
type VercelProjectOption = { id: string; name: string; framework: string | null };
type VercelDeploymentItem = {
  id: string;
  name: string;
  url: string;
  state: string;
  target: string | null;
  createdAt: number;
};
function VercelConnectionCard({
  status,
  refresh,
  notify,
}: {
  status: Status | null;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [connected, setConnected] = useState(!!status?.vercelConnected);
  const [account, setAccount] = useState(status?.vercelAccount || '');
  const [projects, setProjects] = useState<VercelProjectOption[]>([]);
  const [selection, setSelection] = useState<VercelProjectOption | null>(null);
  const [deployments, setDeployments] = useState<VercelDeploymentItem[]>([]);
  const [token, setToken] = useState('');
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api<{
        connected: boolean;
        account?: { username: string; name: string };
        projects: VercelProjectOption[];
        selection: VercelProjectOption | null;
        deployments: VercelDeploymentItem[];
      }>('/api/vercel', undefined, 'GET');
      setConnected(result.connected);
      setAccount(result.account?.username || '');
      setProjects(result.projects);
      setSelection(result.selection);
      setDeployments(result.deployments);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectVercel() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{
        connected: boolean;
        account: { username: string };
        projects: VercelProjectOption[];
      }>('/api/vercel', { action: 'connect', token, teamId });
      setConnected(result.connected);
      setAccount(result.account.username);
      setProjects(result.projects);
      setSelection(null);
      setDeployments([]);
      setToken('');
      await refresh();
      notify(
        `Vercel connected as ${result.account.username}. Choose a project to view deployments.`,
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function chooseProject(event: React.ChangeEvent<HTMLSelectElement>) {
    const projectId = event.target.value;
    if (!projectId) {
      setSelection(null);
      setDeployments([]);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api<{
        selection: VercelProjectOption;
        deployments: VercelDeploymentItem[];
      }>('/api/vercel', { action: 'select-project', projectId });
      setSelection(result.selection);
      setDeployments(result.deployments);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        'Remove the encrypted Vercel token and project selection from this Relay workspace?',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api('/api/vercel', { action: 'disconnect' });
      setConnected(false);
      setAccount('');
      setProjects([]);
      setSelection(null);
      setDeployments([]);
      await refresh();
      notify('Vercel disconnected from Relay.');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="integration-card vercel-integration-card">
      <div className="card-top">
        <span className="vercel-mark" aria-hidden="true">
          ▲
        </span>
        <span className={`small-badge ${connected ? 'green' : ''}`}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <h2>Vercel</h2>
      <h3>Keep an eye on your live projects.</h3>
      <p>
        Connect a Vercel account to choose a project and check its latest preview and production
        deployments.
      </p>
      {connected ? (
        <>
          <div className="connected-account">
            <span className="status-dot" />
            Connected as {account}
          </div>
          <label className="github-repository-select">
            <span>Project to monitor</span>
            <select
              value={selection?.id || ''}
              onChange={(event) => void chooseProject(event)}
              disabled={busy || loading}
            >
              <option value="">{loading ? 'Loading projects…' : 'Choose a project'}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.framework ? ` · ${project.framework}` : ''}
                </option>
              ))}
            </select>
          </label>
          {selection && (
            <div className="vercel-deployments">
              <div className="vercel-deployments-heading">
                <strong>Recent deployments · {selection.name}</strong>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>
              {loading ? (
                <p className="settings-help">Loading deployment status…</p>
              ) : deployments.length ? (
                deployments.map((deployment) => (
                  <div className="vercel-deployment-row" key={deployment.id}>
                    <span className={`vercel-state ${deployment.state.toLowerCase()}`}>
                      {deployment.state.replaceAll('_', ' ')}
                    </span>
                    <span className="vercel-deployment-meta">
                      {deployment.target || 'Preview'} ·{' '}
                      {deployment.createdAt
                        ? new Date(deployment.createdAt).toLocaleDateString()
                        : 'Date unavailable'}
                    </span>
                    {deployment.url && (
                      <a
                        href={`https://${deployment.url}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open deployment ${deployment.url}`}
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <p className="settings-help">No deployments found for this project yet.</p>
              )}
            </div>
          )}
          <button
            className="text-button danger-text"
            type="button"
            onClick={() => void disconnect()}
            disabled={busy}
          >
            <Unplug size={13} /> Disconnect Vercel
          </button>
        </>
      ) : (
        <form
          className="vercel-connect-form"
          onSubmit={(event) => {
            event.preventDefault();
            void connectVercel();
          }}
        >
          <label>
            Vercel access token
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste a scoped Vercel token"
              required
            />
          </label>
          <label>
            Team ID <span className="optional">(optional; for a team account)</span>
            <input
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              placeholder="team_…"
              autoComplete="off"
            />
          </label>
          <div className="vercel-token-help">
            Create a token in{' '}
            <a href="https://vercel.com/account/settings/tokens" target="_blank" rel="noreferrer">
              Vercel account settings <ExternalLink size={12} />
            </a>
            . Use the narrowest access that can read the projects you want to monitor.
          </div>
          <button className="button primary" type="submit" disabled={busy || !token.trim()}>
            {busy ? <LoaderCircle size={15} className="spin" /> : <Triangle size={15} />}Connect
            Vercel
          </button>
        </form>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {connected && !projects.length && !loading && (
        <p className="settings-help">
          No projects are visible. Check the token’s account/team access or disconnect to use a
          different token.
        </p>
      )}
    </section>
  );
}
function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="stat-card">
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
      <small>In this workspace</small>
    </div>
  );
}
function WorkflowModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (workflow: Omit<Workflow, 'id'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [icon, setIcon] = useState<Workflow['icon']>('sparkles');
  return (
    <Modal
      title="Your next useful shortcut"
      subtitle="Save a set of instructions you’ll want to use again."
      onClose={onClose}
    >
      <form
        className="workflow-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && prompt.trim())
            onSave({
              title: title.trim(),
              description: description.trim() || 'A little less busywork, your way.',
              prompt: prompt.trim(),
              icon,
            });
        }}
      >
        <label>
          Name
          <input
            required
            maxLength={60}
            placeholder="e.g. My Friday wrap-up"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Description <span className="optional">(optional)</span>
          <input
            maxLength={140}
            placeholder="What does this workflow help you do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Instructions
          <textarea
            required
            rows={5}
            maxLength={6000}
            placeholder="Tell your agent what to do. Be specific about the information it should ask for and the result you want."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>
        <label>
          Category
          <select value={icon} onChange={(e) => setIcon(e.target.value as Workflow['icon'])}>
            <option value="sparkles">General assistant</option>
            <option value="email">Email</option>
            <option value="sheet">Documents & spreadsheets</option>
          </select>
        </label>
        <div className="subtle-note">
          <Play size={13} />
          Run manually. Every external change requires approval.
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={!title.trim() || !prompt.trim()}>
            <Plus size={15} />
            Create workflow
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Login({
  setupRequired,
  onLogin,
}: {
  setupRequired?: boolean;
  onLogin: () => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">
          <Mark />
          <span>relay.</span>
        </div>
        <h1>{setupRequired ? 'One more thing to feel at home.' : 'Your workspace is waiting.'}</h1>
        <p>
          {setupRequired
            ? `Run npm run setup, then restart Relay. Database-backed and hosted workspaces require APP_PASSWORD and a SESSION_SECRET of at least 32 characters. This keeps your agent and accounts private.`
            : 'Enter your workspace password to pick up where you left off.'}
        </p>
        {!setupRequired && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await api('/api/auth/login', { password });
                await onLogin();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Workspace password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your APP_PASSWORD"
              />
            </label>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}Enter
              workspace
            </button>
          </form>
        )}
        <div className="subtle-note">
          <LockKeyhole size={13} />A personal space for your everyday possibilities.
        </div>
      </div>
    </div>
  );
}
