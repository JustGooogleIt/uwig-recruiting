import React from 'react';
import { useApp } from '../app/store';
import { Badge, Button, Confirm, Drawer, Empty, Field, Icon, Select, StageBadge, DemoTag } from './kit';
import type { Activity, ActivityType, AppStage } from '../domain/types';
import { ACTIVITY_TYPES, APP_STAGES, CONNECTION_SOURCES, CYCLES, INTERVIEW_TYPES, OPP_TYPES, SENIORITIES, TRACKS } from '../domain/types';
import * as M from '../domain/mutations';
import { appActs, appInterviews, contactActs, firmName, firmOf, followUpCount, ix, openFollowUp, ownerApps, ownerContacts, relStage, upcomingChat } from '../domain/derive';
import { canEditRecords, canViewWorkspace } from '../domain/permissions';
import { addDays, dateKey, fmtDate, fmtDateTime, relDay, timeKey, todayKey } from '../domain/time';
import { allOffices } from './forms';

const SOURCE_LABEL = { manual: 'Manual', screenshot: 'Screenshot import', csv: 'CSV import' } as const;

export function Panels() {
  const { panel, setPanel } = useApp();
  if (!panel) return null;
  const close = () => setPanel(null);
  if (panel.kind === 'contact') return <ContactPanel id={panel.id} onClose={close} />;
  if (panel.kind === 'application') return <ApplicationPanel id={panel.id} onClose={close} />;
  return <FirmPanel id={panel.id} onClose={close} />;
}

function NoAccess({ onClose, what }: { onClose: () => void; what: string }) {
  return <Drawer title="Not available" onClose={onClose}><Empty title={`This ${what} is not available`} icon="shield">It may have been removed, or it belongs to a workspace you cannot view.</Empty></Drawer>;
}

// ---------------- Activity timeline ----------------
export function Timeline({ acts, canEdit }: { acts: Activity[]; canEdit: boolean }) {
  const { db, act, tz, toast } = useApp();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [del, setDel] = React.useState<Activity | null>(null);
  const [draft, setDraft] = React.useState<{ type: ActivityType; date: string; time: string }>({ type: 'outreach', date: '', time: '' });
  if (!acts.length) return <Empty title="No activity logged yet" />;
  return (
    <>
      <ol className="timeline">
        {acts.slice().reverse().map(a => (
          <li key={a.id}>
            <span className={`dot dot-${a.type}`} aria-hidden="true" />
            {editing === a.id ? (
              <div className="tl-edit">
                <select aria-label="Activity type" className="input input-sm" value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as ActivityType })}>
                  {(Object.keys(ACTIVITY_TYPES) as ActivityType[]).filter(t => (a.contactId ? ['outreach', 'follow_up', 'reply', 'chat_scheduled', 'chat_completed'] : ['app_submitted', 'assessment_completed', 'interview_scheduled', 'interview_completed', 'offer', 'app_closed']).includes(t)).map(t => <option key={t} value={t}>{ACTIVITY_TYPES[t]}</option>)}
                </select>
                <input aria-label="Date" type="date" className="input input-sm" value={draft.date} max={todayKey(tz)} onChange={e => setDraft({ ...draft, date: e.target.value })} />
                <input aria-label="Time" type="time" className="input input-sm" value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} />
                <Button size="sm" variant="primary" onClick={() => { if (act((d, x) => M.updateActivity(d, x, a.id, { type: draft.type, date: draft.date, time: draft.time || undefined }))) { setEditing(null); toast({ text: 'Entry corrected. Counts and follow-ups recalculated.' }); } }}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            ) : (
              <div className="tl-row">
                <div>
                  <div className="tl-title">{ACTIVITY_TYPES[a.type]}{a.applicationId && a.contactId === undefined ? null : null}</div>
                  <div className="tl-meta">
                    <time dateTime={a.occurredAt}>{fmtDateTime(a.occurredAt, tz, a.dateOnly)}</time>
                    {a.eventAt && <span> · for {fmtDateTime(a.eventAt, tz)}</span>}
                    {a.source !== 'manual' && <Badge tone="outline">{SOURCE_LABEL[a.source]}</Badge>}
                    {a.applicationId && a.contactId && <span> · {firmName(db, ix(db).app.get(a.applicationId)?.firmId)}</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="tl-actions">
                    <button className="icon-btn" aria-label={`Correct ${ACTIVITY_TYPES[a.type]}`} onClick={() => { setEditing(a.id); setDraft({ type: a.type, date: dateKey(a.occurredAt, tz), time: a.dateOnly ? '' : timeKey(a.occurredAt, tz) }); }}><Icon name="edit" size={14} /></button>
                    <button className="icon-btn" aria-label={`Delete ${ACTIVITY_TYPES[a.type]}`} onClick={() => setDel(a)}><Icon name="trash" size={14} /></button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      {del && <Confirm title="Delete this entry?" danger confirmLabel="Delete entry" onClose={() => setDel(null)}
        body={<p>“{ACTIVITY_TYPES[del.type]}” on {fmtDateTime(del.occurredAt, tz, del.dateOnly)} will be removed. Counts, goals and follow-ups will recalculate.</p>}
        onConfirm={() => { act((d, x) => M.deleteActivity(d, x, del.id)) && toast({ text: 'Entry deleted.' }); }} />}
    </>
  );
}

// ---------------- Follow-up task controls ----------------
export function FollowUpControls({ taskId, compact }: { taskId: string; compact?: boolean }) {
  const { db, act, tz, toast } = useApp();
  const t = db.tasks.find(x => x.id === taskId);
  const [changing, setChanging] = React.useState(false);
  if (!t) return null;
  const today = todayKey(tz);
  return (
    <div className={`task-controls ${compact ? 'compact' : ''}`}>
      {changing ? (
        <input type="date" className="input input-sm" aria-label="New follow-up date" defaultValue={t.dueOn} min={today}
          onChange={e => { if (e.target.value) { act((d, a) => M.setTaskDue(d, a, t.id, e.target.value)); setChanging(false); toast({ text: `Follow-up moved to ${fmtDate(e.target.value)}.` }); } }} />
      ) : <Button size="sm" variant="ghost" onClick={() => setChanging(true)}>Change date</Button>}
      <Button size="sm" variant="ghost" onClick={() => { act((d, a) => M.snoozeTask(d, a, t.id, 3)); toast({ text: 'Snoozed for 3 days.' }); }}>Snooze 3 days</Button>
      <Button size="sm" variant="ghost" icon="check" onClick={() => { act((d, a) => M.completeTask(d, a, t.id)); toast({ text: 'Follow-up marked complete. Log the follow-up email too if you sent one.' }); }}>Done</Button>
      <Button size="sm" variant="ghost" onClick={() => { act((d, a) => M.cancelTask(d, a, t.id)); toast({ text: 'Follow-up cancelled.' }); }}>Cancel</Button>
    </div>
  );
}

// ---------------- Contact ----------------
function ContactPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, personaId, setModal, act, tz, setPanel, toast } = useApp();
  const c = ix(db).contact.get(id);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(c);
  const [delOpen, setDelOpen] = React.useState(false);
  if (!c || !canViewWorkspace(db, personaId, c.ownerId)) return <NoAccess onClose={onClose} what="contact" />;
  const canEdit = canEditRecords(personaId, c.ownerId);
  const acts = contactActs(db, c.id);
  const stage = relStage(db, c);
  const task = openFollowUp(db, c.id);
  const chat = upcomingChat(db, c.id);
  const apps = ownerApps(db, c.ownerId).filter(a => a.contactIds.includes(c.id));
  const hasOutreach = acts.some(a => a.type === 'outreach' || a.type === 'follow_up');
  const today = todayKey(tz);
  const log = (type: ActivityType) => setModal({ kind: 'log', contactId: c.id, type });
  return (
    <Drawer onClose={onClose} eyebrow={<>{firmName(db, c.firmId)}{firmOf(db, c.firmId)?.status === 'pending' && <Badge tone="amber">Firm pending review</Badge>}{!canEdit && <Badge tone="purple">Viewing only</Badge>}</>}
      title={c.name}
      actions={canEdit ? <>
        <Button size="sm" variant="primary" icon="plus" onClick={() => log(hasOutreach ? 'follow_up' : 'outreach')}>{hasOutreach ? 'Log follow-up' : 'Log outreach'}</Button>
        <Button size="sm" onClick={() => log('reply')}>Log reply</Button>
        <Button size="sm" onClick={() => log('chat_scheduled')}>Schedule chat</Button>
        <Button size="sm" onClick={() => log('chat_completed')} disabled={!chat && stage !== 'Chat scheduled'}>Chat completed</Button>
      </> : undefined}>
      <div className="kv-row">
        <StageBadge s={stage} />
        <span className="muted small">{followUpCount(db, c.id)} follow-up{followUpCount(db, c.id) === 1 ? '' : 's'} sent</span>
        {canEdit && <button className="linkish small" onClick={() => act((d, a) => M.updateContact(d, a, c.id, { closed: !c.closed }))}>{c.closed ? 'Reopen contact' : 'Mark closed'}</button>}
      </div>

      <section className="panel-sec">
        <h3>Upcoming</h3>
        {!task && !chat && <p className="muted small">{c.closed ? 'Contact is closed. No reminders.' : 'Nothing scheduled.'}</p>}
        {chat && <div className="up-item"><Icon name="calendar" /><div><strong>Coffee chat</strong> {fmtDateTime(chat.eventAt, tz)} <span className="muted">({relDay(dateKey(chat.eventAt!, tz), today)})</span></div></div>}
        {task && <div className={`up-item ${task.dueOn < today ? 'overdue' : ''}`}>
          <Icon name="clock" />
          <div className="grow">
            <strong>Follow up</strong> {task.dueOn < today ? <Badge tone="red">Overdue</Badge> : null} due {fmtDate(task.dueOn)} <span className="muted">({relDay(task.dueOn, today)})</span>
            <div className="muted small">Suggested {ix(db).member.get(c.ownerId)?.followUpDays} days after your last unanswered outreach.</div>
            {canEdit && <FollowUpControls taskId={task.id} />}
          </div>
        </div>}
      </section>

      <section className="panel-sec">
        <div className="row-between"><h3>Contact information</h3>{canEdit && !editing && <Button size="sm" variant="ghost" icon="edit" onClick={() => { setDraft(c); setEditing(true); }}>Edit</Button>}</div>
        {editing && draft ? (
          <div className="form-grid">
            <Field label="Name" required id="cp-name"><input id="cp-name" className="input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Title" id="cp-title"><input id="cp-title" className="input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="Seniority" id="cp-sen"><Select id="cp-sen" value={draft.seniority ?? ''} onChange={v => setDraft({ ...draft, seniority: v || undefined })} options={SENIORITIES} placeholder="Not set" /></Field>
            <Field label="Email" id="cp-email"><input id="cp-email" type="email" className="input" value={draft.email ?? ''} onChange={e => setDraft({ ...draft, email: e.target.value || undefined })} /></Field>
            <Field label="LinkedIn URL" id="cp-li"><input id="cp-li" className="input" value={draft.linkedin ?? ''} onChange={e => setDraft({ ...draft, linkedin: e.target.value || undefined })} /></Field>
            <Field label="Office" id="cp-off"><Select id="cp-off" value={draft.office ?? ''} onChange={v => setDraft({ ...draft, office: v || undefined })} options={allOffices(db)} placeholder="Not set" /></Field>
            <Field label="Connection source" required id="cp-src"><Select id="cp-src" value={draft.source} onChange={v => setDraft({ ...draft, source: v })} options={CONNECTION_SOURCES} /></Field>
            <div className="span-2 row-end">
              <Button variant="danger" size="sm" onClick={() => setDelOpen(true)}>Delete contact</Button>
              <span className="spacer" />
              <Button size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={() => { const { name, title, seniority, email, linkedin, office, source } = draft; if (act((d, a) => M.updateContact(d, a, c.id, { name, title, seniority, email, linkedin, office, source }))) { setEditing(false); toast({ text: 'Contact updated.' }); } }}>Save</Button>
            </div>
          </div>
        ) : (
          <dl className="kv">
            <div><dt>Title</dt><dd>{c.title || '—'}{c.seniority ? ` · ${c.seniority}` : ''}</dd></div>
            <div><dt>Email</dt><dd>{c.email ? <span className="selectable">{c.email}</span> : <span className="muted">Not added</span>}</dd></div>
            <div><dt>LinkedIn</dt><dd>{c.linkedin ? <a href={c.linkedin} target="_blank" rel="noreferrer">Profile <Icon name="ext" size={12} /></a> : <span className="muted">Not added</span>}</dd></div>
            <div><dt>Office</dt><dd>{c.office ?? '—'}</dd></div>
            <div><dt>Source</dt><dd>{c.source}</dd></div>
            <div><dt>Added</dt><dd>{fmtDateTime(c.createdAt, tz, true)}{c.importBatchId ? ' · from import' : ''}</dd></div>
          </dl>
        )}
      </section>

      <section className="panel-sec">
        <h3>Activity timeline</h3>
        <Timeline acts={acts} canEdit={canEdit} />
      </section>

      <section className="panel-sec">
        <h3>Related applications</h3>
        {apps.length ? <ul className="plain-list">{apps.map(a => <li key={a.id}><button className="linkish" onClick={() => setPanel({ kind: 'application', id: a.id })}>{firmName(db, a.firmId)} · {a.roleTitle}</button> <StageBadge s={a.stage} /></li>)}</ul> : <p className="muted small">None linked. Link contacts from an application.</p>}
      </section>
      {delOpen && <Confirm title={`Delete ${c.name}?`} danger confirmLabel="Delete contact" onClose={() => setDelOpen(false)} body={<p>This removes the contact, their activity timeline and reminders. Application records stay.</p>} onConfirm={() => { if (act((d, a) => M.deleteContact(d, a, c.id))) { onClose(); toast({ text: 'Contact deleted.' }); } }} />}
    </Drawer>
  );
}

// ---------------- Application ----------------
const NEXT_STAGE: Partial<Record<AppStage, AppStage>> = { Considering: 'Applied', Applied: 'Assessment', Assessment: 'First round', 'First round': 'Further rounds', 'Further rounds': 'Final round', 'Final round': 'Offer' };
function ApplicationPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, personaId, act, tz, setPanel, toast, setModal } = useApp();
  const app = ix(db).app.get(id);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(app);
  const [iv, setIv] = React.useState({ round: 'First round', type: 'Behavioral', date: addDays(todayKey(tz), 5), time: '10:00' });
  const [ivOpen, setIvOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  if (!app || !canViewWorkspace(db, personaId, app.ownerId)) return <NoAccess onClose={onClose} what="application" />;
  const canEdit = canEditRecords(personaId, app.ownerId);
  const interviews = appInterviews(db, app.id);
  const acts = appActs(db, app.id);
  const next = NEXT_STAGE[app.stage];
  const today = todayKey(tz);
  const contacts = ownerContacts(db, app.ownerId).filter(c => firmOf(db, c.firmId)?.id === firmOf(db, app.firmId)?.id);
  const setStage = (s: AppStage) => { if (act((d, a) => M.updateApplication(d, a, app.id, { stage: s }))) toast({ text: `Stage changed to ${s}.` }); };
  return (
    <Drawer onClose={onClose} eyebrow={<>{firmName(db, app.firmId)}{!canEdit && <Badge tone="purple">Viewing only</Badge>}</>} title={app.roleTitle}
      actions={canEdit ? <>
        {next && <Button size="sm" variant="primary" onClick={() => setStage(next)}>Advance to {next}</Button>}
        <label className="sr-only" htmlFor="ap-stage">Stage</label>
        <Select id="ap-stage" className="input-sm" value={app.stage} onChange={setStage} options={APP_STAGES} />
        <Button size="sm" icon="calendar" onClick={() => setIvOpen(v => !v)}>Schedule interview</Button>
        <Button size="sm" onClick={() => setModal({ kind: 'log', applicationId: app.id, type: 'assessment_completed' })}>Log activity</Button>
      </> : undefined}>
      <div className="kv-row"><StageBadge s={app.stage} /><span className="muted small">{app.track} · {app.cycle}</span></div>
      {ivOpen && canEdit && (
        <section className="panel-sec boxed">
          <h3>Schedule interview</h3>
          <div className="form-grid">
            <Field label="Round" required id="iv-round"><Select id="iv-round" value={iv.round} onChange={v => setIv({ ...iv, round: v })} options={['Phone screen', 'HireVue / recorded', 'First round', 'Second round', 'Superday / final']} /></Field>
            <Field label="Interview type" required id="iv-type"><Select id="iv-type" value={iv.type} onChange={v => setIv({ ...iv, type: v })} options={INTERVIEW_TYPES} /></Field>
            <Field label="Date" required id="iv-date"><input id="iv-date" type="date" className="input" value={iv.date} onChange={e => setIv({ ...iv, date: e.target.value })} /></Field>
            <Field label="Time" required id="iv-time"><input id="iv-time" type="time" className="input" value={iv.time} onChange={e => setIv({ ...iv, time: e.target.value })} /></Field>
            <div className="span-2 row-end"><Button size="sm" onClick={() => setIvOpen(false)}>Cancel</Button><Button size="sm" variant="primary" onClick={() => { if (act((d, a) => M.scheduleInterview(d, a, app.id, iv.round, iv.type, iv.date, iv.time))) { setIvOpen(false); toast({ text: 'Interview scheduled.' }); } }}>Save interview</Button></div>
          </div>
        </section>
      )}
      <section className="panel-sec">
        <h3>Interviews</h3>
        {interviews.length ? <ul className="plain-list iv-list">{interviews.map(i => (
          <li key={i.id} className="row-between">
            <span><strong>{i.round}</strong> · {i.type} · {fmtDateTime(i.scheduledAt, tz)} <StageBadge s={i.status === 'scheduled' ? (i.scheduledAt < new Date().toISOString() ? 'Overdue' : 'Scheduled') : i.status === 'completed' ? 'Completed' : 'Cancelled'} /></span>
            {canEdit && i.status === 'scheduled' && <span className="row-gap"><Button size="sm" variant="ghost" icon="check" onClick={() => act((d, a) => M.setInterviewStatus(d, a, i.id, 'completed')) && toast({ text: 'Interview marked complete.' })}>Completed</Button><Button size="sm" variant="ghost" onClick={() => act((d, a) => M.setInterviewStatus(d, a, i.id, 'cancelled'))}>Cancel</Button></span>}
          </li>
        ))}</ul> : <p className="muted small">No interviews yet. Each round is stored separately so the history stays intact.</p>}
      </section>
      <section className="panel-sec">
        <div className="row-between"><h3>Details</h3>{canEdit && !editing && <Button size="sm" variant="ghost" icon="edit" onClick={() => { setDraft(app); setEditing(true); }}>Edit</Button>}</div>
        {editing && draft ? (
          <div className="form-grid">
            <Field label="Role title" required id="ap-role"><input id="ap-role" className="input" value={draft.roleTitle} onChange={e => setDraft({ ...draft, roleTitle: e.target.value })} /></Field>
            <Field label="Track" required id="ap-track"><Select id="ap-track" value={draft.track} onChange={v => setDraft({ ...draft, track: v })} options={TRACKS} /></Field>
            <Field label="Cycle" required id="ap-cycle"><Select id="ap-cycle" value={draft.cycle} onChange={v => setDraft({ ...draft, cycle: v })} options={CYCLES} /></Field>
            <Field label="Office" id="ap-off"><Select id="ap-off" value={draft.office ?? ''} onChange={v => setDraft({ ...draft, office: v || undefined })} options={allOffices(db)} placeholder="Not set" /></Field>
            <Field label="Opportunity type" required id="ap-ot"><Select id="ap-ot" value={draft.oppType} onChange={v => setDraft({ ...draft, oppType: v })} options={OPP_TYPES} /></Field>
            <Field label="Application URL" id="ap-url"><input id="ap-url" className="input" value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value || undefined })} /></Field>
            <Field label="Deadline" id="ap-dl"><input id="ap-dl" type="date" className="input" value={draft.deadline ?? ''} onChange={e => setDraft({ ...draft, deadline: e.target.value || undefined })} /></Field>
            <Field label="Date applied" id="ap-ad"><input id="ap-ad" type="date" className="input" value={draft.appliedOn ?? ''} onChange={e => setDraft({ ...draft, appliedOn: e.target.value || undefined })} /></Field>
            <Field label="Next action" id="ap-na"><input id="ap-na" className="input" value={draft.nextAction ?? ''} onChange={e => setDraft({ ...draft, nextAction: e.target.value || undefined })} /></Field>
            <Field label="Next action due" id="ap-nad"><input id="ap-nad" type="date" className="input" value={draft.nextActionDue ?? ''} onChange={e => setDraft({ ...draft, nextActionDue: e.target.value || undefined })} /></Field>
            <div className="span-2 row-end">
              <Button variant="danger" size="sm" onClick={() => setDelOpen(true)}>Delete application</Button><span className="spacer" />
              <Button size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={() => { const { roleTitle, track, cycle, office, oppType, url, deadline, appliedOn, nextAction, nextActionDue } = draft; if (act((d, a) => M.updateApplication(d, a, app.id, { roleTitle, track, cycle, office, oppType, url, deadline, appliedOn, nextAction, nextActionDue }))) { setEditing(false); toast({ text: 'Application updated.' }); } }}>Save</Button>
            </div>
          </div>
        ) : (
          <dl className="kv">
            <div><dt>Office</dt><dd>{app.office ?? '—'}</dd></div>
            <div><dt>Type</dt><dd>{app.oppType}</dd></div>
            <div><dt>Deadline</dt><dd>{app.deadline ? <>{fmtDate(app.deadline, { year: true })} {app.stage === 'Considering' && app.deadline >= today && <span className="muted">({relDay(app.deadline, today)})</span>}</> : <span className="muted">Not known</span>}</dd></div>
            <div><dt>Applied</dt><dd>{app.appliedOn ? fmtDate(app.appliedOn, { year: true }) : '—'}</dd></div>
            <div><dt>Next action</dt><dd>{app.nextAction ? <>{app.nextAction}{app.nextActionDue && <> · due {fmtDate(app.nextActionDue)}</>}</> : '—'}</dd></div>
            <div><dt>Link</dt><dd>{app.url ? <a href={app.url} target="_blank" rel="noreferrer">Application page <Icon name="ext" size={12} /></a> : '—'}</dd></div>
          </dl>
        )}
      </section>
      <section className="panel-sec">
        <h3>Related contacts</h3>
        {contacts.length ? <div className="chips">{contacts.map(c => {
          const on = app.contactIds.includes(c.id);
          return canEdit ? <button key={c.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => act((d, a) => M.updateApplication(d, a, app.id, { contactIds: on ? app.contactIds.filter(x => x !== c.id) : [...app.contactIds, c.id] }))}>{on && <Icon name="check" size={12} />}{c.name}</button>
            : on ? <button key={c.id} className="chip on" onClick={() => setPanel({ kind: 'contact', id: c.id })}>{c.name}</button> : null;
        })}</div> : <p className="muted small">No contacts at this firm yet.</p>}
      </section>
      <section className="panel-sec">
        <h3>History</h3>
        <Timeline acts={acts} canEdit={canEdit} />
      </section>
      {delOpen && <Confirm title="Delete this application?" danger confirmLabel="Delete application" onClose={() => setDelOpen(false)} body={<p>This removes the application, its interviews and its history.</p>} onConfirm={() => { if (act((d, a) => M.deleteApplication(d, a, app.id))) { onClose(); toast({ text: 'Application deleted.' }); } }} />}
    </Drawer>
  );
}

// ---------------- Firm ----------------
function FirmPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, personaId, setModal, tz, go } = useApp();
  const f = firmOf(db, id);
  if (!f) return <NoAccess onClose={onClose} what="firm" />;
  const news = db.announcements.filter(a => !a.archived && firmOf(db, a.firmId)?.id === f.id);
  const myTargets = db.targets.filter(t => t.ownerId === personaId && firmOf(db, t.firmId)?.id === f.id && t.state === 'active');
  const myContacts = ownerContacts(db, personaId).filter(c => firmOf(db, c.firmId)?.id === f.id).length;
  return (
    <Drawer onClose={onClose} eyebrow={<>{f.type}{f.status === 'pending' && <Badge tone="amber">Pending exec review</Badge>}</>} title={f.name}
      actions={<>
        <Button size="sm" variant="primary" icon="target" onClick={() => setModal({ kind: 'addTarget', firmId: f.id })}>{myTargets.length ? 'Add another target' : 'Add to my targets'}</Button>
        <Button size="sm" icon="user" onClick={() => setModal({ kind: 'addContact', firmId: f.id })}>Add contact here</Button>
        <Button size="sm" onClick={() => setModal({ kind: 'addApplication', firmId: f.id })}>Add application</Button>
      </>}>
      {myTargets.length > 0 && <p className="callout ok"><Icon name="check" /><span>In your targets: {myTargets.map(t => `${t.track} (${t.cycle})`).join('; ')}.</span></p>}
      <section className="panel-sec">
        <dl className="kv">
          <div><dt>Recruiting tracks</dt><dd>{f.tracks.join(', ') || '—'}</dd></div>
          <div><dt>Known offices</dt><dd>{f.offices.join(', ') || '—'}</dd></div>
          <div><dt>Website</dt><dd>{f.website ? <a href={f.website} target="_blank" rel="noreferrer">{f.website.replace(/^https?:\/\/(www\.)?/, '')} <Icon name="ext" size={12} /></a> : '—'}</dd></div>
          <div><dt>Careers page</dt><dd>{f.careersUrl ? <a href={f.careersUrl} target="_blank" rel="noreferrer">Careers <Icon name="ext" size={12} /></a> : '—'}</dd></div>
          <div><dt>Last verified</dt><dd>{f.lastVerified ? fmtDate(f.lastVerified, { year: true }) : 'Not yet verified'}</dd></div>
          <div><dt>Also known as</dt><dd>{f.aliases.join(', ') || '—'}</dd></div>
          {f.source && <div><dt>Added from</dt><dd>{f.source}</dd></div>}
        </dl>
        <p className="muted small">Your workspace: {myContacts} contact{myContacts === 1 ? '' : 's'} here. Other members’ contacts are never shown in the directory.</p>
      </section>
      <section className="panel-sec">
        <h3>Club announcements</h3>
        {news.length ? <ul className="plain-list">{news.map(n => <li key={n.id}><button className="linkish" onClick={() => { onClose(); go('board'); }}>{n.title}</button> <span className="muted small">· {fmtDate(n.createdAt.slice(0, 10))}</span></li>)}</ul>
          : <p className="muted small">No exec announcements mention this firm. Check the firm’s careers page for openings.</p>}
      </section>
    </Drawer>
  );
}
export { SOURCE_LABEL };
