import type { Status } from './client-types';
// Recommend Neon when not configured; don't mislabel an existing non-Neon database.
export function databaseLabel(status?: Pick<Status, 'databaseProvider'> | null) {
  return status?.databaseProvider === 'postgresql' ? 'PostgreSQL' : 'Neon Postgres';
}
