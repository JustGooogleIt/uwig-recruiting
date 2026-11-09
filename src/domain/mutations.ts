// Mutations: pure functions (db, actor, input) => db. Each one checks permissions the same way
// the production API / RLS policies will. In production each becomes a server action or
// Supabase RPC; the UI calls them through the same names (see store.tsx `act`).
import type {
  Activity, ActivityType, Application, AppStage, Contact, DB, DateOnly, ExtractedRow, Firm, Goal,
  Announcement, ImportBatch, InterviewEvent, Member, MockRequest, MockStatus, Target, Task, Track,
} from './types';
import { contactActs, firmOf, ix, OUTREACH_TYPES, RESPONSE_TYPES } from './derive';
import { addDays, dateKey, todayKey, zonedToISO } from './time';
import { assert, canEditRecords, canManageGoals, isExec, viewer } from './permissions';
import { newId, nowISO } from './ids';

type Patch<T> = Partial<T>;
const replace = <T extends { id: string }>(arr: T[], id: string, fn: (x: T) => T) => arr.map(x => (x.id === id ? fn(x) : x));
const tzOf = (db: DB, memberId: string) => ix(db).member.get(memberId)?.timezone ?? 'America/Los_Angeles';

// ---------------- Follow-up reconciliation ----------------
/** Keeps exactly one open follow-up per contact while the latest outreach is unanswered.
 *  Runs after any activity change for the contact, so edits, deletes and undo stay consistent. */
export function reconcileFollowUps(db: DB, contactId: string): DB {
  const c = ix(db).contact.get(contactId);
  const tasks = db.tasks.filter(t => t.contactId === contactId);
  let all = db.tasks;
  const actIds = new Set(contactActs(db, contactId).map(a => a.id));
  // Drop auto tasks whose source outreach no longer exists (deleted or undone).
  const orphan = tasks.filter(t => !actIds.has(t.sourceActivityId));
  if (orphan.length) all = all.filter(t => !orphan.includes(t));
  if (!c) return { ...db, tasks: all };
  const acts = contactActs(db, contactId);
  const lastOut = [...acts].reverse().find(a => OUTREACH_TYPES.has(a.type));
  const reply = lastOut && acts.find(a => RESPONSE_TYPES.has(a.type) && a.occurredAt >= lastOut.occurredAt);
  const member = ix(db).member.get(c.ownerId)!;
  const live = all.filter(t => t.contactId === contactId);
  const open = live.find(t => t.status === 'open');
  const now = nowISO();
  if (!lastOut || reply || c.closed) {
    if (open) all = all.map(t => (t === open ? { ...t, status: 'resolved', resolvedByActivityId: reply?.id, closedAt: now } : t));
    return { ...db, tasks: all };
  }
  const due = addDays(dateKey(lastOut.occurredAt, member.timezone), member.followUpDays);
  if (open) {
    if (open.sourceActivityId !== lastOut.id) all = all.map(t => (t === open ? { ...t, sourceActivityId: lastOut.id, dueOn: due, snoozeCount: 0 } : t));
    return { ...db, tasks: all };
  }
  const existing = live.find(t => t.sourceActivityId === lastOut.id);
  if (existing) {
    // Reopen only if it was auto-resolved by a reply that no longer exists. Member-closed tasks stay closed.
    if (existing.status === 'resolved') all = all.map(t => (t === existing ? { ...t, status: 'open', resolvedByActivityId: undefined, closedAt: undefined } : t));
    return { ...db, tasks: all };
  }
  const task: Task = { id: newId('task'), ownerId: c.ownerId, kind: 'follow_up', contactId, dueOn: due, status: 'open', sourceActivityId: lastOut.id, snoozeCount: 0, createdAt: now };
  return { ...db, tasks: [...all, task] };
}
function reconcileMany(db: DB, contactIds: (string | undefined)[]): DB {
  for (const id of new Set(contactIds.filter(Boolean) as string[])) db = reconcileFollowUps(db, id);
  return db;
}

// ---------------- Firms ----------------
export function submitFirm(db: DB, actor: string, input: Pick<Firm, 'name' | 'website' | 'type' | 'tracks' | 'offices' | 'careersUrl'>): [DB, Firm] {
  assert(input.name.trim().length > 1, 'Enter the firm name.');
  // Exec submissions go straight into the directory; everyone else's wait for exec review.
  const f: Firm = { ...input, id: newId('firm'), name: input.name.trim(), status: isExec(db, actor) ? 'approved' : 'pending', aliases: [], submittedBy: actor, createdAt: nowISO() };
  return [{ ...db, firms: [...db.firms, f] }, f];
}
export function approveFirm(db: DB, actor: string, id: string, corrections: Patch<Firm>): DB {
  assert(isExec(db, actor), 'Only exec can approve directory submissions.');
  return { ...db, firms: replace(db.firms, id, f => ({ ...f, ...corrections, status: 'approved', lastVerified: todayKey(tzOf(db, actor)) })) };
}
/** Merge a pending firm into an existing one. Linked targets, contacts, applications and announcements move with it. */
export function mergeFirm(db: DB, actor: string, id: string, intoId: string): DB {
  assert(isExec(db, actor), 'Only exec can merge directory submissions.');
  assert(id !== intoId, 'Choose a different firm to merge into.');
  const src = ix(db).firm.get(id)!;
  const re = <T extends { firmId: string }>(x: T): T => (x.firmId === id ? { ...x, firmId: intoId } : x);
  return {
    ...db,
    firms: db.firms.map(f => f.id === id ? { ...f, status: 'merged', mergedIntoId: intoId }
      : f.id === intoId ? { ...f, aliases: Array.from(new Set([...f.aliases, src.name])), offices: Array.from(new Set([...f.offices, ...src.offices])) } : f),
    targets: db.targets.map(re), contacts: db.contacts.map(re), applications: db.applications.map(re),
    announcements: db.announcements.map(a => (a.firmId === id ? { ...a, firmId: intoId } : a)),
  };
}
export function updateFirm(db: DB, actor: string, id: string, p: Patch<Firm>): DB {
  assert(isExec(db, actor), 'Only exec can edit directory entries.');
  return { ...db, firms: replace(db.firms, id, f => ({ ...f, ...p })) };
}
/** Exec adds many firms at once (e.g. a scraped list). Names already in the directory are skipped. */
export function addFirmsBulk(db: DB, actor: string, names: string[], type: Firm['type'], tracks: Track[], source: string): [DB, { added: string[]; skipped: string[] }] {
  assert(isExec(db, actor), 'Only exec can add firms in bulk.');
  const key = (n: string) => n.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
  const known = new Set(db.firms.filter(f => f.status !== 'rejected').flatMap(f => [f.name, ...f.aliases]).map(key));
  const added: string[] = [], skipped: string[] = [], firms: Firm[] = [];
  for (const raw of names) {
    const name = raw.trim(); if (!name) continue;
    if (known.has(key(name))) { skipped.push(name); continue; }
    known.add(key(name)); added.push(name);
    firms.push({ id: newId('firm'), name, type, tracks, offices: [], status: 'approved', aliases: [], source, submittedBy: actor, createdAt: nowISO() });
  }
  return [{ ...db, firms: [...db.firms, ...firms] }, { added, skipped }];
}

// ---------------- Announcements (exec) ----------------
export type AnnouncementInput = Pick<Announcement, 'title' | 'body' | 'firmId' | 'contactName' | 'contactEmail' | 'link' | 'tracks' | 'deadline' | 'pinned'>;
export function postAnnouncement(db: DB, actor: string, a: AnnouncementInput): DB {
  assert(isExec(db, actor), 'Only exec can post announcements.');
  assert(!!a.title.trim() && !!a.body.trim(), 'Add a title and a description.');
  if (a.contactEmail) assert(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.contactEmail), 'Enter a valid contact email.');
  const now = nowISO();
  return { ...db, announcements: [{ ...a, title: a.title.trim(), body: a.body.trim(), id: newId('ann'), authorId: actor, archived: false, createdAt: now, updatedAt: now }, ...db.announcements] };
}
export function updateAnnouncement(db: DB, actor: string, id: string, p: Patch<Announcement>): DB {
  assert(isExec(db, actor), 'Only exec can edit announcements.');
  return { ...db, announcements: replace(db.announcements, id, x => ({ ...x, ...p, updatedAt: nowISO() })) };
}

// ---------------- Targets ----------------
export function addTarget(db: DB, actor: string, t: Omit<Target, 'id' | 'ownerId' | 'createdAt' | 'state'>): [DB, Target, boolean] {
  const dupe = db.targets.find(x => x.ownerId === actor && firmOf(db, x.firmId)?.id === firmOf(db, t.firmId)?.id && x.track === t.track && x.cycle === t.cycle);
  if (dupe) {
    const d = { ...db, targets: replace(db.targets, dupe.id, x => ({ ...x, state: 'active' as const })) };
    return [d, dupe, true];
  }
  const target: Target = { ...t, id: newId('tgt'), ownerId: actor, state: 'active', createdAt: nowISO() };
  return [{ ...db, targets: [...db.targets, target] }, target, false];
}
export function updateTarget(db: DB, actor: string, id: string, p: Patch<Target>): DB {
  const t = db.targets.find(x => x.id === id)!;
  assert(canEditRecords(actor, t.ownerId));
  return { ...db, targets: replace(db.targets, id, x => ({ ...x, ...p })) };
}

// ---------------- Contacts ----------------
export function findContactDuplicates(db: DB, ownerId: string, name: string, firmId: string | undefined, email: string | undefined, excludeId?: string) {
  const n = name.trim().toLowerCase();
  const e = email?.trim().toLowerCase();
  const fid = firmOf(db, firmId)?.id;
  return db.contacts.filter(c => c.ownerId === ownerId && c.id !== excludeId && (
    (e && c.email?.toLowerCase() === e) || (n && c.name.toLowerCase() === n && firmOf(db, c.firmId)?.id === fid)));
}
export function addContact(db: DB, actor: string, input: Omit<Contact, 'id' | 'ownerId' | 'createdAt' | 'closed'>): [DB, Contact] {
  assert(!!input.name.trim(), 'Enter the contact’s name.');
  assert(!!input.firmId, 'Choose a firm.');
  const c: Contact = { ...input, name: input.name.trim(), email: input.email?.trim() || undefined, id: newId('con'), ownerId: actor, closed: false, createdAt: nowISO() };
  return [{ ...db, contacts: [...db.contacts, c] }, c];
}
export function updateContact(db: DB, actor: string, id: string, p: Patch<Contact>): DB {
  const c = ix(db).contact.get(id)!;
  assert(canEditRecords(actor, c.ownerId), 'Only the owner can edit this contact.');
  if (p.name !== undefined) assert(!!p.name.trim(), 'Name is required.');
  const d = { ...db, contacts: replace(db.contacts, id, x => ({ ...x, ...p })) };
  return p.closed !== undefined ? reconcileFollowUps(d, id) : d;
}
export function deleteContact(db: DB, actor: string, id: string): DB {
  const c = ix(db).contact.get(id)!;
  assert(canEditRecords(actor, c.ownerId));
  return {
    ...db,
    contacts: db.contacts.filter(x => x.id !== id),
    activities: db.activities.filter(a => a.contactId !== id || !!a.applicationId).map(a => a.contactId === id ? { ...a, contactId: undefined } : a),
    tasks: db.tasks.filter(t => t.contactId !== id),
    applications: db.applications.map(a => ({ ...a, contactIds: a.contactIds.filter(x => x !== id) })),
  };
}

// ---------------- Activities ----------------
export interface ActivityInput {
  type: ActivityType; contactId?: string; applicationId?: string;
  date: DateOnly; time?: string; eventDate?: DateOnly; eventTime?: string;
  source?: Activity['source']; importBatchId?: string;
}
function buildActivity(db: DB, actor: string, i: ActivityInput): Activity {
  const tz = tzOf(db, actor);
  return {
    id: newId('act'), ownerId: actor, type: i.type,
    occurredAt: zonedToISO(i.date, i.time || '12:00', tz), dateOnly: !i.time,
    eventAt: i.eventDate ? zonedToISO(i.eventDate, i.eventTime || '12:00', tz) : undefined,
    contactId: i.contactId, applicationId: i.applicationId,
    source: i.source ?? 'manual', importBatchId: i.importBatchId, createdAt: nowISO(),
  };
}
const STAGE_FROM_ACTIVITY: Partial<Record<ActivityType, AppStage>> = { app_submitted: 'Applied', offer: 'Offer' };
export function logActivity(db: DB, actor: string, i: ActivityInput): [DB, Activity] {
  assert(!!(i.contactId || i.applicationId), 'Choose a contact or an application.');
  if (i.contactId) assert(canEditRecords(actor, ix(db).contact.get(i.contactId)!.ownerId), 'You can only log activity in your own workspace.');
  if (i.applicationId) assert(canEditRecords(actor, ix(db).app.get(i.applicationId)!.ownerId), 'You can only log activity in your own workspace.');
  assert(!!i.date, 'Enter the date.');
  if (i.type === 'chat_scheduled' || i.type === 'interview_scheduled') assert(!!i.eventDate, 'Enter when it is scheduled for.');
  const a = buildActivity(db, actor, i);
  let d: DB = { ...db, activities: [...db.activities, a] };
  if (i.applicationId) {
    const app = ix(d).app.get(i.applicationId)!;
    const s = STAGE_FROM_ACTIVITY[i.type];
    const order = ['Considering', 'Applied'];
    const p: Patch<Application> = {};
    if (s === 'Applied' && order.includes(app.stage)) { p.stage = 'Applied'; p.appliedOn = app.appliedOn ?? i.date; }
    if (s === 'Offer') p.stage = 'Offer';
    if (Object.keys(p).length) d = { ...d, applications: replace(d.applications, app.id, x => ({ ...x, ...p })) };
  }
  if (i.contactId) d = reconcileFollowUps(d, i.contactId);
  return [d, a];
}
export function updateActivity(db: DB, actor: string, id: string, p: { type?: ActivityType; date?: DateOnly; time?: string }): DB {
  const a = db.activities.find(x => x.id === id)!;
  assert(canEditRecords(actor, a.ownerId), 'Only the owner can correct this entry.');
  const tz = tzOf(db, actor);
  const next: Activity = { ...a, type: p.type ?? a.type };
  if (p.date) { next.occurredAt = zonedToISO(p.date, p.time || '12:00', tz); next.dateOnly = !p.time; }
  const d = { ...db, activities: replace(db.activities, id, () => next) };
  return reconcileMany(d, [a.contactId]);
}
export function deleteActivity(db: DB, actor: string, id: string): DB {
  const a = db.activities.find(x => x.id === id)!;
  assert(canEditRecords(actor, a.ownerId), 'Only the owner can delete this entry.');
  const d = { ...db, activities: db.activities.filter(x => x.id !== id) };
  return reconcileMany(d, [a.contactId]);
}
/** Previous outreach to this contact, used to warn about duplicate initial outreach. */
export function priorOutreach(db: DB, contactId: string) {
  return contactActs(db, contactId).filter(a => OUTREACH_TYPES.has(a.type)).at(-1);
}

// ---------------- Tasks ----------------
function taskOp(db: DB, actor: string, id: string, fn: (t: Task) => Task): DB {
  const t = db.tasks.find(x => x.id === id)!;
  assert(canEditRecords(actor, t.ownerId));
  return { ...db, tasks: replace(db.tasks, id, fn) };
}
export const setTaskDue = (db: DB, actor: string, id: string, dueOn: DateOnly) => taskOp(db, actor, id, t => ({ ...t, dueOn }));
export const snoozeTask = (db: DB, actor: string, id: string, days: number) =>
  taskOp(db, actor, id, t => ({ ...t, dueOn: addDays(t.dueOn < todayKey(tzOf(db, actor)) ? todayKey(tzOf(db, actor)) : t.dueOn, days), snoozeCount: t.snoozeCount + 1 }));
export const completeTask = (db: DB, actor: string, id: string) => taskOp(db, actor, id, t => ({ ...t, status: 'done', closedAt: nowISO() }));
export const cancelTask = (db: DB, actor: string, id: string) => taskOp(db, actor, id, t => ({ ...t, status: 'cancelled', closedAt: nowISO() }));

// ---------------- Applications ----------------
export function addApplication(db: DB, actor: string, input: Omit<Application, 'id' | 'ownerId' | 'createdAt'>): [DB, Application] {
  assert(!!input.firmId, 'Choose a firm.');
  assert(!!input.roleTitle.trim(), 'Enter the role title.');
  const app: Application = { ...input, id: newId('app'), ownerId: actor, createdAt: nowISO() };
  let d: DB = { ...db, applications: [...db.applications, app] };
  if (input.stage !== 'Considering' && input.appliedOn) {
    [d] = logActivity(d, actor, { type: 'app_submitted', applicationId: app.id, date: input.appliedOn });
    d = { ...d, applications: replace(d.applications, app.id, x => ({ ...x, stage: input.stage })) };
  }
  return [d, ix(d).app.get(app.id)!];
}
const CLOSE_STAGES: AppStage[] = ['Rejected', 'Withdrawn'];
/** Changing stage records the matching activity so history is preserved, not overwritten. */
export function updateApplication(db: DB, actor: string, id: string, p: Patch<Application>): DB {
  const app = ix(db).app.get(id)!;
  assert(canEditRecords(actor, app.ownerId), 'Only the owner can edit this application.');
  if (p.roleTitle !== undefined) assert(!!p.roleTitle.trim(), 'Role title is required.');
  let d: DB = { ...db, applications: replace(db.applications, id, x => ({ ...x, ...p })) };
  const today = todayKey(tzOf(db, actor));
  if (p.stage && p.stage !== app.stage) {
    const hasSubmitted = d.activities.some(a => a.applicationId === id && a.type === 'app_submitted');
    if (p.stage !== 'Considering' && !CLOSE_STAGES.includes(p.stage) && !hasSubmitted) {
      [d] = logActivity(d, actor, { type: 'app_submitted', applicationId: id, date: app.appliedOn ?? today });
      d = { ...d, applications: replace(d.applications, id, x => ({ ...x, appliedOn: x.appliedOn ?? today, stage: p.stage! })) };
    }
    if (p.stage === 'Offer') [d] = logActivity(d, actor, { type: 'offer', applicationId: id, date: today });
    if (CLOSE_STAGES.includes(p.stage)) [d] = logActivity(d, actor, { type: 'app_closed', applicationId: id, date: today });
  }
  return d;
}
export function deleteApplication(db: DB, actor: string, id: string): DB {
  const app = ix(db).app.get(id)!;
  assert(canEditRecords(actor, app.ownerId));
  return { ...db, applications: db.applications.filter(a => a.id !== id), interviews: db.interviews.filter(i => i.applicationId !== id), activities: db.activities.filter(a => a.applicationId !== id || !!a.contactId) };
}
export function scheduleInterview(db: DB, actor: string, appId: string, round: string, type: string, date: DateOnly, time: string): DB {
  const app = ix(db).app.get(appId)!;
  assert(canEditRecords(actor, app.ownerId));
  assert(!!date, 'Enter the interview date.');
  const tz = tzOf(db, actor);
  const iv: InterviewEvent = { id: newId('int'), ownerId: actor, applicationId: appId, round, type, scheduledAt: zonedToISO(date, time || '09:00', tz), status: 'scheduled', createdAt: nowISO() };
  let d: DB = { ...db, interviews: [...db.interviews, iv] };
  [d] = logActivity(d, actor, { type: 'interview_scheduled', applicationId: appId, date: todayKey(tz), eventDate: date, eventTime: time || '09:00' });
  const roundStage: Record<string, AppStage> = { 'First round': 'First round', 'Second round': 'Further rounds', 'Superday / final': 'Final round' };
  const target = roundStage[round];
  const order = ['Considering', 'Applied', 'Assessment', 'First round', 'Further rounds', 'Final round'];
  if (target && order.indexOf(app.stage) < order.indexOf(target)) d = updateApplication(d, actor, appId, { stage: target });
  return d;
}
export function setInterviewStatus(db: DB, actor: string, id: string, status: InterviewEvent['status']): DB {
  const iv = db.interviews.find(i => i.id === id)!;
  assert(canEditRecords(actor, iv.ownerId));
  let d: DB = { ...db, interviews: replace(db.interviews, id, x => ({ ...x, status })) };
  if (status === 'completed') {
    const tz = tzOf(db, actor);
    const when = iv.scheduledAt < nowISO() ? iv.scheduledAt : nowISO();
    [d] = logActivity(d, actor, { type: 'interview_completed', applicationId: iv.applicationId, date: dateKey(when, tz), time: undefined });
  }
  return d;
}

// ---------------- Goals ----------------
export function addGoal(db: DB, actor: string, g: Omit<Goal, 'id' | 'setById' | 'createdAt' | 'cancelled'>): DB {
  assert(canManageGoals(db, actor, g.analystId), 'Only this analyst’s mentor or exec can set goals.');
  assert(g.dueOn >= g.startOn, 'The due date must be on or after the start date.');
  if (g.type === 'prep_task') assert(!!g.label?.trim(), 'Describe the preparation task.');
  else assert(g.target >= 1, 'Enter a target of at least 1.');
  return { ...db, goals: [...db.goals, { ...g, id: newId('goal'), setById: actor, createdAt: nowISO(), cancelled: false }] };
}
export function updateGoal(db: DB, actor: string, id: string, p: Patch<Goal>): DB {
  const g = db.goals.find(x => x.id === id)!;
  assert(canManageGoals(db, actor, g.analystId), 'Only this analyst’s mentor or exec can edit goals.');
  return { ...db, goals: replace(db.goals, id, x => ({ ...x, ...p })) };
}
/** Preparation tasks are completed explicitly, by the analyst or their mentor. */
export function setPrepComplete(db: DB, actor: string, id: string, done: boolean): DB {
  const g = db.goals.find(x => x.id === id)!;
  assert(actor === g.analystId || canManageGoals(db, actor, g.analystId));
  return { ...db, goals: replace(db.goals, id, x => ({ ...x, completedAt: done ? nowISO() : undefined })) };
}

// ---------------- Mock interviews ----------------
export function requestMock(db: DB, actor: string, r: Pick<MockRequest, 'mentorId' | 'track' | 'interviewType' | 'targetFirmId' | 'proposedTime' | 'schedulingLink'>): DB {
  assert(r.mentorId !== actor, 'Choose another mentor.');
  assert(!!r.proposedTime || !!r.schedulingLink, 'Propose a time or confirm you will use the mentor’s scheduling link.');
  const now = nowISO();
  return { ...db, mockRequests: [...db.mockRequests, { ...r, id: newId('mock'), requesterId: actor, status: 'Requested', createdAt: now, updatedAt: now }] };
}
const MOCK_FLOW: Record<MockStatus, MockStatus[]> = {
  Requested: ['Accepted', 'Declined', 'Cancelled', 'Scheduled'], Accepted: ['Scheduled', 'Cancelled'],
  Scheduled: ['Completed', 'Cancelled'], Completed: [], Declined: [], Cancelled: [],
};
export function setMockStatus(db: DB, actor: string, id: string, status: MockStatus, scheduledAt?: string): DB {
  const m = db.mockRequests.find(x => x.id === id)!;
  assert(MOCK_FLOW[m.status].includes(status), `A ${m.status.toLowerCase()} request cannot move to ${status.toLowerCase()}.`);
  const mentorOnly: MockStatus[] = ['Accepted', 'Declined', 'Completed'];
  if (mentorOnly.includes(status)) assert(actor === m.mentorId, 'Only the mentor can do that.');
  else assert(actor === m.mentorId || actor === m.requesterId);
  if (status === 'Scheduled') assert(!!scheduledAt, 'Enter the scheduled time.');
  const now = nowISO();
  return { ...db, mockRequests: replace(db.mockRequests, id, x => ({ ...x, status, updatedAt: now, scheduledAt: scheduledAt ?? x.scheduledAt, completedAt: status === 'Completed' ? now : x.completedAt })) };
}

// ---------------- Membership (exec) ----------------
export function setRole(db: DB, actor: string, memberId: string, role: Member['role']): DB {
  assert(isExec(db, actor), 'Only exec can change roles.');
  assert(memberId !== actor, 'You cannot change your own role.');
  let d: DB = { ...db, members: replace(db.members, memberId, m => ({ ...m, role })) };
  if (role !== 'analyst') d = { ...d, assignments: d.assignments.filter(a => a.analystId !== memberId) };
  if (role === 'mentor' && !d.groups.some(g => g.mentorId === memberId)) {
    const m = ix(d).member.get(memberId)!;
    d = { ...d, groups: [...d.groups, { id: newId('grp'), name: `${m.name.split(' ')[1] ?? m.name} group`, mentorId: memberId, createdAt: nowISO() }] };
  }
  return d;
}
export function assignAnalyst(db: DB, actor: string, analystId: string, groupId: string | ''): DB {
  assert(isExec(db, actor), 'Only exec can change mentor assignments.');
  const rest = db.assignments.filter(a => a.analystId !== analystId);
  return { ...db, assignments: groupId ? [...rest, { analystId, groupId, assignedAt: nowISO(), assignedBy: actor }] : rest };
}
export function createGroup(db: DB, actor: string, name: string, mentorId: string): DB {
  assert(isExec(db, actor), 'Only exec can create groups.');
  assert(!!name.trim(), 'Name the group.');
  return { ...db, groups: [...db.groups, { id: newId('grp'), name: name.trim(), mentorId, createdAt: nowISO() }] };
}
export function setGroupMentor(db: DB, actor: string, groupId: string, mentorId: string): DB {
  assert(isExec(db, actor));
  return { ...db, groups: replace(db.groups, groupId, g => ({ ...g, mentorId })) };
}
export function addMember(db: DB, actor: string, m: Pick<Member, 'name' | 'email' | 'role' | 'classYear'>): DB {
  assert(isExec(db, actor), 'Only exec can add members.');
  assert(!!m.name.trim() && /.+@.+\..+/.test(m.email), 'Enter a name and a valid email.');
  assert(!db.members.some(x => x.email.toLowerCase() === m.email.toLowerCase()), 'A member with that email already exists.');
  const member: Member = { ...m, id: newId('mem'), tracks: [], timezone: 'America/Los_Angeles', followUpDays: 7, active: true, createdAt: nowISO() };
  return { ...db, members: [...db.members, member] };
}
export function setActive(db: DB, actor: string, memberId: string, active: boolean): DB {
  assert(isExec(db, actor) && memberId !== actor);
  return { ...db, members: replace(db.members, memberId, m => ({ ...m, active })) };
}
export function updateSettings(db: DB, actor: string, p: Pick<Patch<Member>, 'timezone' | 'followUpDays' | 'tracks'>): DB {
  viewer(db, actor);
  return { ...db, members: replace(db.members, actor, m => ({ ...m, ...p })) };
}

// ---------------- Imports ----------------
export interface ImportResult { batch: ImportBatch; created: number; newContacts: number; skippedDuplicates: number; resolvedFollowUps: number }
/** Confirm reviewed rows. Re-confirming rows already confirmed (same row keys or same
 *  contact+type+date) creates nothing, so overlapping screenshots never double count. */
export function confirmImport(db: DB, actor: string, source: 'screenshot' | 'csv', rows: ExtractedRow[]): [DB, ImportResult] {
  const tz = tzOf(db, actor);
  const confirmedKeys = new Set(db.importBatches.filter(b => b.ownerId === actor && b.status === 'confirmed').flatMap(b => b.rowKeys));
  const batch: ImportBatch = { id: newId('imp'), ownerId: actor, source, status: 'confirmed', createdAt: nowISO(), confirmedAt: nowISO(), rowKeys: [], createdContactIds: [], createdActivityIds: [], patchedEmails: [] };
  let d = db, skipped = 0, newContacts = 0;
  const openBefore = new Set(db.tasks.filter(t => t.ownerId === actor && t.status === 'open').map(t => t.id));
  const touched: string[] = [];
  for (const r of rows) {
    if (!r.include) continue;
    assert(!!r.type && !!r.date && !!(r.matchContactId || (r.contactName.trim() && r.firmId)), 'Every included row needs a contact, firm, activity type and date.');
    if (confirmedKeys.has(r.key)) { skipped++; continue; }
    let contactId = r.matchContactId;
    if (!contactId) {
      const [d2, c] = addContact(d, actor, { name: r.contactName, firmId: r.firmId!, title: '', email: r.email, source: 'Cold outreach', importBatchId: batch.id });
      d = d2; contactId = c.id; newContacts++; batch.createdContactIds.push(c.id);
    } else if (r.email && !ix(d).contact.get(contactId)!.email) {
      d = { ...d, contacts: replace(d.contacts, contactId, c => ({ ...c, email: r.email })) };
      batch.patchedEmails.push({ contactId, email: r.email });
    }
    const dupe = contactActs(d, contactId).find(a => a.type === r.type && dateKey(a.occurredAt, tz) === r.date);
    if (dupe) { skipped++; batch.rowKeys.push(r.key); continue; }
    const [d3, a] = logActivity(d, actor, { type: r.type as ActivityType, contactId, date: r.date!, source, importBatchId: batch.id });
    d = d3; batch.createdActivityIds.push(a.id); batch.rowKeys.push(r.key); touched.push(contactId);
  }
  d = { ...d, importBatches: [...d.importBatches, batch] };
  const resolved = d.tasks.filter(t => openBefore.has(t.id) && t.status === 'resolved').length;
  return [d, { batch, created: batch.createdActivityIds.length, newContacts, skippedDuplicates: skipped, resolvedFollowUps: resolved }];
}
/** Undo removes only what the batch created. Contacts created by the batch are kept if the
 *  member has since logged other activity for them; pre-existing records are never touched. */
export function undoImport(db: DB, actor: string, batchId: string): [DB, { removedActivities: number; removedContacts: number; keptContacts: number }] {
  const b = db.importBatches.find(x => x.id === batchId)!;
  assert(b.ownerId === actor && b.status === 'confirmed', 'This import cannot be undone.');
  const actIds = new Set(b.createdActivityIds);
  const affected = db.activities.filter(a => actIds.has(a.id)).map(a => a.contactId);
  let d: DB = { ...db, activities: db.activities.filter(a => !actIds.has(a.id)) };
  const kept: string[] = [], removed: string[] = [];
  for (const cid of b.createdContactIds) {
    const other = d.activities.some(a => a.contactId === cid);
    const inApp = d.applications.some(a => a.contactIds.includes(cid));
    (other || inApp ? kept : removed).push(cid);
  }
  const patched = new Map(b.patchedEmails.map(p => [p.contactId, p.email]));
  d = { ...d, contacts: d.contacts.filter(c => !removed.includes(c.id)).map(c => patched.get(c.id) === c.email ? { ...c, email: undefined } : c), tasks: d.tasks.filter(t => !removed.includes(t.contactId)) };
  d = reconcileMany(d, affected.filter(c => !removed.includes(c!)));
  d = { ...d, importBatches: replace(d.importBatches, batchId, x => ({ ...x, status: 'undone', undoneAt: nowISO(), undoKeptContactIds: kept })) };
  return [d, { removedActivities: actIds.size, removedContacts: removed.length, keptContacts: kept.length }];
}

export type { Track };
