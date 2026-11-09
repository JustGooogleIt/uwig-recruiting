import React from 'react';
import { useApp } from '../app/store';
import { Badge, Button, Col, DataTable, Empty, Icon, PageHead, SearchInput, Select } from '../ui/kit';
import type { Firm } from '../domain/types';
import { FIRM_TYPES, TRACKS } from '../domain/types';
import { firmOf } from '../domain/derive';
import { visibleFirms } from '../domain/imports';
import { fmtDate } from '../domain/time';
import { slug } from '../domain/ids';
import { allOffices, SubmitFirmModal } from '../ui/forms';

export function FirmsPage() {
  const { db, personaId, setPanel, setModal } = useApp();
  const [q, setQ] = React.useState('');
  const [type, setType] = React.useState('');
  const [track, setTrack] = React.useState('');
  const [office, setOffice] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const firms = visibleFirms(db, personaId).filter(f => f.status === 'approved' || (f.status === 'pending' && f.submittedBy === personaId));
  const myTargets = new Set(db.targets.filter(t => t.ownerId === personaId && t.state === 'active').map(t => firmOf(db, t.firmId)?.id));
  const sq = slug(q);
  const rows = firms.filter(f => (!q || slug(f.name).includes(sq) || f.aliases.some(a => slug(a).includes(sq))) && (!type || f.type === type) && (!track || f.tracks.includes(track as never)) && (!office || f.offices.includes(office)));
  const cols: Col<Firm>[] = [
    { key: 'name', header: 'Firm', mobile: 'title', sort: f => f.name, render: f => <span className="cell-strong">{f.name} {f.status === 'pending' && <Badge tone="amber">Pending review</Badge>}</span> },
    { key: 'type', header: 'Type', mobile: 'sub', sort: f => f.type, render: f => f.type },
    { key: 'tracks', header: 'Recruiting tracks', mobile: 'meta', render: f => <span className="small">{f.tracks.join(', ') || '—'}</span> },
    { key: 'offices', header: 'Offices', mobile: 'meta', render: f => <span className="small">{f.offices.join(', ') || '—'}</span> },
    { key: 'ver', header: 'Verified', mobile: 'hide', sort: f => f.lastVerified ?? '', render: f => f.lastVerified ? fmtDate(f.lastVerified) : <span className="muted">Not yet</span> },
    { key: 'act', header: '', mobile: 'hide', render: f => myTargets.has(f.id) ? <Badge tone="green"><Icon name="check" size={12} /> In targets</Badge> : <Button size="sm" onClick={() => setModal({ kind: 'addTarget', firmId: f.id })}>Add to targets</Button> },
  ];
  return (
    <div className="page">
      <PageHead title="Explore Firms" sub="A shared directory for discovery. Your contacts and applications stay in My Recruiting."
        actions={<Button icon="plus" onClick={() => setSubmitting(true)}>Submit missing firm</Button>} />
      <p className="callout"><Icon name="info" /><span>{firms.filter(f => f.status === 'approved').length} firms. Exec add firms from their lists, and any member can submit one that is missing. Look up open roles on each firm's own careers page; exec post opportunities that come to the club under Announcements.</span></p>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search firms or aliases" id="fx-q" />
        <Select ariaLabel="Filter by firm type" value={type} onChange={setType} options={FIRM_TYPES} placeholder="All firm types" />
        <Select ariaLabel="Filter by track" value={track} onChange={setTrack} options={TRACKS} placeholder="All tracks" />
        <Select ariaLabel="Filter by office" value={office} onChange={setOffice} options={allOffices(db)} placeholder="All offices" />
      </div>
      <DataTable label="Firm directory" rows={rows} cols={cols} initialSort={{ key: 'name', dir: 1 }} pageSize={50} onOpen={f => setPanel({ kind: 'firm', id: f.id })}
        empty={<Empty title="No firms match" icon="search" action={<Button size="sm" onClick={() => setSubmitting(true)}>Submit {q ? `“${q}”` : 'a missing firm'}</Button>}>Check the spelling or clear filters. If the firm is missing, submit it and use it right away.</Empty>} />
      {submitting && <SubmitFirmModal initialName={q} onClose={() => setSubmitting(false)} onCreated={id => { setSubmitting(false); setPanel({ kind: 'firm', id }); }} />}
    </div>
  );
}
