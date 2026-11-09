import React from 'react';
import { useApp } from '../app/store';
import { Badge, Button, Empty, Icon, PageHead, Progress, Section, StageBadge } from '../ui/kit';
import { ACTIVE_APP_STAGES, ACTIVITY_TYPES, GOAL_TYPES } from '../domain/types';
import type { DB, Goal } from '../domain/types';
import { firmName, goalProgress, ix, lastNDays, ownerActs, ownerApps, ownerContacts, ownerTasks, periodTotals, thisWeek, upcomingChat } from '../domain/derive';
import { dateKey, fmtDate, fmtDateTime, fmtWeekday, relDay, todayKey, tzLabel } from '../domain/time';
import * as M from '../domain/mutations';
import { CohortCard } from './analytics';
import { AnnouncementCard } from './board';

export function Overview() {
  const { db, me, go, setModal, setPanel, act, tz, toast } = useApp();
  const today = todayKey(tz);
  const wk = thisWeek(tz);
  const totals = periodTotals(db, [me.id], wk, tz);
  const activeApps = ownerApps(db, me.id).filter(a => ACTIVE_APP_STAGES.includes(a.stage)).length;
  const tasks = ownerTasks(db, me.id).filter(t => t.status === 'open').sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const overdue = tasks.filter(t => t.dueOn < today);
  const soon = tasks.filter(t => t.dueOn >= today && t.dueOn <= addD(today, 7));
  const now = new Date().toISOString();
  const chats = ownerContacts(db, me.id).map(c => ({ c, a: upcomingChat(db, c.id) })).filter(x => x.a?.eventAt && x.a.eventAt >= addHours(now, -2)).sort((x, y) => x.a!.eventAt!.localeCompare(y.a!.eventAt!));
  const ivs = db.interviews.filter(i => i.ownerId === me.id && i.status === 'scheduled' && i.scheduledAt >= addHours(now, -2)).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const events = [
    ...chats.map(x => ({ id: x.c.id, at: x.a!.eventAt!, kind: 'Coffee chat', title: x.c.name, sub: firmName(db, x.c.firmId), open: () => setPanel({ kind: 'contact', id: x.c.id }) })),
    ...ivs.map(i => { const app = ix(db).app.get(i.applicationId)!; return { id: i.id, at: i.scheduledAt, kind: `${i.round} interview`, title: firmName(db, app.firmId), sub: `${i.type} · ${app.roleTitle}`, open: () => setPanel({ kind: 'application', id: app.id }) }; }),
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 6);
  const deadlines = ownerApps(db, me.id).flatMap(a => {
    const out: { id: string; due: string; label: string; app: typeof a }[] = [];
    if (a.stage === 'Considering' && a.deadline && a.deadline >= today) out.push({ id: a.id + 'd', due: a.deadline, label: 'Application deadline', app: a });
    if (a.nextAction && a.nextActionDue && !['Offer', 'Rejected', 'Withdrawn'].includes(a.stage)) out.push({ id: a.id + 'n', due: a.nextActionDue, label: a.nextAction, app: a });
    return out;
  }).filter(x => x.due <= addD(today, 21)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);
  const goals = db.goals.filter(g => g.analystId === me.id && !g.cancelled && g.dueOn >= addD(today, -7)).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const news = db.announcements.filter(a => !a.archived && (!a.deadline || a.deadline >= today)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)).slice(0, 2);
  const recent = ownerActs(db, me.id).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  const metric = (label: string, value: number, onClick: () => void, hint: string) => (
    <button className="metric" onClick={onClick}><span className="metric-v">{value}</span><span className="metric-l">{label}</span><span className="metric-h">{hint}</span></button>
  );
  return (
    <div className="page">
      <PageHead title="Overview" sub={<>{fmtWeekday(today)} · times in {tzLabel(tz)}</>}
        actions={<>
          <Button variant="primary" icon="plus" onClick={() => setModal({ kind: 'log' })}>Log activity</Button>
          <Button icon="upload" onClick={() => go('import')}>Upload screenshots</Button>
          <Button icon="user" onClick={() => setModal({ kind: 'addContact' })}>Add contact</Button>
          <Button icon="file" onClick={() => setModal({ kind: 'addApplication' })}>Add application</Button>
        </>} />

      <div className="overview-grid">
        <div className="col-main">
          <Section title={<>Follow-ups {overdue.length > 0 && <Badge tone="red">{overdue.length} overdue</Badge>}</>} id="ov-fu" aside={<button className="linkish small" onClick={() => go('recruiting', { tab: 'contacts' })}>All contacts</button>}>
            {overdue.length + soon.length === 0 ? <Empty title="No follow-ups due this week" icon="check">Follow-ups are suggested {me.followUpDays} days after outreach that hasn’t received a logged reply.</Empty> : (
              <ul className="action-list">
                {[...overdue, ...soon].slice(0, 8).map(t => {
                  const c = ix(db).contact.get(t.contactId)!;
                  return (
                    <li key={t.id} className={t.dueOn < today ? 'overdue' : ''}>
                      <button className="al-main" onClick={() => setPanel({ kind: 'contact', id: c.id })}>
                        <span className="al-title">{c.name}</span>
                        <span className="al-sub">{firmName(db, c.firmId)}</span>
                      </button>
                      <span className={`al-due ${t.dueOn < today ? 'is-overdue' : ''}`}>{t.dueOn < today ? <><Icon name="alert" size={13} /> {relDay(t.dueOn, today).replace(' ago', ' overdue')}</> : relDay(t.dueOn, today)}</span>
                      <span className="al-actions">
                        <Button size="sm" onClick={() => setModal({ kind: 'log', contactId: c.id, type: 'follow_up' })}>Log follow-up</Button>
                        <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'log', contactId: c.id, type: 'reply' })}>Got reply</Button>
                        <Button size="sm" variant="ghost" onClick={() => { act((d, a) => M.snoozeTask(d, a, t.id, 3)); toast({ text: `Snoozed ${c.name} for 3 days.` }); }}>Snooze</Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Upcoming chats and interviews" id="ov-ev">
            {events.length === 0 ? <Empty title="Nothing scheduled" icon="calendar">Log “Coffee chat scheduled” on a contact, or schedule an interview on an application.</Empty> : (
              <ul className="event-list">
                {events.map(e => (
                  <li key={e.id}><button onClick={e.open}>
                    <span className="ev-date"><span>{fmtDate(dateKey(e.at, tz))}</span><small>{new Date(e.at).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })}</small></span>
                    <span className="ev-body"><span className="ev-kind">{e.kind}</span><strong>{e.title}</strong><span className="muted small">{e.sub}</span></span>
                    <span className="ev-rel">{relDay(dateKey(e.at, tz), today)}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Deadlines and next steps" id="ov-dl" aside={<span className="muted small">Next 3 weeks</span>}>
            {deadlines.length === 0 ? <Empty title="No deadlines in the next three weeks" icon="flag">Deadlines you add to applications appear here. Unknown deadlines are left blank.</Empty> : (
              <ul className="action-list compact">
                {deadlines.map(x => (
                  <li key={x.id} className={x.due < today ? 'overdue' : ''}>
                    <button className="al-main" onClick={() => setPanel({ kind: 'application', id: x.app.id })}>
                      <span className="al-title">{x.label}</span>
                      <span className="al-sub">{firmName(db, x.app.firmId)} · {x.app.roleTitle}</span>
                    </button>
                    <span className={`al-due ${x.due < today ? 'is-overdue' : ''}`}>{relDay(x.due, today) === fmtDate(x.due) ? fmtDate(x.due) : `${fmtDate(x.due)} · ${relDay(x.due, today)}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="col-side">
          {news.length > 0 && <Section title="Latest announcements" id="ov-ann" aside={<button className="linkish small" onClick={() => go('board')}>All announcements</button>}>
            <ul className="ann-list">{news.map(a => <AnnouncementCard key={a.id} a={a} compact />)}</ul>
          </Section>}
          <div className="metrics" aria-label="This week">
            {metric('New contacts reached', totals.newContacts, () => go('recruiting', { tab: 'contacts' }), 'This week')}
            {metric('Follow-ups sent', totals.followUps, () => go('recruiting', { tab: 'contacts' }), 'This week')}
            {metric('Coffee chats completed', totals.chats, () => go('recruiting', { tab: 'contacts' }), 'This week')}
            {metric('Active applications', activeApps, () => go('recruiting', { tab: 'applications' }), 'Applied through final round')}
          </div>
          <Section title="Goals" id="ov-goals" aside={<span className="muted small">Set with your mentor</span>}>
            <GoalList goals={goals} db={db} canComplete />
          </Section>
          <CohortCard ownerIds={[me.id]} period={lastNDays(tz, 30)} title="Your outreach, last 30 days" />
          <Section title="Recent activity" id="ov-recent">
            {recent.length === 0 ? <Empty title="No activity logged yet" action={<Button size="sm" variant="primary" onClick={() => setModal({ kind: 'log' })}>Log your first activity</Button>} /> : (
              <ul className="recent-list">
                {recent.map(a => {
                  const c = a.contactId ? ix(db).contact.get(a.contactId) : undefined;
                  const app = a.applicationId ? ix(db).app.get(a.applicationId) : undefined;
                  return <li key={a.id}><button onClick={() => c ? setPanel({ kind: 'contact', id: c.id }) : app && setPanel({ kind: 'application', id: app.id })}>
                    <span>{ACTIVITY_TYPES[a.type]}</span><span className="muted">{c ? c.name : app ? firmName(db, app.firmId) : ''}</span><time className="muted small">{fmtDateTime(a.occurredAt, tz, true)}</time>
                  </button></li>;
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

export function GoalList({ goals, db, canComplete, onEdit }: { goals: Goal[]; db: DB; canComplete?: boolean; onEdit?: (g: Goal) => void }) {
  const { act, tz, personaId, toast } = useApp();
  if (!goals.length) return <Empty title="No goals set" icon="target">Mentors set goals with analysts during weekly meetings.</Empty>;
  return (
    <ul className="goal-list">
      {goals.map(g => {
        const p = goalProgress(db, g, tz);
        const label = g.type === 'prep_task' ? g.label : `${GOAL_TYPES[g.type]}: ${g.target}`;
        return (
          <li key={g.id}>
            <div className="row-between">
              <span className="goal-label">{label}</span>
              <StageBadge s={p.status} />
            </div>
            {g.type !== 'prep_task' ? <Progress value={p.progress} max={p.target} label={label ?? ''} /> : null}
            <div className="row-between small muted">
              <span>{g.type === 'prep_task' ? (p.status === 'Completed' ? 'Marked complete' : 'Mark complete when done') : `${p.progress} of ${p.target}`} · due {fmtDate(g.dueOn)}</span>
              <span className="row-gap">
                {g.type === 'prep_task' && canComplete && (g.analystId === personaId || onEdit) && <button className="linkish" onClick={() => { act((d, a) => M.setPrepComplete(d, a, g.id, !g.completedAt)); toast({ text: g.completedAt ? 'Marked not complete.' : 'Preparation task completed.' }); }}>{g.completedAt ? 'Undo complete' : 'Mark complete'}</button>}
                {onEdit && <button className="linkish" onClick={() => onEdit(g)}>Edit</button>}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function addD(d: string, n: number) { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function addHours(iso: string, h: number) { return new Date(new Date(iso).getTime() + h * 3600000).toISOString(); }
