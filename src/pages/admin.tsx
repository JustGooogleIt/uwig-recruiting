import React from 'react';
import { useApp } from '../app/store';
import { Badge, Button, Chips, Col, Confirm, DataTable, Empty, Field, Icon, PageHead, SearchInput, Section, Select, Tabs } from '../ui/kit';
import type { Firm, FirmType, Member, Role, Track } from '../domain/types';
import { FIRM_TYPES, TRACKS } from '../domain/types';
import { firmOf, groupAnalysts, groupOf, lastLogged, lastNDays, memberName, ownerActs, periodTotals } from '../domain/derive';
import type { Period } from '../domain/derive';
import { dateKey, fmtDateTime, relDay, todayKey } from '../domain/time';
import { slug } from '../domain/ids';
import * as M from '../domain/mutations';
import { allOffices } from '../ui/forms';

export function AdminPage() {
  const { db, tab, setTab } = useApp();
  const pending = db.firms.filter(f => f.status === 'pending');
  const t = (tab as 'directory' | 'members' | 'groups' | 'activity') ?? 'directory';
  return (
    <div className="page">
      <PageHead title="Administration" sub="Firm directory, membership, mentor groups and analyst activity. Only exec can see this page." />
      <Tabs label="Administration" value={t} onChange={setTab} tabs={[{ id: 'directory', label: 'Directory review', count: pending.length }, { id: 'members', label: 'Members and roles' }, { id: 'groups', label: 'Mentor groups' }, { id: 'activity', label: 'Analyst activity' }]} />
      <div role="tabpanel" aria-labelledby={`tab-${t}`} className="tabpanel">
        {t === 'directory' && <DirectoryQueue />}
        {t === 'members' && <Members />}
        {t === 'groups' && <Groups />}
        {t === 'activity' && <ActivityRanking />}
      </div>
    </div>
  );
}

function DirectoryQueue() {
  const { db } = useApp();
  const pending = db.firms.filter(f => f.status === 'pending');
  const recent = db.firms.filter(f => f.status === 'merged' || (f.status === 'approved' && f.submittedBy && db.members.find(m => m.id === f.submittedBy)?.role !== 'exec')).slice(-5).reverse();
  return <>
    <BulkAddFirms />
    <Section title={<>Member submissions {pending.length > 0 && <Badge tone="amber">{pending.length} waiting</Badge>}</>} id="dq-queue">
      {pending.length ? <ul className="queue">{pending.map(f => <QueueItem key={f.id} f={f} />)}</ul>
        : <Empty title="No submissions waiting" icon="check">When members submit a missing firm, it appears here. They can use it while it waits.</Empty>}
    </Section>
    {recent.length > 0 && <Section title="Recently reviewed" id="dq-recent"><ul className="plain-list">{recent.map(f => <li key={f.id}>{f.name} · {f.status === 'merged' ? <>merged into <strong>{firmOf(db, f.id)?.name}</strong></> : 'approved'}</li>)}</ul></Section>}
  </>;
}

const firmKey = (n: string) => n.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
function BulkAddFirms() {
  const { db, run, toast, me } = useApp();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [type, setType] = React.useState<FirmType>('Hedge fund');
  const [tracks, setTracks] = React.useState<Track[]>([]);
  const [source, setSource] = React.useState('');
  const names = Array.from(new Map(text.split(/\n|,|;/).map(x => x.trim()).filter(Boolean).map(n => [firmKey(n), n] as [string, string])).values());
  const known = new Map(db.firms.filter(f => f.status !== 'rejected').flatMap(f => [f.name, ...f.aliases].map(n => [firmKey(n), firmOf(db, f.id)?.name ?? f.name] as [string, string])));
  const fresh = names.filter(n => !known.has(firmKey(n)));
  const existing = names.filter(n => known.has(firmKey(n)));
  const add = () => {
    const out = run((d, a) => M.addFirmsBulk(d, a, fresh, type, tracks, source.trim() || `Added by ${me.name}`));
    if (out) { toast({ text: `${out.added.length} firm${out.added.length === 1 ? '' : 's'} added to Explore Firms.${out.skipped.length ? ` ${out.skipped.length} already listed.` : ''}` }); setText(''); setOpen(false); }
  };
  return (
    <Section title="Add firms to the directory" id="dq-bulk" aside={!open && <Button size="sm" variant="primary" icon="plus" onClick={() => setOpen(true)}>Add firms in bulk</Button>}>
      {!open ? <p className="muted small">Paste a list of firms you or other exec have put together. Firms already in the directory are skipped, so it is safe to paste overlapping lists. {db.firms.filter(f => f.status === 'approved').length} firms are listed now.</p> : (
        <div className="form-grid boxed">
          <Field label="Firm names" required id="bf-names" className="span-2" hint="One per line, or separated by commas."><textarea id="bf-names" className="input" rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={'Millennium Management\nBridgewater Associates\nAccel'} /></Field>
          <Field label="Firm type" required id="bf-type" hint="Applies to every firm in this paste. Paste hedge funds and VC firms separately."><Select id="bf-type" value={type} onChange={v => setType(v as FirmType)} options={FIRM_TYPES} /></Field>
          <Field label="Where this list came from" id="bf-src"><input id="bf-src" className="input" value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. Hedge fund list, fall 2026" /></Field>
          <Field label="Recruiting tracks" id="bf-tr" className="span-2"><Chips ariaLabel="Recruiting tracks" options={TRACKS} value={tracks} onChange={v => setTracks(v as Track[])} /></Field>
          {names.length > 0 && <div className="span-2 bulk-preview">
            <p><strong>{fresh.length}</strong> new · <span className="muted">{existing.length} already in the directory</span></p>
            {fresh.length > 0 && <ul className="chip-list">{fresh.slice(0, 40).map(n => <li key={n} className="chip on">{n}</li>)}{fresh.length > 40 && <li className="muted small">and {fresh.length - 40} more</li>}</ul>}
            {existing.length > 0 && <p className="muted small">Skipped: {existing.slice(0, 12).map(n => known.get(firmKey(n))).join(', ')}{existing.length > 12 ? ` and ${existing.length - 12} more` : ''}</p>}
          </div>}
          <div className="span-2 row-end"><Button size="sm" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" variant="primary" disabled={!fresh.length} onClick={add}>Add {fresh.length || ''} firm{fresh.length === 1 ? '' : 's'}</Button></div>
        </div>
      )}
    </Section>
  );
}
function QueueItem({ f }: { f: Firm }) {
  const { db, act, toast, tz } = useApp();
  const [mode, setMode] = React.useState<'view' | 'edit' | 'merge'>('view');
  const [draft, setDraft] = React.useState({ name: f.name, website: f.website ?? '', type: f.type, tracks: f.tracks, offices: f.offices });
  const [into, setInto] = React.useState('');
  const [confirm, setConfirm] = React.useState(false);
  const linked = { targets: db.targets.filter(t => t.firmId === f.id).length, contacts: db.contacts.filter(c => c.firmId === f.id).length, apps: db.applications.filter(a => a.firmId === f.id).length };
  const q = slug(f.name).replace(/andco$|co$|inc$|llc$/, '');
  const score = (x: Firm) => {
    const names = [x.name, ...x.aliases].map(slug);
    if (names.some(n => n === q || (n.length > 4 && (q.includes(n) || n.includes(q))))) return 3;
    if (names.some(n => n.slice(0, 5) === q.slice(0, 5))) return 2;
    return 0;
  };
  const matches = db.firms.filter(x => x.id !== f.id && x.status === 'approved' && score(x) > 0).sort((a, b) => score(b) - score(a));
  const approved = db.firms.filter(x => x.status === 'approved').sort((a, b) => a.name.localeCompare(b.name));
  return (
    <li className="queue-item">
      <div className="row-between">
        <div><strong>{f.name}</strong> <Badge tone="amber">Pending</Badge><div className="muted small">Submitted by {memberName(db, f.submittedBy)} · {fmtDateTime(f.createdAt, tz, true)} · {f.type}</div></div>
        <div className="row-gap wrap">
          <Button size="sm" variant="primary" onClick={() => setMode('edit')}>Review and approve</Button>
          <Button size="sm" icon="merge" onClick={() => { setMode('merge'); setInto(matches[0]?.id ?? ''); }}>Merge into existing</Button>
        </div>
      </div>
      <p className="small">Linked records: {linked.targets} target{linked.targets === 1 ? '' : 's'}, {linked.contacts} contact{linked.contacts === 1 ? '' : 's'}, {linked.apps} application{linked.apps === 1 ? '' : 's'}. These move with the firm if you merge.</p>
      {matches.length > 0 && <p className="callout warn small"><Icon name="alert" /><span>Possible duplicate of {matches.map(m => m.name).join(', ')}.</span></p>}
      {mode === 'edit' && (
        <div className="form-grid boxed">
          <Field label="Name" required id={`q-name-${f.id}`}><input id={`q-name-${f.id}`} className="input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Firm type" required id={`q-type-${f.id}`}><Select id={`q-type-${f.id}`} value={draft.type} onChange={v => setDraft({ ...draft, type: v as FirmType })} options={FIRM_TYPES} /></Field>
          <Field label="Website" id={`q-web-${f.id}`} className="span-2"><input id={`q-web-${f.id}`} className="input" value={draft.website} onChange={e => setDraft({ ...draft, website: e.target.value })} /></Field>
          <Field label="Recruiting tracks" id={`q-tr-${f.id}`} className="span-2"><Chips ariaLabel="Tracks" options={TRACKS} value={draft.tracks} onChange={v => setDraft({ ...draft, tracks: v as Track[] })} /></Field>
          <Field label="Offices" id={`q-of-${f.id}`} className="span-2"><Chips ariaLabel="Offices" options={Array.from(new Set([...allOffices(db), ...draft.offices]))} value={draft.offices} onChange={v => setDraft({ ...draft, offices: v })} /></Field>
          <div className="span-2 row-end"><Button size="sm" onClick={() => setMode('view')}>Cancel</Button><Button size="sm" variant="primary" onClick={() => { if (act((d, a) => M.approveFirm(d, a, f.id, { ...draft, name: draft.name.trim(), website: draft.website || undefined }))) toast({ text: `${draft.name} approved and added to the directory.` }); }}>Approve</Button></div>
        </div>
      )}
      {mode === 'merge' && (
        <div className="boxed row-gap wrap">
          <label htmlFor={`m-${f.id}`}>Merge “{f.name}” into</label>
          <select id={`m-${f.id}`} className="input input-sm" value={into} onChange={e => setInto(e.target.value)}>
            <option value="">Choose a firm</option>
            {approved.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <Button size="sm" onClick={() => setMode('view')}>Cancel</Button>
          <Button size="sm" variant="primary" disabled={!into} onClick={() => setConfirm(true)}>Merge</Button>
        </div>
      )}
      {confirm && <Confirm title="Merge these firms?" confirmLabel="Merge firms" onClose={() => setConfirm(false)}
        body={<p>“{f.name}” becomes an alias of <strong>{db.firms.find(x => x.id === into)?.name}</strong>. {linked.targets + linked.contacts + linked.apps} linked records move to it. Nothing is deleted.</p>}
        onConfirm={() => { if (act((d, a) => M.mergeFirm(d, a, f.id, into))) toast({ text: `Merged “${f.name}” into ${db.firms.find(x => x.id === into)?.name}. Linked records were kept.` }); }} />}
    </li>
  );
}

function Members() {
  const { db, act, toast, personaId } = useApp();
  const [q, setQ] = React.useState('');
  const [role, setRole] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [nm, setNm] = React.useState({ name: '', email: '', role: 'analyst' as Role, classYear: '2029' });
  const rows = db.members.filter(m => (!role || m.role === role) && (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.email.includes(q.toLowerCase())));
  const groups = db.groups.map(g => ({ value: g.id, label: `${g.name} (${memberName(db, g.mentorId)})` }));
  const cols: Col<Member>[] = [
    { key: 'name', header: 'Name', mobile: 'title', sort: m => m.name, render: m => <span className="cell-stack"><span className="cell-strong">{m.name}{m.id === personaId && ' (you)'}</span><span className="muted small selectable">{m.email}</span></span> },
    { key: 'role', header: 'Role', mobile: 'sub', sort: m => m.role, render: m => (
      <select aria-label={`Role for ${m.name}`} className="input input-sm" value={m.role} disabled={m.id === personaId} title={m.id === personaId ? 'You cannot change your own role' : undefined}
        onChange={e => { if (act((d, a) => M.setRole(d, a, m.id, e.target.value as Role))) toast({ text: `${m.name} is now ${e.target.value}.` }); }}>
        <option value="analyst">Analyst</option><option value="mentor">Mentor</option><option value="exec">Exec</option>
      </select>) },
    { key: 'group', header: 'Mentor group', mobile: 'meta', sort: m => groupOf(db, m.id)?.name ?? 'z', render: m => m.role !== 'analyst' ? <span className="muted small">{m.role === 'mentor' ? `Leads ${db.groups.filter(g => g.mentorId === m.id).map(g => g.name).join(', ') || 'no group'}` : '—'}</span> : (
      <select aria-label={`Group for ${m.name}`} className="input input-sm" value={groupOf(db, m.id)?.id ?? ''} onChange={e => { if (act((d, a) => M.assignAnalyst(d, a, m.id, e.target.value))) toast({ text: `${m.name} assigned to ${db.groups.find(g => g.id === e.target.value)?.name ?? 'no group'}.` }); }}>
        <option value="">Unassigned</option>{groups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>) },
    { key: 'year', header: 'Class', className: 'num', mobile: 'meta', sort: m => m.classYear, render: m => m.classYear },
    { key: 'active', header: 'Status', mobile: 'meta', sort: m => (m.active ? 0 : 1), render: m => m.id === personaId ? <Badge tone="green">Active</Badge> : <button className="linkish small" onClick={() => act((d, a) => M.setActive(d, a, m.id, !m.active))}>{m.active ? 'Active · deactivate' : 'Inactive · reactivate'}</button> },
  ];
  return (
    <>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search members" id="mb-q" />
        <Select ariaLabel="Filter by role" value={role} onChange={setRole} options={[{ value: 'analyst', label: 'Analysts' }, { value: 'mentor', label: 'Mentors' }, { value: 'exec', label: 'Exec' }]} placeholder="All roles" />
        <Button size="sm" variant="primary" icon="plus" onClick={() => setAdding(v => !v)}>Add member</Button>
      </div>
      {adding && (
        <div className="form-grid boxed">
          <Field label="Name" required id="nm-name"><input id="nm-name" className="input" value={nm.name} onChange={e => setNm({ ...nm, name: e.target.value })} /></Field>
          <Field label="Email" required id="nm-email" hint="In production, an invite goes through managed auth. No passwords are stored here."><input id="nm-email" className="input" type="email" value={nm.email} onChange={e => setNm({ ...nm, email: e.target.value })} /></Field>
          <Field label="Role" required id="nm-role"><Select id="nm-role" value={nm.role} onChange={v => setNm({ ...nm, role: v })} options={[{ value: 'analyst', label: 'Analyst' }, { value: 'mentor', label: 'Mentor' }, { value: 'exec', label: 'Exec' }]} /></Field>
          <Field label="Class year" required id="nm-year"><input id="nm-year" className="input" type="number" value={nm.classYear} onChange={e => setNm({ ...nm, classYear: e.target.value })} /></Field>
          <div className="span-2 row-end"><Button size="sm" onClick={() => setAdding(false)}>Cancel</Button><Button size="sm" variant="primary" onClick={() => { if (act((d, a) => M.addMember(d, a, { ...nm, classYear: +nm.classYear }))) { setAdding(false); toast({ text: `${nm.name} added. Assign them to a group below.` }); setNm({ name: '', email: '', role: 'analyst', classYear: '2029' }); } }}>Add member</Button></div>
        </div>
      )}
      <p className="muted small">{db.members.filter(m => m.role === 'analyst').length} analysts · {db.members.filter(m => m.role === 'mentor').length} mentors · {db.members.filter(m => m.role === 'exec').length} exec. Members cannot change their own access.</p>
      <DataTable label="Members" rows={rows} cols={cols} initialSort={{ key: 'name', dir: 1 }} empty={<Empty title="No members match" icon="search" />} />
    </>
  );
}

function Groups() {
  const { db, act, toast } = useApp();
  const [openId, setOpenId] = React.useState<string | null>(db.groups[0]?.id ?? null);
  const [name, setName] = React.useState('');
  const [mentor, setMentor] = React.useState('');
  const mentors = db.members.filter(m => (m.role === 'mentor' || m.role === 'exec') && m.active);
  const unassigned = db.members.filter(m => m.role === 'analyst' && m.active && !groupOf(db, m.id));
  return (
    <>
      <p className="muted small">Open a group to see its analysts, move them between groups, or add someone. {unassigned.length > 0 ? `${unassigned.length} analyst${unassigned.length === 1 ? ' is' : 's are'} not in a group yet.` : 'Every active analyst is in a group.'}</p>
      <ul className="group-admin">
        {db.groups.map(g => <GroupRow key={g.id} groupId={g.id} open={openId === g.id} onToggle={() => setOpenId(openId === g.id ? null : g.id)} mentors={mentors} unassigned={unassigned} />)}
      </ul>
      <Section title="New mentor group" id="ga-new">
        <div className="row-gap wrap">
          <input aria-label="Group name" className="input input-sm" placeholder="Group name" value={name} onChange={e => setName(e.target.value)} />
          <select aria-label="Mentor for new group" className="input input-sm" value={mentor} onChange={e => setMentor(e.target.value)}>
            <option value="">Choose a mentor</option>{mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Button size="sm" variant="primary" icon="plus" disabled={!name.trim() || !mentor} onClick={() => { if (act((d, a) => M.createGroup(d, a, name, mentor))) { toast({ text: `${name.trim()} created. Add analysts to it above.` }); setName(''); setMentor(''); } }}>Create group</Button>
        </div>
      </Section>
    </>
  );
}

function GroupRow({ groupId, open, onToggle, mentors, unassigned }: { groupId: string; open: boolean; onToggle: () => void; mentors: Member[]; unassigned: Member[] }) {
  const { db, act, toast, go, tz } = useApp();
  const g = db.groups.find(x => x.id === groupId)!;
  const analysts = groupAnalysts(db, g.id).sort((a, b) => a.name.localeCompare(b.name));
  const move = (m: Member, to: string) => { if (act((d, a) => M.assignAnalyst(d, a, m.id, to))) toast({ text: to ? `${m.name} moved to ${db.groups.find(x => x.id === to)?.name}.` : `${m.name} removed from ${g.name}.` }); };
  const today = todayKey(tz);
  return (
    <li className={`group-row ${open ? 'open' : ''}`}>
      <div className="row-between">
        <button className="group-toggle" aria-expanded={open} aria-controls={`gp-${g.id}`} onClick={onToggle}>
          <Icon name="chevron" size={16} className="chev" />
          <strong>{g.name}</strong> <span className="muted small">{analysts.length} analyst{analysts.length === 1 ? '' : 's'} · {memberName(db, g.mentorId)}</span>
        </button>
        <label className="row-gap"><span className="small">Mentor</span>
          <select className="input input-sm" value={g.mentorId} aria-label={`Mentor for ${g.name}`} onChange={e => { if (act((d, a) => M.setGroupMentor(d, a, g.id, e.target.value))) toast({ text: `${g.name} now mentored by ${memberName(db, e.target.value)}.` }); }}>
            {mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      </div>
      {open && (
        <div id={`gp-${g.id}`} className="group-body">
          {analysts.length === 0 ? <p className="muted small">No analysts in this group yet.</p> : (
            <ul className="group-members">
              {analysts.map(m => {
                const last = lastLogged(db, m.id);
                const wk = periodTotals(db, [m.id], lastNDays(tz, 7), tz);
                return (
                  <li key={m.id}>
                    <span className="avatar sm" aria-hidden="true">{m.name.split(' ').map(x => x[0]).join('')}</span>
                    <span className="grow cell-stack">
                      <span className="cell-strong">{m.name} <span className="muted small">class of {m.classYear}</span></span>
                      <span className="muted small">{m.tracks?.join(', ') || 'No tracks set'} · {last ? `last logged ${relDay(dateKey(last.createdAt, tz), today)}` : 'nothing logged yet'} · {wk.newContacts} new contact{wk.newContacts === 1 ? '' : 's'} and {wk.followUps} follow-up{wk.followUps === 1 ? '' : 's'} in the last 7 days</span>
                    </span>
                    <span className="row-gap wrap">
                      <Button size="sm" variant="ghost" icon="eye" onClick={() => go('workspace', { analystId: m.id })}>Open workspace</Button>
                      <select aria-label={`Move ${m.name} to another group`} className="input input-sm" value={g.id} onChange={e => move(m, e.target.value)}>
                        <option value={g.id}>Move to…</option>
                        {db.groups.filter(x => x.id !== g.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                        <option value="">Remove from group</option>
                      </select>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {unassigned.length > 0 && <label className="row-gap small"><span>Add analyst</span>
            <select aria-label={`Add analyst to ${g.name}`} className="input input-sm" value="" onChange={e => { const m = db.members.find(x => x.id === e.target.value); if (m && act((d, a) => M.assignAnalyst(d, a, m.id, g.id))) toast({ text: `${m.name} added to ${g.name}.` }); }}>
              <option value="">Choose an unassigned analyst</option>{unassigned.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>}
        </div>
      )}
    </li>
  );
}

type Rank = { id: string; rank: number; m: Member; group: string; total: number; newContacts: number; followUps: number; replies: number; chats: number; apps: number; last?: string };
function ActivityRanking() {
  const { db, go, tz } = useApp();
  const [days, setDays] = React.useState('30');
  const [groupId, setGroupId] = React.useState('');
  const today = todayKey(tz);
  const p: Period = days === 'all' ? { start: '0000-01-01', end: today, label: 'All time' } : lastNDays(tz, +days);
  const analysts = db.members.filter(m => m.role === 'analyst' && m.active && (!groupId || groupOf(db, m.id)?.id === groupId));
  const base = analysts.map(m => {
    const t = periodTotals(db, [m.id], p, tz);
    const total = ownerActs(db, m.id).filter(a => { const d = dateKey(a.occurredAt, tz); return d >= p.start && d <= p.end; }).length;
    return { id: m.id, m, group: groupOf(db, m.id)?.name ?? 'Unassigned', total, ...t, last: lastLogged(db, m.id)?.createdAt };
  }).sort((a, b) => b.total - a.total || b.newContacts - a.newContacts || a.m.name.localeCompare(b.m.name));
  const rows: Rank[] = base.map((r, i) => ({ ...r, rank: i > 0 && base[i - 1].total === r.total ? -1 : i + 1 }));
  rows.forEach((r, i) => { if (r.rank === -1) r.rank = rows[i - 1].rank; });
  const num = (k: keyof Rank, header: string): Col<Rank> => ({ key: k, header, className: 'num', mobile: 'meta', sort: r => r[k] as number, render: r => (r[k] as number) || <span className="muted">0</span> });
  const cols: Col<Rank>[] = [
    { key: 'rank', header: '#', className: 'num', mobile: 'hide', sort: r => r.rank, render: r => r.total ? <span className={`rank ${r.rank <= 3 ? 'top' : ''}`}>{r.rank}</span> : <span className="muted">—</span> },
    { key: 'name', header: 'Analyst', mobile: 'title', sort: r => r.m.name, render: r => <span className="cell-stack"><span className="cell-strong">{r.total > 0 && r.rank <= 3 && <span className="rank top mobile-only">{r.rank}</span>}{r.m.name}</span><span className="muted small">class of {r.m.classYear}</span></span> },
    { key: 'group', header: 'Group', mobile: 'sub', sort: r => r.group, render: r => <span className="small">{r.group}</span> },
    num('total', 'Logged actions'), num('newContacts', 'New contacts'), num('followUps', 'Follow-ups'), num('replies', 'Replies'), num('chats', 'Chats done'), num('apps', 'Applied'),
    { key: 'last', header: 'Last logged', mobile: 'meta', sort: r => r.last ?? '', render: r => r.last ? relDay(dateKey(r.last, tz), today) : <span className="muted">Never</span> },
  ];
  const active = rows.filter(r => r.total > 0).length;
  return (
    <>
      <div className="toolbar">
        <Select ariaLabel="Time period" value={days} onChange={setDays} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: 'all', label: 'All time' }]} />
        <Select ariaLabel="Filter by group" value={groupId} onChange={setGroupId} options={db.groups.map(g => ({ value: g.id, label: g.name }))} placeholder="All groups" />
      </div>
      <p className="callout"><Icon name="info" /><span>Ranked by logged recruiting actions in the period: outreach, follow-ups, replies, chats, applications and interviews. {active} of {rows.length} analysts logged something. Only exec see this ranking; members never see a leaderboard. It reflects what analysts log, not all of their effort.</span></p>
      <DataTable label="Analyst activity ranking" rows={rows} cols={cols} initialSort={{ key: 'rank', dir: 1 }} onOpen={r => go('workspace', { analystId: r.id })} rowLabel={r => `Open ${r.m.name}'s workspace`}
        empty={<Empty title="No analysts in this group" icon="users" />} />
    </>
  );
}
