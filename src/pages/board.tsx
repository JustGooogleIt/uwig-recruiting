import React from 'react';
import { useApp } from '../app/store';
import { Badge, Button, Chips, DemoTag, Empty, Field, Icon, Modal, PageHead, SearchInput, Select } from '../ui/kit';
import { FirmPicker } from '../ui/forms';
import type { Announcement, Track } from '../domain/types';
import { TRACKS } from '../domain/types';
import { firmName, firmOf, ix, memberName } from '../domain/derive';
import { addDays, fmtDate, fmtDateTime, relDay, todayKey } from '../domain/time';
import * as M from '../domain/mutations';

/** Exec-posted opportunities and club news. Members read; exec post, pin, edit and archive. */
export function BoardPage() {
  const { db, me, setModal } = useApp();
  const [q, setQ] = React.useState('');
  const [track, setTrack] = React.useState('');
  const [showArchived, setShowArchived] = React.useState(false);
  const isExec = me.role === 'exec';
  const items = db.announcements
    .filter(a => (showArchived ? a.archived : !a.archived))
    .filter(a => !track || a.tracks.includes(track as Track) || a.tracks.length === 0)
    .filter(a => !q || [a.title, a.body, a.contactName ?? '', a.firmId ? firmName(db, a.firmId) : ''].some(s => s.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="page narrow-wide">
      <PageHead title="Announcements" sub="Opportunities and news posted by exec, often from firms that reach out to the club."
        actions={isExec && <Button variant="primary" icon="plus" onClick={() => setModal({ kind: 'announce' })}>Post announcement</Button>} />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search announcements" id="an-q" />
        <Select ariaLabel="Filter by track" value={track} onChange={setTrack} options={TRACKS} placeholder="All tracks" />
        {isExec && <label className="check"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived</label>}
      </div>
      {items.length === 0 ? <Empty title={showArchived ? 'No archived announcements' : 'No announcements yet'} icon="flag">{isExec ? 'Post an opportunity when a firm reaches out, so every member sees it in one place.' : 'Exec posts opportunities here when firms reach out to the club.'}</Empty> : (
        <ul className="ann-list">{items.map(a => <AnnouncementCard key={a.id} a={a} />)}</ul>
      )}
    </div>
  );
}

export function AnnouncementCard({ a, compact }: { a: Announcement; compact?: boolean }) {
  const { db, me, setModal, act, toast, tz, setPanel, go } = useApp();
  const author = ix(db).member.get(a.authorId);
  const isExec = me.role === 'exec';
  const today = todayKey(tz);
  const firm = a.firmId ? firmOf(db, a.firmId) : undefined;
  const inTargets = firm && db.targets.some(t => t.ownerId === me.id && t.state === 'active' && firmOf(db, t.firmId)?.id === firm.id);
  const copy = (text: string) => { navigator.clipboard?.writeText(text).then(() => toast({ text: 'Email copied.' }), () => toast({ text: 'Select the email to copy it.' })); };
  return (
    <li className={`ann ${a.pinned ? 'pinned' : ''} ${compact ? 'compact' : ''}`}>
      <div className="ann-head">
        <span className="avatar sm" aria-hidden="true">{author?.name.split(' ').map(s => s[0]).join('')}</span>
        <div className="grow">
          <div className="row-gap wrap"><strong>{author?.name ?? 'Exec'}</strong>{author?.title && <span className="muted small">{author.title}</span>}<span className="muted small">· {fmtDateTime(a.createdAt, tz)}</span></div>
        </div>
        <span className="row-gap">{a.pinned && <Badge tone="gold">Pinned</Badge>}{a.demo && <DemoTag />}</span>
      </div>
      <h3 className="ann-title">{compact ? <button className="linkish plain" onClick={() => go('board')}>{a.title}</button> : a.title}</h3>
      {!compact && <div className="ann-body">{a.body.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>}
      {compact && <p className="small muted clamp">{a.body}</p>}
      <dl className="ann-meta">
        {firm && <div><dt>Firm</dt><dd><button className="linkish" onClick={() => setPanel({ kind: 'firm', id: firm.id })}>{firm.name}</button></dd></div>}
        {a.contactName && <div><dt>Contact</dt><dd>{a.contactName}{a.contactEmail && <> · <span className="selectable">{a.contactEmail}</span> {!compact && <button className="icon-btn" aria-label="Copy email" onClick={() => copy(a.contactEmail!)}><Icon name="file" size={13} /></button>}</>}</dd></div>}
        {a.deadline && <div><dt>Deadline</dt><dd className={a.deadline < today ? 'text-danger' : ''}>{fmtDate(a.deadline, { year: true })} {a.deadline >= today && a.deadline <= addDays(today, 14) && <span className="muted">({relDay(a.deadline, today)})</span>}</dd></div>}
        {a.tracks.length > 0 && <div><dt>Tracks</dt><dd>{a.tracks.join(', ')}</dd></div>}
        {a.link && <div><dt>Link</dt><dd><a href={a.link} target="_blank" rel="noreferrer">{a.link.replace(/^https?:\/\//, '')} <Icon name="ext" size={12} /></a></dd></div>}
      </dl>
      {!compact && (
        <div className="row-gap wrap">
          {a.contactName && <Button size="sm" icon="user" onClick={() => setModal({ kind: 'addContact', firmId: firm?.id, name: a.contactName, email: a.contactEmail, source: 'Club event' })}>Save contact</Button>}
          {firm && !inTargets && <Button size="sm" icon="target" onClick={() => setModal({ kind: 'addTarget', firmId: firm.id })}>Add firm to targets</Button>}
          {firm && <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'addApplication', firmId: firm.id })}>Track as application</Button>}
          {isExec && <>
            <span className="spacer" />
            <Button size="sm" variant="ghost" icon="edit" onClick={() => setModal({ kind: 'announce', id: a.id })}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => act((d, x) => M.updateAnnouncement(d, x, a.id, { pinned: !a.pinned }))}>{a.pinned ? 'Unpin' : 'Pin'}</Button>
            <Button size="sm" variant="ghost" onClick={() => { act((d, x) => M.updateAnnouncement(d, x, a.id, { archived: !a.archived })); toast({ text: a.archived ? 'Announcement restored.' : 'Announcement archived. Members no longer see it.' }); }}>{a.archived ? 'Restore' : 'Archive'}</Button>
          </>}
        </div>
      )}
      {!compact && a.updatedAt !== a.createdAt && <p className="muted small">Edited {fmtDateTime(a.updatedAt, tz)} · posted by {memberName(db, a.authorId)}</p>}
    </li>
  );
}

export function AnnounceModal({ id }: { id?: string }) {
  const { db, setModal, act, toast } = useApp();
  const ex = id ? db.announcements.find(a => a.id === id) : undefined;
  const [f, setF] = React.useState({
    title: ex?.title ?? '', body: ex?.body ?? '', firmId: ex?.firmId ?? '', contactName: ex?.contactName ?? '', contactEmail: ex?.contactEmail ?? '',
    link: ex?.link ?? '', tracks: ex?.tracks ?? ([] as Track[]), deadline: ex?.deadline ?? '', pinned: ex?.pinned ?? false,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }));
  const close = () => setModal(null);
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = 'Add a title.';
    if (!f.body.trim()) e.body = 'Describe the opportunity.';
    if (f.contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contactEmail)) e.email = 'Enter a valid email or leave it blank.';
    if (f.link && !/^https?:\/\//.test(f.link)) e.link = 'Start the link with https://';
    setErrors(e);
    if (Object.keys(e).length) return;
    const input = { ...f, firmId: f.firmId || undefined, contactName: f.contactName.trim() || undefined, contactEmail: f.contactEmail.trim() || undefined, link: f.link.trim() || undefined, deadline: f.deadline || undefined };
    const ok = ex ? act((d, a) => M.updateAnnouncement(d, a, ex.id, input)) : act((d, a) => M.postAnnouncement(d, a, input));
    if (ok) { close(); toast({ text: ex ? 'Announcement updated.' : 'Announcement posted. Members see it under Announcements and on their Overview.' }); }
  };
  return (
    <Modal title={ex ? 'Edit announcement' : 'Post an announcement'} onClose={close} wide subtitle="Members see this in Announcements. No emails or notifications are sent."
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save}>{ex ? 'Save' : 'Post'}</Button></>}>
      <div className="form-grid">
        <Field label="Title" required id="an-title" error={errors.title} className="span-2"><input id="an-title" className="input" value={f.title} onChange={e => set('title')(e.target.value)} placeholder="e.g. Internship opportunity: wealth management" /></Field>
        <Field label="Details" required id="an-body" error={errors.body} className="span-2"><textarea id="an-body" className="input" rows={6} value={f.body} onChange={e => set('body')(e.target.value)} placeholder="What the role is, who it suits, and how to express interest." /></Field>
        <FirmPicker id="an-firm" value={f.firmId} onChange={set('firmId')} />
        <Field label="Deadline" id="an-dl"><input id="an-dl" type="date" className="input" value={f.deadline} onChange={e => set('deadline')(e.target.value)} /></Field>
        <Field label="Contact name" id="an-cn"><input id="an-cn" className="input" value={f.contactName} onChange={e => set('contactName')(e.target.value)} /></Field>
        <Field label="Contact email" id="an-ce" error={errors.email}><input id="an-ce" type="email" className="input" value={f.contactEmail} onChange={e => set('contactEmail')(e.target.value)} /></Field>
        <Field label="Link" id="an-link" error={errors.link} className="span-2"><input id="an-link" className="input" value={f.link} onChange={e => set('link')(e.target.value)} placeholder="https://" /></Field>
        <Field label="Relevant tracks" id="an-tracks" className="span-2" hint="Leave empty if it applies to everyone."><Chips ariaLabel="Relevant tracks" options={TRACKS} value={f.tracks} onChange={set('tracks')} /></Field>
        <label className="check span-2"><input type="checkbox" checked={f.pinned} onChange={e => set('pinned')(e.target.checked)} /> Pin to the top</label>
      </div>
    </Modal>
  );
}
