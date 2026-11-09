import React from 'react';
import { useApp } from '../app/store';
import { Badge, Button, Col, DataTable, Empty, Icon, PageHead, SearchInput, Section, Select, StageBadge } from '../ui/kit';
import type { Member, Track } from '../domain/types';
import { TRACKS } from '../domain/types';
import type { Period } from '../domain/derive';
import { daysSince, firmName, goalProgress, groupAnalysts, groupOf, ix, lastLogged, lastNDays, memberName, mentorAnalysts, nextInterviewFor, overdueFollowUps, periodTotals, thisWeek } from '../domain/derive';
import { canManageGoals } from '../domain/permissions';
import { addDays, dateKey, fmtDate, fmtDateTime, relDay, todayKey } from '../domain/time';
import { AnalyticsBlock } from './analytics';
import { GoalList } from './overview';
import { RecruitingTables } from './recruiting';
import { CohortCard } from './analytics';

function usePeriod(): [string, (v: string) => void, Period, React.ReactNode] {
  const { tz } = useApp();
  const [p, setP] = React.useState('week');
  const [start, setStart] = React.useState(addDays(todayKey(tz), -13));
  const [end, setEnd] = React.useState(todayKey(tz));
  const period: Period = p === 'week' ? thisWeek(tz) : p === '14' ? lastNDays(tz, 14) : p === '30' ? lastNDays(tz, 30) : { start, end: end < start ? start : end, label: 'Custom range' };
  const ui = (
    <span className="row-gap wrap">
      <Select ariaLabel="Date range" value={p} onChange={setP} options={[{ value: 'week', label: 'This week' }, { value: '14', label: 'Last 14 days' }, { value: '30', label: 'Last 30 days' }, { value: 'custom', label: 'Custom range' }]} />
      {p === 'custom' && <><input aria-label="Start date" type="date" className="input input-sm" value={start} onChange={e => setStart(e.target.value)} /><input aria-label="End date" type="date" className="input input-sm" value={end} onChange={e => setEnd(e.target.value)} /></>}
    </span>
  );
  return [p, setP, period, ui];
}

export function Roster({ analysts, period, showGroup }: { analysts: Member[]; period: Period; showGroup?: boolean }) {
  const { db, go, setModal, personaId, tz } = useApp();
  const today = todayKey(tz);
  const rows = analysts.map(a => {
    const t = periodTotals(db, [a.id], period, tz);
    const goals = db.goals.filter(g => g.analystId === a.id && !g.cancelled && g.startOn <= today && g.dueOn >= addDays(today, -7)).map(g => ({ g, p: goalProgress(db, g, tz) }));
    return { id: a.id, a, t, goals, overdue: overdueFollowUps(db, a.id, tz).length, iv: nextInterviewFor(db, a.id), last: lastLogged(db, a.id) };
  });
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { key: 'name', header: 'Analyst', mobile: 'title', sort: r => r.a.name, render: r => <span className="cell-stack"><span className="cell-strong">{r.a.name}</span>{showGroup && <span className="muted small">{groupOf(db, r.a.id)?.name ?? 'Unassigned'}</span>}</span> },
    { key: 'tracks', header: 'Target tracks', mobile: 'sub', render: r => <span className="small">{r.a.tracks.join(', ') || '—'}</span> },
    { key: 'goals', header: 'Current goals', mobile: 'meta', sort: r => r.goals.filter(x => x.p.status === 'Completed').length / (r.goals.length || 1), render: r => r.goals.length ? (
      <ul className="mini-goals">{r.goals.slice(0, 3).map(({ g, p }) => <li key={g.id} title={g.label}><span className={`mg-dot s-${p.status.replace(/\s/g, '')}`} aria-hidden="true" /><span>{g.type === 'prep_task' ? 'Prep task' : `${p.progress}/${p.target} ${shortGoal(g.type)}`}</span><span className="sr-only">{p.status}</span></li>)}</ul>
    ) : <span className="muted small">None set</span> },
    { key: 'out', header: 'New outreach', className: 'num', mobile: 'meta', sort: r => r.t.newContacts, render: r => r.t.newContacts },
    { key: 'chats', header: 'Chats done', className: 'num', mobile: 'meta', sort: r => r.t.chats, render: r => r.t.chats },
    { key: 'od', header: 'Overdue follow-ups', className: 'num', mobile: 'meta', sort: r => r.overdue, render: r => r.overdue ? <span className="text-danger">{r.overdue}</span> : <span className="muted">0</span> },
    { key: 'iv', header: 'Next interview', mobile: 'meta', sort: r => r.iv?.scheduledAt ?? 'z', render: r => r.iv ? <span className="cell-stack"><span>{fmtDate(dateKey(r.iv.scheduledAt, tz))}</span><span className="muted small">{firmName(db, ix(db).app.get(r.iv.applicationId)?.firmId)}</span></span> : <span className="muted">—</span> },
    { key: 'last', header: 'Last logged', mobile: 'meta', sort: r => r.last?.createdAt ?? '', render: r => r.last ? <span className={daysSince(r.last.createdAt, tz) > 14 ? 'text-warn' : ''}>{relDay(dateKey(r.last.createdAt, tz), today)}</span> : <span className="text-warn">No activity logged</span> },
    { key: 'act', header: '', mobile: 'hide', render: r => canManageGoals(db, personaId, r.a.id) ? <Button size="sm" variant="ghost" icon="target" onClick={() => setModal({ kind: 'goal', analystId: r.a.id })}>Set goal</Button> : null },
  ];
  return <DataTable label="Analyst roster" rows={rows} cols={cols} initialSort={{ key: 'name', dir: 1 }} onOpen={r => go('workspace', { analystId: r.a.id })} rowLabel={r => `Open ${r.a.name}'s workspace`}
    empty={<Empty title="No analysts" icon="users">No analysts match. Exec assigns analysts to groups in Administration.</Empty>} />;
}
function shortGoal(t: string) { return ({ new_contacts: 'contacts', follow_ups: 'follow-ups', chats_completed: 'chats', applications_submitted: 'apps', mock_completed: 'mocks' } as Record<string, string>)[t] ?? ''; }

export function MyGroupPage() {
  const { db, me } = useApp();
  const [, , period, periodUI] = usePeriod();
  const groups = db.groups.filter(g => g.mentorId === me.id);
  const analysts = mentorAnalysts(db, me.id);
  return (
    <div className="page">
      <PageHead title="My Group" sub={<>{groups.map(g => g.name).join(', ') || 'No group assigned'} · {analysts.length} analysts. You can view their records and manage their goals. Analysts manage their own records.</>} actions={periodUI} />
      <Section title="Roster" id="mg-roster" aside={<span className="muted small">Select an analyst to open their workspace</span>}>
        <Roster analysts={analysts} period={period} />
      </Section>
      {analysts.length > 0 && <AnalyticsBlock ownerIds={analysts.map(a => a.id)} period={period} scopeLabel="Your group" />}
    </div>
  );
}

export function AllGroupsPage() {
  const { db, go, tz } = useApp();
  const [, , period, periodUI] = usePeriod();
  const [groupId, setGroupId] = React.useState('');
  const [track, setTrack] = React.useState('');
  const [q, setQ] = React.useState('');
  const today = todayKey(tz);
  const allAnalysts = db.members.filter(m => m.role === 'analyst' && m.active);
  const analysts = allAnalysts.filter(a => (!groupId || groupOf(db, a.id)?.id === groupId) && (!track || a.tracks.includes(track as Track)) && (!q || a.name.toLowerCase().includes(q.toLowerCase())));
  const ids = analysts.map(a => a.id);
  const groupRows = db.groups.filter(g => !groupId || g.id === groupId).map(g => {
    const members = groupAnalysts(db, g.id).filter(a => analysts.includes(a));
    const t = periodTotals(db, members.map(m => m.id), period, tz);
    const goals = db.goals.filter(x => members.some(m => m.id === x.analystId) && !x.cancelled && x.dueOn >= period.start && x.dueOn <= period.end);
    const met = goals.filter(x => goalProgress(db, x, tz).completedOnTime).length;
    return { id: g.id, g, n: members.length, t, goals: goals.length, met };
  });
  type GR = (typeof groupRows)[number];
  const gcols: Col<GR>[] = [
    { key: 'g', header: 'Group', mobile: 'title', sort: r => r.g.name, render: r => <span className="cell-strong">{r.g.name}</span> },
    { key: 'm', header: 'Mentor', mobile: 'sub', sort: r => memberName(db, r.g.mentorId), render: r => memberName(db, r.g.mentorId) },
    { key: 'n', header: 'Analysts', className: 'num', mobile: 'meta', sort: r => r.n, render: r => r.n },
    { key: 'o', header: 'New outreach', className: 'num', mobile: 'meta', sort: r => r.t.newContacts, render: r => r.t.newContacts },
    { key: 'f', header: 'Follow-ups', className: 'num', mobile: 'meta', sort: r => r.t.followUps, render: r => r.t.followUps },
    { key: 'c', header: 'Chats done', className: 'num', mobile: 'meta', sort: r => r.t.chats, render: r => r.t.chats },
    { key: 'gc', header: 'Goals met on time', mobile: 'meta', sort: r => (r.goals ? r.met / r.goals : -1), render: r => r.goals ? `${Math.round((r.met / r.goals) * 100)}% (${r.met} of ${r.goals})` : <span className="muted">No data</span> },
  ];
  const overdueGoals = db.goals.filter(g => ids.includes(g.analystId) && !g.cancelled && goalProgress(db, g, tz).status === 'Overdue' && g.dueOn >= addDays(today, -21));
  const upcoming = db.interviews.filter(i => ids.includes(i.ownerId) && i.status === 'scheduled' && i.scheduledAt >= new Date().toISOString() && dateKey(i.scheduledAt, tz) <= addDays(today, 14)).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const quiet = analysts.filter(a => daysSince(lastLogged(db, a.id)?.createdAt, tz) > 14);
  return (
    <div className="page">
      <PageHead title="All Groups" sub={`${db.groups.length} mentor groups · ${allAnalysts.length} analysts. Counts use confirmed, logged records only.`} actions={periodUI} />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search analysts" id="ag-q" />
        <Select ariaLabel="Filter by group" value={groupId} onChange={setGroupId} options={db.groups.map(g => ({ value: g.id, label: `${g.name} (${memberName(db, g.mentorId)})` }))} placeholder="All groups" />
        <Select ariaLabel="Filter by track" value={track} onChange={setTrack} options={TRACKS} placeholder="All tracks" />
      </div>
      <Section title="Groups" id="ag-groups"><DataTable label="Groups" rows={groupRows} cols={gcols} initialSort={{ key: 'g', dir: 1 }} empty={<Empty title="No groups" />} /></Section>
      <div className="watch-grid">
        <Section title={<>Overdue goals <Badge tone="red">{overdueGoals.length}</Badge></>} id="ag-od">
          {overdueGoals.length ? <ul className="watch-list">{overdueGoals.slice(0, 8).map(g => { const p = goalProgress(db, g, tz); return <li key={g.id}><button onClick={() => go('workspace', { analystId: g.analystId })}><strong>{memberName(db, g.analystId)}</strong><span className="muted small">{g.type === 'prep_task' ? g.label : `${p.progress}/${p.target} · ${shortGoal(g.type) || 'goal'}`} · due {fmtDate(g.dueOn)}</span></button></li>; })}</ul> : <p className="muted small">No overdue goals in the last three weeks.</p>}
        </Section>
        <Section title={<>Upcoming interviews <Badge tone="purple">{upcoming.length}</Badge></>} id="ag-iv" aside={<span className="muted small">Next 14 days</span>}>
          {upcoming.length ? <ul className="watch-list">{upcoming.slice(0, 8).map(i => <li key={i.id}><button onClick={() => go('workspace', { analystId: i.ownerId })}><strong>{memberName(db, i.ownerId)}</strong><span className="muted small">{firmName(db, ix(db).app.get(i.applicationId)?.firmId)} · {i.round} · {fmtDateTime(i.scheduledAt, tz)}</span></button></li>)}</ul> : <p className="muted small">No interviews scheduled.</p>}
        </Section>
        <Section title={<>No activity logged in 14 days <Badge tone="amber">{quiet.length}</Badge></>} id="ag-quiet">
          {quiet.length ? <ul className="watch-list">{quiet.slice(0, 8).map(a => { const l = lastLogged(db, a.id); return <li key={a.id}><button onClick={() => go('workspace', { analystId: a.id })}><strong>{a.name}</strong><span className="muted small">{l ? `Last logged ${fmtDate(dateKey(l.createdAt, tz))}` : 'No activity logged'} · {groupOf(db, a.id)?.name}</span></button></li>; })}{quiet.length > 8 && <li className="muted small">and {quiet.length - 8} more in the roster below</li>}</ul> : <p className="muted small">Everyone has logged activity recently.</p>}
          <p className="muted small">This shows logging, not effort. Some members may recruit without logging.</p>
        </Section>
      </div>
      <Section title={`Analysts (${analysts.length})`} id="ag-roster"><Roster analysts={analysts} period={period} showGroup /></Section>
      <AnalyticsBlock ownerIds={ids} period={period} scopeLabel={groupId || track || q ? 'Filtered analysts' : 'All analysts'} />
    </div>
  );
}

export function WorkspacePage() {
  const { db, viewingId, go, personaId, setModal, tz, me } = useApp();
  const [tab, setTab] = React.useState<'targets' | 'contacts' | 'applications'>('contacts');
  const a = viewingId ? ix(db).member.get(viewingId) : undefined;
  const allowed = a && (me.role === 'exec' || mentorAnalysts(db, personaId).some(x => x.id === a.id));
  if (!a || !allowed) return <div className="page"><Empty title="You can’t view this workspace" icon="shield">Mentors can view their assigned analysts. Exec can view all analysts.</Empty></div>;
  const goals = db.goals.filter(g => g.analystId === a.id && !g.cancelled).sort((x, y) => y.dueOn.localeCompare(x.dueOn)).slice(0, 8);
  const t = periodTotals(db, [a.id], thisWeek(tz), tz);
  return (
    <div className="page">
      <div className="viewing-banner" role="note">
        <Icon name="eye" />
        <span><strong>Viewing {a.name}’s workspace.</strong> Read-only. {a.name.split(' ')[0]} manages their own records; you can set and edit goals.</span>
        <Button size="sm" onClick={() => go(me.role === 'exec' ? 'groups' : 'group')}>Back to {me.role === 'exec' ? 'All Groups' : 'My Group'}</Button>
      </div>
      <PageHead title={a.name} eyebrow={`${groupOf(db, a.id)?.name ?? 'Unassigned'} · Mentor: ${memberName(db, groupOf(db, a.id)?.mentorId)}`} sub={`${a.tracks.join(', ')} · Class of ${a.classYear}`}
        actions={canManageGoals(db, personaId, a.id) && <Button variant="primary" icon="target" onClick={() => setModal({ kind: 'goal', analystId: a.id })}>Set goal</Button>} />
      <div className="overview-grid">
        <div className="col-main">
          <RecruitingTables ownerId={a.id} tab={tab} setTab={setTab} readOnly />
        </div>
        <div className="col-side">
          <div className="metrics">
            <div className="metric static"><span className="metric-v">{t.newContacts}</span><span className="metric-l">New contacts reached</span><span className="metric-h">This week</span></div>
            <div className="metric static"><span className="metric-v">{t.followUps}</span><span className="metric-l">Follow-ups sent</span><span className="metric-h">This week</span></div>
            <div className="metric static"><span className="metric-v">{t.chats}</span><span className="metric-l">Chats completed</span><span className="metric-h">This week</span></div>
            <div className="metric static"><span className="metric-v">{overdueFollowUps(db, a.id, tz).length}</span><span className="metric-l">Overdue follow-ups</span><span className="metric-h">Now</span></div>
          </div>
          <Section title="Goals" id="ws-goals"><GoalList goals={goals} db={db} canComplete onEdit={canManageGoals(db, personaId, a.id) ? g => setModal({ kind: 'goal', analystId: a.id, goalId: g.id }) : undefined} /></Section>
          <CohortCard ownerIds={[a.id]} period={lastNDays(tz, 30)} title="Outreach, last 30 days" />
        </div>
      </div>
    </div>
  );
}
