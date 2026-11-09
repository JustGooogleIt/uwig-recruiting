import React from 'react';
import { useApp } from '../app/store';
import { Badge, Button, Col, DataTable, Empty, Icon, PageHead, SearchInput, Select, StageBadge, Tabs } from '../ui/kit';
import type { Application, AppStage, Contact, Priority, Target } from '../domain/types';
import { ACTIVE_APP_STAGES, ACTIVITY_TYPES, APP_STAGES, CONNECTION_SOURCES, CYCLES, REL_STAGES, TRACKS } from '../domain/types';
import { firmName, firmOf, followUpCount, lastActivity, nextInterview, openFollowUp, ownerApps, ownerContacts, relStage, targetStats } from '../domain/derive';
import { fmtDate, fmtDateTime, relDay, todayKey } from '../domain/time';
import * as M from '../domain/mutations';

type TabId = 'targets' | 'contacts' | 'applications';

export function RecruitingPage() {
  const { me, tab, setTab, setModal, go } = useApp();
  return (
    <div className="page">
      <PageHead title="My Recruiting" sub="Your targets, contacts and applications. Only you, your mentor and exec can see these."
        actions={<>
          <Button variant="primary" icon="plus" onClick={() => setModal({ kind: 'log' })}>Log activity</Button>
          <Button icon="upload" onClick={() => go('import')}>Import</Button>
        </>} />
      <RecruitingTables ownerId={me.id} tab={(tab as TabId) ?? 'contacts'} setTab={t => setTab(t)} />
    </div>
  );
}

export function RecruitingTables({ ownerId, tab, setTab, readOnly }: { ownerId: string; tab: TabId; setTab: (t: TabId) => void; readOnly?: boolean }) {
  const { db } = useApp();
  const counts = {
    targets: db.targets.filter(t => t.ownerId === ownerId && t.state === 'active').length,
    contacts: ownerContacts(db, ownerId).length,
    applications: ownerApps(db, ownerId).length,
  };
  return (
    <>
      <Tabs label="Recruiting records" value={tab} onChange={setTab} tabs={[
        { id: 'targets', label: 'Targets', count: counts.targets },
        { id: 'contacts', label: 'Contacts', count: counts.contacts },
        { id: 'applications', label: 'Applications', count: counts.applications },
      ]} />
      <div role="tabpanel" aria-labelledby={`tab-${tab}`} className="tabpanel">
        {tab === 'targets' && <TargetsTab ownerId={ownerId} readOnly={readOnly} />}
        {tab === 'contacts' && <ContactsTab ownerId={ownerId} readOnly={readOnly} />}
        {tab === 'applications' && <ApplicationsTab ownerId={ownerId} readOnly={readOnly} />}
      </div>
    </>
  );
}

function Views<T extends string>({ value, onChange, views }: { value: T; onChange: (v: T) => void; views: { id: T; label: string; n: number }[] }) {
  return (
    <div className="views" role="group" aria-label="Saved views">
      {views.map(v => <button key={v.id} className={`view ${value === v.id ? 'on' : ''}`} aria-pressed={value === v.id} onClick={() => onChange(v.id)}>{v.label} <span>{v.n}</span></button>)}
    </div>
  );
}
const norm = (s: string) => s.toLowerCase();

// ---------------- Targets ----------------
function TargetsTab({ ownerId, readOnly }: { ownerId: string; readOnly?: boolean }) {
  const { db, act, setModal, setPanel, go, tz, toast } = useApp();
  const [q, setQ] = React.useState('');
  const [view, setView] = React.useState<'active' | 'archived'>('active');
  const [track, setTrack] = React.useState('');
  const [pri, setPri] = React.useState('');
  const all = db.targets.filter(t => t.ownerId === ownerId);
  const rows = all.filter(t => t.state === view && (!track || t.track === track) && (!pri || t.priority === pri) && (!q || norm(firmName(db, t.firmId)).includes(norm(q))));
  const stats = new Map(rows.map(t => [t.id, targetStats(db, ownerId, firmOf(db, t.firmId)?.id ?? t.firmId)]));
  const PR: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  const today = todayKey(tz);
  const cols: Col<Target>[] = [
    { key: 'firm', header: 'Firm', mobile: 'title', sort: t => firmName(db, t.firmId), render: t => <span className="cell-strong">{firmName(db, t.firmId)}{firmOf(db, t.firmId)?.status === 'pending' && <> <Badge tone="amber">Pending</Badge></>}</span> },
    { key: 'track', header: 'Track', mobile: 'sub', sort: t => t.track, render: t => t.track },
    { key: 'cycle', header: 'Cycle', mobile: 'hide', sort: t => t.cycle, render: t => t.cycle },
    { key: 'offices', header: 'Offices', mobile: 'meta', render: t => t.offices.length ? t.offices.join(', ') : <span className="muted">Any</span> },
    { key: 'pri', header: 'Priority', mobile: 'meta', sort: t => PR[t.priority], render: t => readOnly ? <StageBadge s={t.priority} /> : (
      <select aria-label={`Priority for ${firmName(db, t.firmId)}`} className={`input input-sm pri-${t.priority}`} value={t.priority} onChange={e => act((d, a) => M.updateTarget(d, a, t.id, { priority: e.target.value as Priority }))}>
        <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
      </select>) },
    { key: 'contacts', header: 'Contacts', className: 'num', mobile: 'meta', sort: t => stats.get(t.id)!.contactCount, render: t => stats.get(t.id)!.contactCount },
    { key: 'apps', header: 'Active apps', className: 'num', mobile: 'meta', sort: t => stats.get(t.id)!.activeApps, render: t => stats.get(t.id)!.activeApps },
    { key: 'last', header: 'Last activity', mobile: 'meta', sort: t => stats.get(t.id)!.last?.occurredAt ?? '', render: t => { const l = stats.get(t.id)!.last; return l ? <span title={ACTIVITY_TYPES[l.type]}>{fmtDateTime(l.occurredAt, tz, true)}</span> : <span className="muted">None logged</span>; } },
    { key: 'next', header: 'Next open task', mobile: 'meta', sort: t => stats.get(t.id)!.next?.due ?? 'z', render: t => { const n = stats.get(t.id)!.next; return n ? <span className={n.due < today ? 'text-danger' : ''}>{n.label} · {relDay(n.due, today)}</span> : <span className="muted">—</span>; } },
    ...(!readOnly ? [{ key: 'act', header: '', mobile: 'hide' as const, render: (t: Target) => <Button size="sm" variant="ghost" onClick={() => { act((d, a) => M.updateTarget(d, a, t.id, { state: t.state === 'active' ? 'archived' : 'active' })); toast({ text: t.state === 'active' ? 'Target archived.' : 'Target restored.' }); }}>{t.state === 'active' ? 'Archive' : 'Restore'}</Button> }] : []),
  ];
  return (
    <>
      <div className="toolbar">
        <Views value={view} onChange={setView} views={[{ id: 'active', label: 'Active', n: all.filter(t => t.state === 'active').length }, { id: 'archived', label: 'Archived', n: all.filter(t => t.state === 'archived').length }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search firms" id="tg-q" />
        <Select ariaLabel="Filter by track" value={track} onChange={setTrack} options={TRACKS} placeholder="All tracks" />
        <Select ariaLabel="Filter by priority" value={pri} onChange={setPri} options={[{ value: 'high', label: 'High priority' }, { value: 'medium', label: 'Medium priority' }, { value: 'low', label: 'Low priority' }]} placeholder="Any priority" />
        {!readOnly && <Button variant="primary" size="sm" icon="plus" onClick={() => setModal({ kind: 'addTarget' })}>Add target</Button>}
      </div>
      <DataTable label="Targets" rows={rows} cols={cols} initialSort={{ key: 'pri', dir: 1 }} onOpen={t => setPanel({ kind: 'firm', id: firmOf(db, t.firmId)?.id ?? t.firmId })}
        empty={all.length === 0 ? <Empty title="No target firms yet" icon="target" action={!readOnly && <Button size="sm" variant="primary" onClick={() => go('firms')}>Browse Explore Firms</Button>}>Add firms you’re interested in. Adding a target doesn’t log outreach or create an application.</Empty> : <Empty title="No targets match these filters" />} />
    </>
  );
}

// ---------------- Contacts ----------------
type CView = 'active' | 'due' | 'awaiting' | 'chats' | 'new' | 'closed';
function ContactsTab({ ownerId, readOnly }: { ownerId: string; readOnly?: boolean }) {
  const { db, setModal, setPanel, tz } = useApp();
  const [q, setQ] = React.useState('');
  const [view, setView] = React.useState<CView>('active');
  const [firm, setFirm] = React.useState('');
  const [stage, setStage] = React.useState('');
  const [source, setSource] = React.useState('');
  const today = todayKey(tz);
  const all = ownerContacts(db, ownerId).map(c => ({ c, stage: relStage(db, c), task: openFollowUp(db, c.id), last: lastActivity(db, c.id) }));
  const matchView = (x: (typeof all)[number], v: CView) =>
    v === 'active' ? x.stage !== 'Closed' : v === 'due' ? !!x.task && x.task.dueOn <= addDay(today, 2) : v === 'awaiting' ? x.stage === 'Awaiting reply'
      : v === 'chats' ? x.stage === 'Chat scheduled' || x.stage === 'Replied' : v === 'new' ? x.stage === 'Not contacted' : x.stage === 'Closed';
  const firms = Array.from(new Set(all.map(x => firmOf(db, x.c.firmId)?.id ?? ''))).map(id => ({ value: id, label: firmName(db, id) })).sort((a, b) => a.label.localeCompare(b.label));
  const rows = all.filter(x => matchView(x, view) && (!firm || firmOf(db, x.c.firmId)?.id === firm) && (!stage || x.stage === stage) && (!source || x.c.source === source)
    && (!q || [x.c.name, x.c.email ?? '', x.c.title, firmName(db, x.c.firmId)].some(s => norm(s).includes(norm(q))))).map(x => ({ ...x, id: x.c.id }));
  type R = (typeof rows)[number];
  const stageIdx = (s: string) => REL_STAGES.indexOf(s as never);
  const cols: Col<R>[] = [
    { key: 'name', header: 'Name', mobile: 'title', sort: r => r.c.name, render: r => <span className="cell-stack"><span className="cell-strong">{r.c.name}</span><span className="muted small">{r.c.title || '—'}</span></span> },
    { key: 'firm', header: 'Firm', mobile: 'sub', sort: r => firmName(db, r.c.firmId), render: r => firmName(db, r.c.firmId) },
    { key: 'stage', header: 'Stage', mobile: 'sub', sort: r => stageIdx(r.stage), render: r => <StageBadge s={r.stage} /> },
    { key: 'fu', header: 'Follow-ups', className: 'num', mobile: 'meta', sort: r => followUpCount(db, r.c.id), render: r => followUpCount(db, r.c.id) },
    { key: 'last', header: 'Last activity', mobile: 'meta', sort: r => r.last?.occurredAt ?? '', render: r => r.last ? <span className="cell-stack"><span>{fmtDateTime(r.last.occurredAt, tz, true)}</span><span className="muted small">{ACTIVITY_TYPES[r.last.type]}</span></span> : <span className="muted">None logged</span> },
    { key: 'next', header: 'Next follow-up', mobile: 'meta', sort: r => r.task?.dueOn ?? 'z', render: r => r.task ? <span className={r.task.dueOn < today ? 'text-danger' : ''}>{r.task.dueOn < today && <Icon name="alert" size={12} />} {fmtDate(r.task.dueOn)} · {relDay(r.task.dueOn, today)}</span> : <span className="muted">—</span> },
    { key: 'src', header: 'Source', mobile: 'hide', sort: r => r.c.source, render: r => r.c.source },
    { key: 'email', header: 'Email', mobile: 'hide', render: r => r.c.email ? <span className="small selectable">{r.c.email}</span> : <span className="muted small">—</span> },
  ];
  return (
    <>
      <div className="toolbar">
        <Views value={view} onChange={setView} views={[
          { id: 'active', label: 'Active', n: all.filter(x => matchView(x, 'active')).length },
          { id: 'due', label: 'Follow up now', n: all.filter(x => matchView(x, 'due')).length },
          { id: 'awaiting', label: 'Awaiting reply', n: all.filter(x => matchView(x, 'awaiting')).length },
          { id: 'chats', label: 'Replied or chat set', n: all.filter(x => matchView(x, 'chats')).length },
          { id: 'new', label: 'Not contacted', n: all.filter(x => matchView(x, 'new')).length },
          { id: 'closed', label: 'Closed', n: all.filter(x => matchView(x, 'closed')).length },
        ]} />
      </div>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, firm, email" id="ct-q" />
        <Select ariaLabel="Filter by firm" value={firm} onChange={setFirm} options={firms} placeholder="All firms" />
        <Select ariaLabel="Filter by stage" value={stage} onChange={setStage} options={REL_STAGES} placeholder="Any stage" />
        <Select ariaLabel="Filter by source" value={source} onChange={setSource} options={CONNECTION_SOURCES} placeholder="Any source" />
        {!readOnly && <Button variant="primary" size="sm" icon="plus" onClick={() => setModal({ kind: 'addContact' })}>Add contact</Button>}
      </div>
      <DataTable label="Contacts" rows={rows} cols={cols} initialSort={view === 'due' ? { key: 'next', dir: 1 } : { key: 'last', dir: -1 }} onOpen={r => setPanel({ kind: 'contact', id: r.c.id })} rowLabel={r => `${r.c.name}, ${firmName(db, r.c.firmId)}, ${r.stage}`}
        empty={all.length === 0 ? <Empty title="No contacts yet" icon="user" action={!readOnly && <Button size="sm" variant="primary" onClick={() => setModal({ kind: 'addContact', logOutreach: true })}>Add your first contact</Button>}>Add people you’re reaching out to, or import screenshots of your Sent folder.</Empty> : <Empty title="No contacts match" icon="search">Try another view or clear the filters.</Empty>} />
    </>
  );
}

// ---------------- Applications ----------------
type AView = 'pipeline' | 'considering' | 'closed' | 'all';
const CLOSED: AppStage[] = ['Offer', 'Rejected', 'Withdrawn'];
function ApplicationsTab({ ownerId, readOnly }: { ownerId: string; readOnly?: boolean }) {
  const { db, act, setModal, setPanel, tz, toast } = useApp();
  const [q, setQ] = React.useState('');
  const [view, setView] = React.useState<AView>('all');
  const [track, setTrack] = React.useState('');
  const [cycle, setCycle] = React.useState('');
  const [stage, setStage] = React.useState('');
  const today = todayKey(tz);
  const all = ownerApps(db, ownerId);
  const inView = (a: Application, v: AView) => v === 'all' || (v === 'pipeline' ? ACTIVE_APP_STAGES.includes(a.stage) : v === 'considering' ? a.stage === 'Considering' : CLOSED.includes(a.stage));
  const rows = all.filter(a => inView(a, view) && (!track || a.track === track) && (!cycle || a.cycle === cycle) && (!stage || a.stage === stage) && (!q || [a.roleTitle, firmName(db, a.firmId), a.office ?? ''].some(s => norm(s).includes(norm(q)))));
  const cols: Col<Application>[] = [
    { key: 'firm', header: 'Firm', mobile: 'title', sort: a => firmName(db, a.firmId), render: a => <span className="cell-stack"><span className="cell-strong">{firmName(db, a.firmId)}</span><span className="muted small">{a.roleTitle}</span></span> },
    { key: 'track', header: 'Track · cycle', mobile: 'sub', sort: a => a.track, render: a => <span className="cell-stack"><span>{a.track}</span><span className="muted small">{a.cycle}{a.office ? ` · ${a.office}` : ''}</span></span> },
    { key: 'stage', header: 'Stage', mobile: 'sub', sort: a => APP_STAGES.indexOf(a.stage), render: a => readOnly ? <StageBadge s={a.stage} /> : (
      <select aria-label={`Stage for ${firmName(db, a.firmId)} ${a.roleTitle}`} className="input input-sm" value={a.stage} onChange={e => { const s = e.target.value as AppStage; if (act((d, x) => M.updateApplication(d, x, a.id, { stage: s }))) toast({ text: `${firmName(db, a.firmId)} moved to ${s}.` }); }}>
        {APP_STAGES.map(s => <option key={s}>{s}</option>)}
      </select>) },
    { key: 'deadline', header: 'Deadline', mobile: 'meta', sort: a => a.deadline ?? 'z', render: a => a.deadline ? <span className={a.stage === 'Considering' && a.deadline < today ? 'text-danger' : ''}>{fmtDate(a.deadline)}</span> : <span className="muted">Unknown</span> },
    { key: 'applied', header: 'Applied', mobile: 'hide', sort: a => a.appliedOn ?? '', render: a => a.appliedOn ? fmtDate(a.appliedOn) : <span className="muted">—</span> },
    { key: 'iv', header: 'Next interview', mobile: 'meta', sort: a => nextInterview(db, a.id)?.scheduledAt ?? 'z', render: a => { const i = nextInterview(db, a.id); return i ? <span className="cell-stack"><span>{fmtDateTime(i.scheduledAt, tz)}</span><span className="muted small">{i.round} · {i.type}</span></span> : <span className="muted">—</span>; } },
    { key: 'next', header: 'Next action', mobile: 'meta', sort: a => a.nextActionDue ?? 'z', render: a => a.nextAction ? <span className="cell-stack"><span>{a.nextAction}</span>{a.nextActionDue && <span className={`small ${a.nextActionDue < today ? 'text-danger' : 'muted'}`}>due {fmtDate(a.nextActionDue)}</span>}</span> : <span className="muted">—</span> },
  ];
  return (
    <>
      <div className="toolbar">
        <Views value={view} onChange={setView} views={[
          { id: 'all', label: 'All', n: all.length },
          { id: 'pipeline', label: 'In process', n: all.filter(a => inView(a, 'pipeline')).length },
          { id: 'considering', label: 'Considering', n: all.filter(a => inView(a, 'considering')).length },
          { id: 'closed', label: 'Offers and closed', n: all.filter(a => inView(a, 'closed')).length },
        ]} />
      </div>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search firm, role, office" id="ap-q" />
        <Select ariaLabel="Filter by track" value={track} onChange={setTrack} options={TRACKS} placeholder="All tracks" />
        <Select ariaLabel="Filter by cycle" value={cycle} onChange={setCycle} options={CYCLES} placeholder="All cycles" />
        <Select ariaLabel="Filter by stage" value={stage} onChange={setStage} options={APP_STAGES} placeholder="Any stage" />
        {!readOnly && <Button variant="primary" size="sm" icon="plus" onClick={() => setModal({ kind: 'addApplication' })}>Add application</Button>}
      </div>
      <DataTable label="Applications" rows={rows} cols={cols} initialSort={{ key: 'stage', dir: -1 }} onOpen={a => setPanel({ kind: 'application', id: a.id })} rowLabel={a => `${firmName(db, a.firmId)} ${a.roleTitle}, ${a.stage}`}
        empty={all.length === 0 ? <Empty title="No applications yet" icon="file" action={!readOnly && <Button size="sm" variant="primary" onClick={() => setModal({ kind: 'addApplication' })}>Add application</Button>}>Track roles you’re considering or have applied to.</Empty> : <Empty title="No applications match" icon="search" />} />
    </>
  );
}
function addDay(d: string, n: number) { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
export type { Contact };
