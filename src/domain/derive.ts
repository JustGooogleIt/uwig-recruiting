// Derived views. Nothing here is stored: contact stage, counts, follow-up dates, goal progress
// and analytics are all recomputed from confirmed records, so one activity updates every view.
// In production these become SQL views / RPCs that run under the caller's RLS policies.
import type { Activity, Application, Contact, DB, DateOnly, Firm, Goal, Member, RelStage, Task } from './types';
import { ACTIVE_APP_STAGES } from './types';
import { addDays, dateKey, diffDays, todayKey, weekStart } from './time';

export const OUTREACH_TYPES = new Set(['outreach', 'follow_up']);
export const RESPONSE_TYPES = new Set(['reply', 'chat_scheduled', 'chat_completed']);

interface Index {
  firm: Map<string, Firm>;
  member: Map<string, Member>;
  contact: Map<string, Contact>;
  app: Map<string, Application>;
  actsByContact: Map<string, Activity[]>;
  actsByApp: Map<string, Activity[]>;
  actsByOwner: Map<string, Activity[]>;
  contactsByOwner: Map<string, Contact[]>;
  appsByOwner: Map<string, Application[]>;
  tasksByOwner: Map<string, Task[]>;
  groupOfAnalyst: Map<string, string>;
}
const cache = new WeakMap<DB, Index>();
function push<K, V>(m: Map<K, V[]>, k: K | undefined, v: V) { if (k == null) return; const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); }

export function ix(db: DB): Index {
  let i = cache.get(db);
  if (i) return i;
  i = {
    firm: new Map(db.firms.map(f => [f.id, f])),
    member: new Map(db.members.map(m => [m.id, m])),
    contact: new Map(db.contacts.map(c => [c.id, c])),
    app: new Map(db.applications.map(a => [a.id, a])),
    actsByContact: new Map(), actsByApp: new Map(), actsByOwner: new Map(),
    contactsByOwner: new Map(), appsByOwner: new Map(), tasksByOwner: new Map(),
    groupOfAnalyst: new Map(db.assignments.map(a => [a.analystId, a.groupId])),
  };
  const acts = db.activities.slice().sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.createdAt.localeCompare(b.createdAt));
  for (const a of acts) { push(i.actsByContact, a.contactId, a); push(i.actsByApp, a.applicationId, a); push(i.actsByOwner, a.ownerId, a); }
  for (const c of db.contacts) push(i.contactsByOwner, c.ownerId, c);
  for (const a of db.applications) push(i.appsByOwner, a.ownerId, a);
  for (const t of db.tasks) push(i.tasksByOwner, t.ownerId, t);
  cache.set(db, i);
  return i;
}

/** Resolve merged firms to the surviving record. */
export function firmOf(db: DB, id?: string): Firm | undefined {
  let f = id ? ix(db).firm.get(id) : undefined;
  let guard = 0;
  while (f && f.status === 'merged' && f.mergedIntoId && guard++ < 5) f = ix(db).firm.get(f.mergedIntoId);
  return f;
}
export const firmName = (db: DB, id?: string) => firmOf(db, id)?.name ?? 'Unknown firm';
export const memberName = (db: DB, id?: string) => (id && ix(db).member.get(id)?.name) || 'Unknown member';

export const contactActs = (db: DB, contactId: string) => ix(db).actsByContact.get(contactId) ?? [];
export const appActs = (db: DB, appId: string) => ix(db).actsByApp.get(appId) ?? [];
export const ownerActs = (db: DB, ownerId: string) => ix(db).actsByOwner.get(ownerId) ?? [];
export const ownerContacts = (db: DB, ownerId: string) => ix(db).contactsByOwner.get(ownerId) ?? [];
export const ownerApps = (db: DB, ownerId: string) => ix(db).appsByOwner.get(ownerId) ?? [];
export const ownerTasks = (db: DB, ownerId: string) => ix(db).tasksByOwner.get(ownerId) ?? [];

const STAGE_RANK: Record<string, number> = { outreach: 1, follow_up: 1, reply: 2, chat_scheduled: 3, chat_completed: 4 };
const STAGE_BY_RANK: RelStage[] = ['Not contacted', 'Awaiting reply', 'Replied', 'Chat scheduled', 'Chat completed'];

/** Relationship stage derives from the activity history; only "Closed" is set by hand. */
export function relStage(db: DB, c: Contact): RelStage {
  if (c.closed) return 'Closed';
  let r = 0;
  for (const a of contactActs(db, c.id)) r = Math.max(r, STAGE_RANK[a.type] ?? 0);
  return STAGE_BY_RANK[r];
}
export function lastActivity(db: DB, contactId: string): Activity | undefined {
  const a = contactActs(db, contactId);
  return a[a.length - 1];
}
export function followUpCount(db: DB, contactId: string): number {
  return contactActs(db, contactId).filter(a => a.type === 'follow_up').length;
}
export function openFollowUp(db: DB, contactId: string): Task | undefined {
  const c = ix(db).contact.get(contactId);
  return c ? ownerTasks(db, c.ownerId).find(t => t.contactId === contactId && t.status === 'open') : undefined;
}
export function firstOutreach(db: DB, contactId: string): Activity | undefined {
  return contactActs(db, contactId).find(a => OUTREACH_TYPES.has(a.type));
}
export function upcomingChat(db: DB, contactId: string): Activity | undefined {
  const acts = contactActs(db, contactId);
  const lastSched = [...acts].reverse().find(a => a.type === 'chat_scheduled');
  if (!lastSched) return undefined;
  const completedAfter = acts.some(a => a.type === 'chat_completed' && a.occurredAt >= lastSched.occurredAt);
  return completedAfter ? undefined : lastSched;
}

export function appInterviews(db: DB, appId: string) {
  return db.interviews.filter(i => i.applicationId === appId).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
export function nextInterview(db: DB, appId: string) {
  const now = new Date().toISOString();
  return appInterviews(db, appId).find(i => i.status === 'scheduled' && i.scheduledAt >= now);
}

// ---------- Targets ----------
export function targetStats(db: DB, ownerId: string, firmId: string) {
  const contacts = ownerContacts(db, ownerId).filter(c => firmOf(db, c.firmId)?.id === firmId);
  const apps = ownerApps(db, ownerId).filter(a => firmOf(db, a.firmId)?.id === firmId);
  let last: Activity | undefined;
  for (const c of contacts) { const l = lastActivity(db, c.id); if (l && (!last || l.occurredAt > last.occurredAt)) last = l; }
  for (const a of apps) { const l = appActs(db, a.id).at(-1); if (l && (!last || l.occurredAt > last.occurredAt)) last = l; }
  const tasks = contacts.map(c => openFollowUp(db, c.id)).filter(Boolean) as Task[];
  const appTasks = apps.filter(a => a.nextAction && a.nextActionDue && !['Offer', 'Rejected', 'Withdrawn'].includes(a.stage));
  const nexts: { label: string; due: DateOnly }[] = [
    ...tasks.map(t => ({ label: `Follow up with ${ix(db).contact.get(t.contactId)?.name}`, due: t.dueOn })),
    ...appTasks.map(a => ({ label: a.nextAction!, due: a.nextActionDue! })),
  ].sort((a, b) => a.due.localeCompare(b.due));
  return {
    contactCount: contacts.length,
    activeApps: apps.filter(a => ACTIVE_APP_STAGES.includes(a.stage)).length,
    last, next: nexts[0],
  };
}

// ---------- Periods & metrics ----------
export interface Period { start: DateOnly; end: DateOnly; label: string }
export function thisWeek(tz: string): Period {
  const t = todayKey(tz);
  return { start: weekStart(t), end: t, label: 'This week' };
}
export function lastNDays(tz: string, n: number): Period {
  const t = todayKey(tz);
  return { start: addDays(t, -(n - 1)), end: t, label: `Last ${n} days` };
}
const inPeriod = (a: Activity, p: Period, tz: string) => { const d = dateKey(a.occurredAt, tz); return d >= p.start && d <= p.end; };

/** Period activity totals (counts of events that happened in the window). */
export function periodTotals(db: DB, ownerIds: string[], p: Period, tz: string) {
  let newContacts = 0, followUps = 0, chats = 0, apps = 0, replies = 0;
  for (const o of ownerIds) {
    for (const a of ownerActs(db, o)) {
      if (!inPeriod(a, p, tz)) continue;
      if (a.type === 'follow_up') followUps++;
      else if (a.type === 'chat_completed') chats++;
      else if (a.type === 'app_submitted') apps++;
      else if (a.type === 'reply') replies++;
    }
    for (const c of ownerContacts(db, o)) {
      const f = firstOutreach(db, c.id);
      if (f && inPeriod(f, p, tz)) newContacts++;
    }
  }
  return { newContacts, followUps, chats, apps, replies };
}

/** Outreach cohort: contacts whose FIRST logged outreach falls in the period.
 *  Conversion counts later logged replies / completed chats up to the observation cutoff (now). */
export function cohort(db: DB, ownerIds: string[], p: Period, tz: string) {
  let size = 0, replied = 0, chatted = 0;
  for (const o of ownerIds) for (const c of ownerContacts(db, o)) {
    const f = firstOutreach(db, c.id);
    if (!f || !inPeriod(f, p, tz)) continue;
    size++;
    const later = contactActs(db, c.id).filter(a => a.occurredAt >= f.occurredAt);
    if (later.some(a => RESPONSE_TYPES.has(a.type))) replied++;
    if (later.some(a => a.type === 'chat_completed')) chatted++;
  }
  return { size, replied, chatted, cutoff: new Date().toISOString() };
}

export function pipeline(db: DB, ownerIds: string[]) {
  const rows = new Map<string, Record<string, number>>();
  for (const o of ownerIds) for (const a of ownerApps(db, o)) {
    const r = rows.get(a.cycle) ?? {};
    r[a.stage] = (r[a.stage] ?? 0) + 1;
    rows.set(a.cycle, r);
  }
  return rows;
}

// ---------- Goals ----------
export function goalWindowEvents(db: DB, g: Goal, tz: string): string[] {
  // returns sorted ISO timestamps of qualifying events inside [startOn, dueOn]
  const inWin = (iso: string) => { const d = dateKey(iso, tz); return d >= g.startOn && d <= g.dueOn; };
  const acts = ownerActs(db, g.analystId);
  switch (g.type) {
    case 'new_contacts':
      return ownerContacts(db, g.analystId).map(c => firstOutreach(db, c.id)?.occurredAt).filter((x): x is string => !!x && inWin(x)).sort();
    case 'follow_ups': return acts.filter(a => a.type === 'follow_up' && inWin(a.occurredAt)).map(a => a.occurredAt);
    case 'chats_completed': return acts.filter(a => a.type === 'chat_completed' && inWin(a.occurredAt)).map(a => a.occurredAt);
    case 'applications_submitted': return acts.filter(a => a.type === 'app_submitted' && inWin(a.occurredAt)).map(a => a.occurredAt);
    case 'mock_completed':
      return db.mockRequests.filter(m => m.requesterId === g.analystId && m.status === 'Completed' && m.completedAt && inWin(m.completedAt)).map(m => m.completedAt!).sort();
    case 'prep_task': return g.completedAt ? [g.completedAt] : [];
  }
}
export type GoalStatus = 'Completed' | 'In progress' | 'Overdue' | 'Not started' | 'Cancelled' | 'Missed';
export function goalProgress(db: DB, g: Goal, tz: string) {
  const events = goalWindowEvents(db, g, tz);
  const target = g.type === 'prep_task' ? 1 : g.target;
  const progress = Math.min(events.length, target);
  const doneAt = events.length >= target ? events[target - 1] : undefined;
  const today = todayKey(tz);
  let status: GoalStatus;
  if (g.cancelled) status = 'Cancelled';
  else if (doneAt) status = 'Completed';
  else if (today > g.dueOn) status = 'Overdue';
  else if (today < g.startOn) status = 'Not started';
  else status = 'In progress';
  return { progress, target, status, doneAt, completedOnTime: !!doneAt && dateKey(doneAt, tz) <= g.dueOn };
}
export function goalCompletion(db: DB, analystIds: string[], p: Period, tz: string) {
  let due = 0, done = 0;
  for (const g of db.goals) {
    if (!analystIds.includes(g.analystId) || g.cancelled) continue;
    if (g.dueOn < p.start || g.dueOn > p.end) continue;
    due++;
    if (goalProgress(db, g, tz).completedOnTime) done++;
  }
  return { due, done };
}

// ---------- Groups ----------
export function groupOf(db: DB, analystId: string) {
  const gid = ix(db).groupOfAnalyst.get(analystId);
  return db.groups.find(g => g.id === gid);
}
export function groupAnalysts(db: DB, groupId: string): Member[] {
  return db.assignments.filter(a => a.groupId === groupId).map(a => ix(db).member.get(a.analystId)!).filter(m => m && m.active);
}
export function mentorAnalysts(db: DB, mentorId: string): Member[] {
  return db.groups.filter(g => g.mentorId === mentorId).flatMap(g => groupAnalysts(db, g.id));
}

export function overdueFollowUps(db: DB, ownerId: string, tz: string) {
  const t = todayKey(tz);
  return ownerTasks(db, ownerId).filter(x => x.status === 'open' && x.dueOn < t);
}
export function nextInterviewFor(db: DB, ownerId: string) {
  const now = new Date().toISOString();
  return db.interviews.filter(i => i.ownerId === ownerId && i.status === 'scheduled' && i.scheduledAt >= now).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
}
export function lastLogged(db: DB, ownerId: string) {
  const a = ownerActs(db, ownerId);
  return a.length ? a.reduce((m, x) => (x.createdAt > m.createdAt ? x : m)) : undefined;
}
export function daysSince(iso: string | undefined, tz: string) {
  return iso ? diffDays(todayKey(tz), dateKey(iso, tz)) : Infinity;
}
