// Permission rules. The prototype checks these in the UI and inside every mutation.
// In production the same rules are enforced by Postgres row-level security (docs/schema.sql),
// so the browser is never the only gate.
import type { DB, Member } from './types';
import { ix, mentorAnalysts } from './derive';

export function viewer(db: DB, id: string): Member {
  const m = ix(db).member.get(id);
  if (!m) throw new Error('Unknown member');
  return m;
}

/** Can `viewerId` read the full recruiting workspace of `ownerId`? */
export function canViewWorkspace(db: DB, viewerId: string, ownerId: string): boolean {
  if (viewerId === ownerId) return true;
  const v = viewer(db, viewerId);
  if (v.role === 'exec') return true;
  if (v.role === 'mentor') return mentorAnalysts(db, viewerId).some(a => a.id === ownerId);
  return false;
}
/** Only the owner writes their recruiting records (contacts, applications, activities, tasks, targets). */
export function canEditRecords(viewerId: string, ownerId: string): boolean {
  return viewerId === ownerId;
}
/** Mentors manage goals for assigned analysts; exec for all analysts. */
export function canManageGoals(db: DB, viewerId: string, analystId: string): boolean {
  const v = viewer(db, viewerId);
  if (v.role === 'exec') return true;
  if (v.role === 'mentor') return mentorAnalysts(db, viewerId).some(a => a.id === analystId);
  return false;
}
export function isExec(db: DB, viewerId: string): boolean { return viewer(db, viewerId).role === 'exec'; }

export class PermissionError extends Error {}
export function assert(ok: boolean, msg = 'You do not have permission to do that.') {
  if (!ok) throw new PermissionError(msg);
}
