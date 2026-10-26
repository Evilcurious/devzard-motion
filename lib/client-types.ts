import type { WriteAction } from './tools';
export type Page =
  'chat' | 'workflows' | 'models' | 'connections' | 'activity' | 'analytics' | 'settings';
export type Status = {
  authenticated: boolean;
  setupRequired?: boolean;
  passwordProtected?: boolean;
  provider?: string;
  model?: string;
  aiConfigured?: boolean;
  googleConfigured?: boolean;
  googleEmail?: string | null;
  deployment?: string;
  secureSettings?: boolean;
  databaseConfigured?: boolean;
  databaseReady?: boolean;
  databaseError?: string;
  databaseProvider?: string | null;
  databasePooled?: boolean;
  databaseTLS?: boolean;
  connectionError?: string;
  baseURL?: string;
  keySaved?: boolean;
};
export type Attachment = { name: string; text: string; pages?: number; truncated?: boolean };
export type Proposal = WriteAction & {
  id: string;
  token: string;
  state?: 'done' | 'cancelled' | 'failed';
  result?: string;
};
export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachment?: Attachment;
  proposals?: Proposal[];
  steps?: string[];
  error?: boolean;
};
export type Conversation = { id: string; title: string; messages: Message[]; updated: string };
export type Activity = {
  id: string;
  title: string;
  description: string;
  type: 'email' | 'sheet' | 'file' | 'error';
  at: string;
};
export type Workflow = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: 'email' | 'sheet' | 'sparkles';
  custom?: boolean;
};
export const initialWorkflows: Workflow[] = [
  {
    id: 'inbox',
    title: 'An inbox, under control',
    description: 'Find unread messages and prepare thoughtful replies.',
    prompt:
      'Search my unread emails from the last 7 days. Summarize the important ones and help me draft replies. Ask me before sending anything.',
    icon: 'email',
  },
  {
    id: 'documents',
    title: 'From document to done',
    description: 'Turn the details in your PDFs into organized spreadsheet rows.',
    prompt:
      'Help me extract data from a PDF and add it to Google Sheets. Ask me for the document, spreadsheet URL, tab name and columns to use. Show me the rows before adding them.',
    icon: 'sheet',
  },
  {
    id: 'daily',
    title: 'A head start on your day',
    description: 'Bring clarity to your to-do list and make a plan that works.',
    prompt:
      'Help me plan my day. Ask me about my priorities, deadlines and available time, then suggest a realistic schedule.',
    icon: 'sparkles',
  },
];
