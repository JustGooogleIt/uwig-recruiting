import React from 'react';
import { useApp } from '../app/store';
import { Badge, Button, DemoTag, Empty, Icon, PageHead, SearchInput, Select, StageBadge, Tabs } from '../ui/kit';
import type { MockRequest, MockStatus } from '../domain/types';
import { INTERVIEW_TYPES, TRACKS } from '../domain/types';
import { firmName, groupOf, ix, memberName } from '../domain/derive';
import { addDays, dateKey, fmtDateTime, timeKey, todayKey, zonedToISO } from '../domain/time';
import * as M from '../domain/mutations';

export function MocksPage() {
  const { db, personaId, tab, setTab } = useApp();
  const isMentor = db.mentorProfiles.some(p => p.memberId === personaId);
  const incoming = db.mockRequests.filter(m => m.mentorId === personaId);
  const mine = db.mockRequests.filter(m => m.requesterId === personaId);
  const t = (tab as 'find' | 'mine' | 'incoming') ?? 'find';
  const tabs: { id: 'find' | 'mine' | 'incoming'; label: string; count?: number }[] = [
    { id: 'find', label: 'Find a mentor' },
    { id: 'mine', label: 'My requests', count: mine.filter(m => ['Requested', 'Accepted', 'Scheduled'].includes(m.status)).length },
  ];
  if (isMentor) tabs.push({ id: 'incoming', label: 'Requests to me', count: incoming.filter(m => ['Requested', 'Accepted', 'Scheduled'].includes(m.status)).length });
  return (
    <div className="page">
      <PageHead title="Mock Interviews" sub="Request a mock from any mentor, including outside your group. A request shares only what you put in it." />
      <Tabs label="Mock interviews" value={t} onChange={setTab} tabs={tabs} />
      <div role="tabpanel" aria-labelledby={`tab-${t}`} className="tabpanel">
        {t === 'find' && <FindMentor />}
        {t === 'mine' && <RequestList rows={mine} side="requester" />}
        {t === 'incoming' && isMentor && <RequestList rows={incoming} side="mentor" />}
      </div>
    </div>
  );
}

function FindMentor() {
  const { db, personaId, setModal } = useApp();
  const [q, setQ] = React.useState('');
  const [track, setTrack] = React.useState('');
  const [type, setType] = React.useState('');
  const [firm, setFirm] = React.useState('');
  const [avail, setAvail] = React.useState('');
  const myMentor = groupOf(db, personaId)?.mentorId;
  const allFirms = Array.from(new Set(db.mentorProfiles.flatMap(p => [...p.firmsInterviewed, ...p.firmsWorked]))).sort();
  const profiles = db.mentorProfiles.filter(p => p.memberId !== personaId && ix(db).member.get(p.memberId)?.active)
    .filter(p => (!track || p.tracks.includes(track as never)) && (!type || p.interviewTypes.includes(type)) && (!firm || p.firmsInterviewed.includes(firm) || p.firmsWorked.includes(firm)) && (!avail || p.availability === avail)
      && (!q || memberName(db, p.memberId).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (a.memberId === myMentor ? -1 : b.memberId === myMentor ? 1 : 0) || (a.availability === 'Not available' ? 1 : 0) - (b.availability === 'Not available' ? 1 : 0) || memberName(db, a.memberId).localeCompare(memberName(db, b.memberId)));
  return (
    <>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search mentors" id="mk-q" />
        <Select ariaLabel="Filter by track" value={track} onChange={setTrack} options={TRACKS} placeholder="All tracks" />
        <Select ariaLabel="Filter by interview type" value={type} onChange={setType} options={INTERVIEW_TYPES} placeholder="Any interview type" />
        <Select ariaLabel="Filter by firm" value={firm} onChange={setFirm} options={allFirms} placeholder="Any firm" />
        <Select ariaLabel="Filter by availability" value={avail} onChange={setAvail} options={['Available', 'Limited', 'Not available']} placeholder="Any availability" />
      </div>
      {profiles.length === 0 ? <Empty title="No mentors match these filters" icon="search">Try a broader track or interview type.</Empty> : (
        <ul className="mentor-grid">
          {profiles.map(p => (
            <li key={p.memberId} className="mentor-card">
              <div className="row-between">
                <div><strong>{memberName(db, p.memberId)}</strong><div className="muted small">Recruited {p.recruitingYear} · {ix(db).member.get(p.memberId)?.role === 'exec' ? 'Exec' : 'Mentor'}</div></div>
                <span className="row-gap">{p.memberId === myMentor && <Badge tone="gold">Your mentor</Badge>}<Badge tone={p.availability === 'Available' ? 'green' : p.availability === 'Limited' ? 'amber' : 'neutral'}>{p.availability}</Badge></span>
              </div>
              <dl className="kv tight">
                <div><dt>Tracks</dt><dd>{p.tracks.join(', ')}</dd></div>
                <div><dt>Interview types</dt><dd>{p.interviewTypes.join(', ')}</dd></div>
                <div><dt>Interviewed with</dt><dd>{p.firmsInterviewed.join(', ')}</dd></div>
                <div><dt>Worked at</dt><dd>{p.firmsWorked.join(', ')}</dd></div>
              </dl>
              <div className="row-between">
                {p.schedulingUrl ? <a className="small" href={p.schedulingUrl} target="_blank" rel="noreferrer">Scheduling link <Icon name="ext" size={12} /></a> : <span className="muted small">No scheduling link</span>}
                <Button size="sm" variant="primary" disabled={p.availability === 'Not available'} onClick={() => setModal({ kind: 'mock', mentorId: p.memberId })}>Request mock</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Scheduling links are <DemoTag>demo links</DemoTag>. There is no calendar integration in the first release.</p>
    </>
  );
}

function RequestList({ rows, side }: { rows: MockRequest[]; side: 'requester' | 'mentor' }) {
  const { db, act, tz, toast } = useApp();
  const [scheduling, setScheduling] = React.useState<string | null>(null);
  const [when, setWhen] = React.useState({ date: addDays(todayKey(tz), 2), time: '18:00' });
  const sorted = rows.slice().sort((a, b) => order(a.status) - order(b.status) || b.updatedAt.localeCompare(a.updatedAt));
  const set = (m: MockRequest, s: MockStatus, at?: string) => { if (act((d, a) => M.setMockStatus(d, a, m.id, s, at))) toast({ text: `Request ${s.toLowerCase()}.` }); };
  if (!rows.length) return <Empty title={side === 'mentor' ? 'No requests yet' : 'You haven’t requested a mock'} icon="mic">{side === 'requester' ? 'Find a mentor and send a request. Completed mocks count toward mock-interview goals.' : 'Requests from any member appear here.'}</Empty>;
  return (
    <ul className="req-list">
      {sorted.map(m => (
        <li key={m.id} className="req">
          <div className="req-main">
            <div className="row-gap"><strong>{side === 'mentor' ? memberName(db, m.requesterId) : memberName(db, m.mentorId)}</strong><StageBadge s={m.status} /></div>
            <div className="small">{m.track} · {m.interviewType}{m.targetFirmId ? ` · ${firmName(db, m.targetFirmId)}` : ''}</div>
            <div className="muted small">
              {m.scheduledAt ? <>Scheduled {fmtDateTime(m.scheduledAt, tz)}</> : m.proposedTime ? <>Proposed {fmtDateTime(m.proposedTime, tz)}</> : m.schedulingLink ? <>Booking through scheduling link</> : null}
              {' · '}Updated {fmtDateTime(m.updatedAt, tz, true)}
            </div>
          </div>
          <div className="req-actions">
            {scheduling === m.id ? (
              <span className="row-gap">
                <input aria-label="Mock date" type="date" className="input input-sm" value={when.date} onChange={e => setWhen({ ...when, date: e.target.value })} />
                <input aria-label="Mock time" type="time" className="input input-sm" value={when.time} onChange={e => setWhen({ ...when, time: e.target.value })} />
                <Button size="sm" variant="primary" onClick={() => { set(m, 'Scheduled', zonedToISO(when.date, when.time, tz)); setScheduling(null); }}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setScheduling(null)}>Cancel</Button>
              </span>
            ) : <>
              {side === 'mentor' && m.status === 'Requested' && <><Button size="sm" variant="primary" onClick={() => set(m, 'Accepted')}>Accept</Button><Button size="sm" onClick={() => set(m, 'Declined')}>Decline</Button></>}
              {(m.status === 'Accepted' || (m.status === 'Requested' && side === 'mentor')) && <Button size="sm" onClick={() => { setScheduling(m.id); if (m.proposedTime) setWhen({ date: dateKey(m.proposedTime, tz), time: timeKey(m.proposedTime, tz) }); }}>Schedule</Button>}
              {side === 'mentor' && m.status === 'Scheduled' && <Button size="sm" variant="primary" icon="check" onClick={() => set(m, 'Completed')}>Mark completed</Button>}
              {['Requested', 'Accepted', 'Scheduled'].includes(m.status) && <Button size="sm" variant="ghost" onClick={() => set(m, 'Cancelled')}>Cancel request</Button>}
            </>}
          </div>
        </li>
      ))}
    </ul>
  );
}
const order = (s: MockStatus) => ['Requested', 'Accepted', 'Scheduled', 'Completed', 'Declined', 'Cancelled'].indexOf(s);
