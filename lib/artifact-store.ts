'use client';

import { generatedArtifactReference, type GeneratedArtifact } from './generated-files';

const DB_NAME = 'relay-generated-artifacts';
const STORE_NAME = 'artifacts';
const DB_VERSION = 1;

type StoredArtifact = {
  key: string;
  accountId: string;
  artifact: GeneratedArtifact;
};

function openArtifactDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined')
    return Promise.reject(new Error('This browser does not support local project storage.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Could not open local project storage.'));
  });
}

function artifactKey(accountId: string, artifactId: string) {
  return `${accountId}:${artifactId}`;
}

export async function saveGeneratedArtifact(accountId: string, artifact: GeneratedArtifact) {
  const db = await openArtifactDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({
        key: artifactKey(accountId, artifact.id),
        accountId,
        artifact,
      } satisfies StoredArtifact);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error('Could not save the project locally.'));
      transaction.onabort = () =>
        reject(transaction.error || new Error('Project storage is full.'));
    });
  } finally {
    db.close();
  }
}

export async function loadGeneratedArtifact(
  accountId: string,
  artifactId: string,
): Promise<GeneratedArtifact | null> {
  const db = await openArtifactDB();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(artifactKey(accountId, artifactId));
      request.onsuccess = () =>
        resolve((request.result as StoredArtifact | undefined)?.artifact || null);
      request.onerror = () =>
        reject(request.error || new Error('Could not read the locally saved project.'));
    });
  } finally {
    db.close();
  }
}

export async function externalizeWorkspaceArtifacts<
  T extends {
    conversations: Array<{ messages: Array<{ artifacts?: unknown[] }> }>;
  },
>(data: T, accountId: string): Promise<T> {
  let changed = false;
  const conversations = await Promise.all(
    data.conversations.map(async (conversation) => ({
      ...conversation,
      messages: await Promise.all(
        conversation.messages.map(async (message) => {
          if (!Array.isArray(message.artifacts) || !message.artifacts.length) return message;
          const artifacts: unknown[] = [];
          let messageChanged = false;
          for (const candidate of message.artifacts) {
            if (
              candidate &&
              typeof candidate === 'object' &&
              'files' in candidate &&
              Array.isArray(candidate.files)
            ) {
              const artifact = candidate as GeneratedArtifact;
              await saveGeneratedArtifact(accountId, artifact);
              artifacts.push(generatedArtifactReference(artifact));
              changed = true;
              messageChanged = true;
            } else artifacts.push(candidate);
          }
          return messageChanged ? { ...message, artifacts } : message;
        }),
      ),
    })),
  );
  return changed ? ({ ...data, conversations } as T) : data;
}
