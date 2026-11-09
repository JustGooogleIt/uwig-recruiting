import React from 'react';
import { useApp } from '../app/store';
import { Badge, Button, Chips, Field, Icon, Modal, Select } from './kit';
import type { ActivityType, AppStage, DB, FirmType, GoalType, Priority, Track } from '../domain/types';
import { ACTIVITY_TYPES, APP_ACTIVITY, APP_STAGES, CONNECTION_SOURCES, CONTACT_ACTIVITY, CYCLES, FIRM_TYPES, GOAL_TYPES, INTERVIEW_TYPES, OPP_TYPES, SENIORITIES, SEED_OFFICES, TRACKS } from '../domain/types';
import * as M from '../domain/mutations';
import { firmName, firmOf, ix, lastActivity, memberName, ownerApps, ownerContacts } from '../domain/derive';
import { visibleFirms } from '../domain/imports';
import { addDays, dateKey, fmtDate, fmtDateTime, todayKey, weekStart, zonedToISO } from '../domain/time';
import { slug } from '../domain/ids';

export function allOffices(db: DB): string[] {
  return Array.from(new Set([...SEED_OFFICES, ...db.firms.flatMap(f => f.offices)])).sort();
}

// ---------- Firm picker with "submit missing firm" ----------
export function FirmPicker({ value, onChange, id, error }: { value: string; onChange: (id: string) => void; id: string; error?: string }) {
  const { db, personaId } = useApp();
  const [submitting, setSubmitting] = React.useState(false);
  const firms = visibleFirms(db, personaId).filter(f => f.status !== 'merged');
  const approved = firms.filter(f => f.status === 'approved').sort((a, b) => a.name.localeCompare(b.name));
  const pending = firms.filter(f => f.status === 'pending' && f.submittedBy === personaId);
  return (
    <Field label="Firm" required id={id} error={error} hint={<>Not listed? <button type="button" className="linkish" onClick={() => setSubmitting(true)}>Submit a missing firm</button></>}>
      <select id={id} className="input" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Choose a firm</option>
        <optgroup label="Firm directory">{approved.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>
        {pending.length > 0 && <optgroup label="Your submissions (pending review)">{pending.map(f => <option key={f.id} value={f.id}>{f.name} (pending)</option>)}</optgroup>}
      </select>
      {submitting && <SubmitFirmModal onClose={() => setSubmitting(false)} onCreated={fid => { onChange(fid); setSubmitting(false); }} />}
    </Field>
  );
}

// ---------- Submit missing firm ----------
export function SubmitFirmModal({ onClose, onCreated, initialName = '' }: { onClose: () => void; onCreated?: (id: string) => void; initialName?: string }) {
  const { db, run, toast, personaId, setPanel } = useApp();
  const [name, setName] = React.useState(initialName);
  const [website, setWebsite] = React.useState('');
  const [type, setType] = React.useState<FirmType>('Bank');
  const [tracks, setTracks] = React.useState<Track[]>([]);
  const [offices, setOffices] = React.useState<string[]>([]);
  const [newOffice, setNewOffice] = React.useState('');
  const [err, setErr] = React.useState('');
  const q = slug(name);
  const matches = q.length >= 2 ? db.firms.filter(f => f.status !== 'merged' && f.status !== 'rejected' && (slug(f.name).includes(q) || q.includes(slug(f.name)) || f.aliases.some(a => slug(a).includes(q)))).slice(0, 5) : [];
  const exact = matches.find(f => slug(f.name) === q || f.aliases.some(a => slug(a) === q));
  const submit = () => {
    if (name.trim().length < 2) { setErr('Enter the firm name.'); return; }
    const f = run((d, a) => M.submitFirm(d, a, { name, website: website || undefined, type, tracks, offices, careersUrl: undefined }));
    if (f) {
      toast({ text: `${f.name} added as pending. You can use it now; exec will review it.` });
      onCreated ? onCreated(f.id) : onClose();
    }
  };
  return (
    <Modal title="Submit a missing firm" onClose={onClose} subtitle="Search first so the directory stays free of duplicates."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!!exact}>Submit for review</Button></>}>
      <div className="form-grid">
        <Field label="Firm name" required id="sf-name" error={err} className="span-2">
          <input id="sf-name" className="input" value={name} onChange={e => { setName(e.target.value); setErr(''); }} autoComplete="off" />
        </Field>
        {matches.length > 0 && (
          <div className="callout span-2" role="status">
            <strong>{exact ? 'This firm is already in the directory.' : 'Possible matches in the directory'}</strong>
            <ul className="plain-list">
              {matches.map(f => (
                <li key={f.id} className="row-between">
                  <span>{f.name} {f.status === 'pending' && <Badge tone="amber">Pending review</Badge>}</span>
                  {onCreated && (f.status === 'approved' || f.submittedBy === personaId)
                    ? <Button size="sm" onClick={() => onCreated(f.id)}>Use this firm</Button>
                    : f.status === 'approved' ? <Button size="sm" onClick={() => { onClose(); setPanel({ kind: 'firm', id: f.id }); }}>View</Button> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Field label="Website" id="sf-site"><input id="sf-site" className="input" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" /></Field>
        <Field label="Firm type" required id="sf-type"><Select id="sf-type" value={type} onChange={setType} options={FIRM_TYPES} /></Field>
        <Field label="Recruiting tracks" id="sf-tracks" className="span-2"><Chips ariaLabel="Recruiting tracks" options={TRACKS} value={tracks} onChange={setTracks} /></Field>
        <Field label="Known offices" id="sf-off" className="span-2" hint="Add any city. The list is not limited to these examples.">
          <Chips ariaLabel="Offices" options={Array.from(new Set([...allOffices(db), ...offices]))} value={offices} onChange={setOffices} />
          <div className="inline-add">
            <input id="sf-off" className="input" value={newOffice} placeholder="Add another office" onChange={e => setNewOffice(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newOffice.trim()) { e.preventDefault(); setOffices([...offices, newOffice.trim()]); setNewOffice(''); } }} />
            <Button size="sm" onClick={() => { if (newOffice.trim()) { setOffices([...offices, newOffice.trim()]); setNewOffice(''); } }}>Add</Button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

// ---------- Log activity ----------
const SCHED: ActivityType[] = ['chat_scheduled', 'interview_scheduled'];
export function LogActivityModal({ init }: { init: { contactId?: string; applicationId?: string; type?: string } }) {
  const { db, personaId, setModal, run, toast, act, tz, setPanel } = useApp();
  const contacts = ownerContacts(db, personaId).slice().sort((a, b) => a.name.localeCompare(b.name));
  const apps = ownerApps(db, personaId);
  const initialType = (init.type as ActivityType) || (init.applicationId ? 'app_submitted' : 'outreach');
  const [type, setType] = React.useState<ActivityType>(initialType);
  const [contactId, setContactId] = React.useState(init.contactId ?? '');
  const [appId, setAppId] = React.useState(init.applicationId ?? '');
  const [date, setDate] = React.useState(todayKey(tz));
  const [time, setTime] = React.useState('');
  const [evDate, setEvDate] = React.useState(addDays(todayKey(tz), 3));
  const [evTime, setEvTime] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const isContact = CONTACT_ACTIVITY.includes(type);
  const prior = isContact && contactId ? M.priorOutreach(db, contactId) : undefined;
  const sameDay = isContact && contactId ? (ix(db).actsByContact.get(contactId) ?? []).find(a => a.type === type && dateKey(a.occurredAt, tz) === date) : undefined;
  const close = () => setModal(null);
  const save = () => {
    const e: Record<string, string> = {};
    if (isContact && !contactId) e.contact = 'Choose a contact.';
    if (!isContact && !appId) e.app = 'Choose an application.';
    if (!date) e.date = 'Enter the date.';
    if (date > todayKey(tz)) e.date = 'Activity dates cannot be in the future. Use “scheduled” types for upcoming events.';
    if (SCHED.includes(type) && !evDate) e.ev = 'Enter when it is scheduled for.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const a = run((d, actor) => M.logActivity(d, actor, { type, contactId: isContact ? contactId : undefined, applicationId: !isContact ? appId : undefined, date, time: time || undefined, eventDate: SCHED.includes(type) ? evDate : undefined, eventTime: evTime || undefined }));
    if (!a) return;
    close();
    const who = isContact ? ix(db).contact.get(contactId)?.name : ix(db).app.get(appId)?.roleTitle;
    toast({ text: `Logged ${ACTIVITY_TYPES[type].toLowerCase()} for ${who}.`, action: { label: 'Undo', run: () => act((d, actor) => M.deleteActivity(d, actor, a.id)) } });
  };
  return (
    <Modal title="Log activity" onClose={close} subtitle="Record what happened. You don’t need to paste message text."
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save}>Log activity</Button></>}>
      <div className="form-grid">
        <Field label="Activity" required id="la-type" className="span-2">
          <select id="la-type" className="input" value={type} onChange={e => setType(e.target.value as ActivityType)}>
            <optgroup label="Networking">{CONTACT_ACTIVITY.map(t => <option key={t} value={t}>{ACTIVITY_TYPES[t]}</option>)}</optgroup>
            <optgroup label="Applications">{APP_ACTIVITY.map(t => <option key={t} value={t}>{ACTIVITY_TYPES[t]}</option>)}</optgroup>
          </select>
        </Field>
        {isContact ? (
          <Field label="Contact" required id="la-contact" error={errors.contact} className="span-2" hint={<button type="button" className="linkish" onClick={() => setModal({ kind: 'addContact', logOutreach: type === 'outreach' })}>Add a new contact instead</button>}>
            <select id="la-contact" className="input" value={contactId} onChange={e => setContactId(e.target.value)}>
              <option value="">Choose a contact</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name} · {firmName(db, c.firmId)}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Application" required id="la-app" error={errors.app} className="span-2">
            <select id="la-app" className="input" value={appId} onChange={e => setAppId(e.target.value)}>
              <option value="">Choose an application</option>
              {apps.map(a => <option key={a.id} value={a.id}>{firmName(db, a.firmId)} · {a.roleTitle}</option>)}
            </select>
          </Field>
        )}
        {type === 'outreach' && prior && (
          <div className="callout warn span-2" role="status">
            <Icon name="alert" />
            <div>
              <strong>You already logged outreach to this contact.</strong> Last: {ACTIVITY_TYPES[prior.type]} on {fmtDateTime(prior.occurredAt, tz, prior.dateOnly)}.
              <div className="callout-actions"><Button size="sm" onClick={() => setType('follow_up')}>Log as follow-up instead</Button></div>
            </div>
          </div>
        )}
        {type === 'follow_up' && contactId && !prior && <div className="callout span-2"><Icon name="info" /><span>No earlier outreach is logged for this contact. Consider logging the initial outreach first.</span></div>}
        {sameDay && <div className="callout warn span-2"><Icon name="alert" /><span>This contact already has “{ACTIVITY_TYPES[type]}” logged on {fmtDate(date)}. Logging again will count it twice.</span></div>}
        <Field label="Date" required id="la-date" error={errors.date}><input id="la-date" type="date" className="input" value={date} max={todayKey(tz)} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Time" id="la-time" hint="Leave blank if you only know the date."><input id="la-time" type="time" className="input" value={time} onChange={e => setTime(e.target.value)} /></Field>
        {SCHED.includes(type) && <>
          <Field label={type === 'chat_scheduled' ? 'Chat date' : 'Interview date'} required id="la-ev" error={errors.ev}><input id="la-ev" type="date" className="input" value={evDate} onChange={e => setEvDate(e.target.value)} /></Field>
          <Field label="Start time" id="la-evt"><input id="la-evt" type="time" className="input" value={evTime} onChange={e => setEvTime(e.target.value)} /></Field>
        </>}
        {type === 'interview_scheduled' && <p className="muted small span-2">To track the round and interview type, use “Schedule interview” on the application.</p>}
      </div>
      {isContact && contactId && <p className="muted small">Viewing contact: <button type="button" className="linkish" onClick={() => { close(); setPanel({ kind: 'contact', id: contactId }); }}>open {ix(db).contact.get(contactId)?.name}</button></p>}
    </Modal>
  );
}

// ---------- Add contact ----------
export function AddContactModal({ init }: { init: { firmId?: string; logOutreach?: boolean; name?: string; email?: string; source?: string } }) {
  const { db, personaId, setModal, run, act, setPanel, toast, tz } = useApp();
  const [f, setF] = React.useState({ name: init.name ?? '', firmId: init.firmId ?? '', title: '', seniority: '', email: init.email ?? '', linkedin: '', office: '', source: init.source ?? 'Cold outreach' });
  const [logNow, setLogNow] = React.useState(init.logOutreach ?? false);
  const [date, setDate] = React.useState(todayKey(tz));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [ack, setAck] = React.useState(false);
  const set = (k: keyof typeof f) => (v: string) => { setF(s => ({ ...s, [k]: v })); setAck(false); };
  const dupes = (f.name.trim().length > 2 || f.email.includes('@')) ? M.findContactDuplicates(db, personaId, f.name, f.firmId, f.email) : [];
  const close = () => setModal(null);
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Enter the contact’s name.';
    if (!f.firmId) e.firm = 'Choose a firm, or submit a missing one.';
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) e.email = 'Enter a valid email or leave it blank.';
    if (f.linkedin && !/^https?:\/\//.test(f.linkedin)) e.linkedin = 'Start the link with https://';
    setErrors(e);
    if (Object.keys(e).length) return;
    if (dupes.length && !ack) { setAck(true); return; }
    const c = run((d, a) => M.addContact(d, a, { name: f.name, firmId: f.firmId, title: f.title, seniority: f.seniority || undefined, email: f.email || undefined, linkedin: f.linkedin || undefined, office: f.office || undefined, source: f.source }));
    if (!c) return;
    if (logNow) act((d, a) => M.logActivity(d, a, { type: 'outreach', contactId: c.id, date })[0]);
    close();
    setPanel({ kind: 'contact', id: c.id });
    toast({ text: logNow ? `Added ${c.name} and logged initial outreach.` : `Added ${c.name}.` });
  };
  return (
    <Modal title="Add contact" onClose={close} wide
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save}>{dupes.length && ack ? 'Add anyway' : 'Add contact'}</Button></>}>
      <div className="form-grid">
        <Field label="Name" required id="ac-name" error={errors.name}><input id="ac-name" className="input" value={f.name} onChange={e => set('name')(e.target.value)} autoComplete="off" /></Field>
        <FirmPicker id="ac-firm" value={f.firmId} onChange={set('firmId')} error={errors.firm} />
        {dupes.length > 0 && (
          <div className={`callout warn span-2 ${ack ? 'strong' : ''}`} role="alert">
            <Icon name="alert" />
            <div>
              <strong>This looks like a contact you already have.</strong>
              <ul className="plain-list">
                {dupes.map(c => {
                  const last = lastActivity(db, c.id);
                  return (
                    <li key={c.id} className="row-between">
                      <span>{c.name} · {firmName(db, c.firmId)}{c.email ? ` · ${c.email}` : ''}. {last ? `Last activity: ${ACTIVITY_TYPES[last.type]} on ${fmtDateTime(last.occurredAt, tz, true)}.` : 'No activity logged yet.'}</span>
                      <Button size="sm" onClick={() => { close(); setPanel({ kind: 'contact', id: c.id }); }}>Open existing</Button>
                    </li>
                  );
                })}
              </ul>
              {ack && <p className="small">Select “Add anyway” to create a separate contact.</p>}
            </div>
          </div>
        )}
        <Field label="Title" id="ac-title"><input id="ac-title" className="input" value={f.title} onChange={e => set('title')(e.target.value)} placeholder="e.g. Analyst" /></Field>
        <Field label="Seniority" id="ac-sen"><Select id="ac-sen" value={f.seniority} onChange={set('seniority')} options={SENIORITIES} placeholder="Not set" /></Field>
        <Field label="Email" id="ac-email" error={errors.email} hint="You can log activity without an email."><input id="ac-email" type="email" className="input" value={f.email} onChange={e => set('email')(e.target.value)} /></Field>
        <Field label="LinkedIn URL" id="ac-li" error={errors.linkedin}><input id="ac-li" className="input" value={f.linkedin} onChange={e => set('linkedin')(e.target.value)} placeholder="https://www.linkedin.com/in/" /></Field>
        <Field label="Office" id="ac-office"><Select id="ac-office" value={f.office} onChange={set('office')} options={allOffices(db)} placeholder="Not set" /></Field>
        <Field label="Connection source" required id="ac-src"><Select id="ac-src" value={f.source} onChange={set('source')} options={CONNECTION_SOURCES} /></Field>
        <div className="span-2 check-row">
          <label className="check"><input type="checkbox" checked={logNow} onChange={e => setLogNow(e.target.checked)} /> Log initial outreach now</label>
          {logNow && <input aria-label="Outreach date" type="date" className="input input-sm" value={date} max={todayKey(tz)} onChange={e => setDate(e.target.value)} />}
        </div>
      </div>
    </Modal>
  );
}

// ---------- Add application ----------
export function AddApplicationModal({ init }: { init: { firmId?: string } }) {
  const { db, personaId, setModal, run, setPanel, toast, tz } = useApp();
  const me = ix(db).member.get(personaId)!;
  const [f, setF] = React.useState({
    firmId: init.firmId ?? '', roleTitle: '', track: (me.tracks[0] ?? 'Investment banking') as Track,
    cycle: 'Summer 2027', office: '', oppType: 'Summer internship', url: '',
    deadline: '', stage: 'Considering' as AppStage, appliedOn: '', nextAction: '', nextActionDue: '', contactIds: [] as string[],
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }));
  const firmContacts = ownerContacts(db, personaId).filter(c => f.firmId && firmOf(db, c.firmId)?.id === firmOf(db, f.firmId)?.id);
  const close = () => setModal(null);
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.firmId) e.firm = 'Choose a firm.';
    if (!f.roleTitle.trim()) e.role = 'Enter the role title.';
    if (f.stage !== 'Considering' && !f.appliedOn) e.applied = 'Enter the date you applied.';
    if (f.url && !/^https?:\/\//.test(f.url)) e.url = 'Start the link with https://';
    setErrors(e);
    if (Object.keys(e).length) return;
    const a = run((d, actor) => M.addApplication(d, actor, { ...f, roleTitle: f.roleTitle.trim(), office: f.office || undefined, url: f.url || undefined, deadline: f.deadline || undefined, appliedOn: f.appliedOn || undefined, nextAction: f.nextAction || undefined, nextActionDue: f.nextActionDue || undefined }));
    if (!a) return;
    close(); setPanel({ kind: 'application', id: a.id });
    toast({ text: `Added ${firmName(db, a.firmId)} · ${a.roleTitle}.` });
  };
  return (
    <Modal title="Add application" onClose={close} wide 
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save}>Add application</Button></>}>
      <div className="form-grid">
        <FirmPicker id="aa-firm" value={f.firmId} onChange={set('firmId')} error={errors.firm} />
        <Field label="Role title" required id="aa-role" error={errors.role}><input id="aa-role" className="input" value={f.roleTitle} onChange={e => set('roleTitle')(e.target.value)} /></Field>
        <Field label="Recruiting track" required id="aa-track"><Select id="aa-track" value={f.track} onChange={set('track')} options={TRACKS} /></Field>
        <Field label="Recruiting cycle" required id="aa-cycle"><Select id="aa-cycle" value={f.cycle} onChange={set('cycle')} options={CYCLES} /></Field>
        <Field label="Office or location" id="aa-office"><Select id="aa-office" value={f.office} onChange={set('office')} options={allOffices(db)} placeholder="Not set" /></Field>
        <Field label="Opportunity type" required id="aa-type"><Select id="aa-type" value={f.oppType} onChange={set('oppType')} options={OPP_TYPES} /></Field>
        <Field label="Application URL" id="aa-url" error={errors.url}><input id="aa-url" className="input" value={f.url} onChange={e => set('url')(e.target.value)} placeholder="https://" /></Field>
        <Field label="Deadline" id="aa-dl" hint="Leave blank if unknown."><input id="aa-dl" type="date" className="input" value={f.deadline} onChange={e => set('deadline')(e.target.value)} /></Field>
        <Field label="Current stage" required id="aa-stage"><Select id="aa-stage" value={f.stage} onChange={set('stage')} options={APP_STAGES} /></Field>
        <Field label="Date applied" id="aa-applied" error={errors.applied} required={f.stage !== 'Considering'}><input id="aa-applied" type="date" className="input" value={f.appliedOn} max={todayKey(tz)} onChange={e => set('appliedOn')(e.target.value)} /></Field>
        <Field label="Next action" id="aa-na"><input id="aa-na" className="input" value={f.nextAction} onChange={e => set('nextAction')(e.target.value)} placeholder="e.g. Complete HireVue" /></Field>
        <Field label="Next action due" id="aa-nad"><input id="aa-nad" type="date" className="input" value={f.nextActionDue} onChange={e => set('nextActionDue')(e.target.value)} /></Field>
        {firmContacts.length > 0 && <Field label="Related contacts" id="aa-con" className="span-2">
          <div className="chips">{firmContacts.map(c => { const on = f.contactIds.includes(c.id); return <button type="button" key={c.id} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set('contactIds')(on ? f.contactIds.filter(x => x !== c.id) : [...f.contactIds, c.id])}>{on && <Icon name="check" size={12} />}{c.name}</button>; })}</div>
        </Field>}
      </div>
    </Modal>
  );
}

// ---------- Add target ----------
export function AddTargetModal({ init }: { init: { firmId?: string } }) {
  const { db, personaId, setModal, run, toast, go } = useApp();
  const me = ix(db).member.get(personaId)!;
  const firm = init.firmId ? firmOf(db, init.firmId) : undefined;
  const [firmId, setFirmId] = React.useState(firm?.id ?? '');
  const f = firmOf(db, firmId);
  const [track, setTrack] = React.useState<Track>((f?.tracks.find(t => me.tracks.includes(t)) ?? f?.tracks[0] ?? me.tracks[0] ?? 'Investment banking') as Track);
  const [cycle, setCycle] = React.useState('Summer 2027');
  const [offices, setOffices] = React.useState<string[]>([]);
  const [priority, setPriority] = React.useState<Priority>('medium');
  const [err, setErr] = React.useState('');
  const close = () => setModal(null);
  const save = () => {
    if (!firmId) { setErr('Choose a firm.'); return; }
    const r = run((d, a) => { const [d2, t, existed] = M.addTarget(d, a, { firmId, track, cycle, offices, priority }); return [d2, { t, existed }]; });
    if (!r) return;
    close();
    toast({ text: r.existed ? `${firmName(db, firmId)} is already a target for this track and cycle.` : `Added ${firmName(db, firmId)} to your targets. No outreach or application was created.`, action: { label: 'View targets', run: () => go('recruiting', { tab: 'targets' }) } });
  };
  const officeOpts = Array.from(new Set([...(f?.offices ?? []), ...offices]));
  return (
    <Modal title="Add to targets" onClose={close} subtitle="A target records your interest in a firm. It does not create an application or log outreach."
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save}>Add target</Button></>}>
      <div className="form-grid">
        {firm ? <div className="span-2"><div className="label">Firm</div><strong>{firm.name}</strong></div> : <FirmPicker id="at-firm" value={firmId} onChange={setFirmId} error={err} />}
        <Field label="Recruiting track" required id="at-track"><Select id="at-track" value={track} onChange={setTrack} options={f?.tracks.length ? f.tracks : TRACKS} /></Field>
        <Field label="Recruiting cycle" required id="at-cycle"><Select id="at-cycle" value={cycle} onChange={setCycle} options={CYCLES} /></Field>
        <Field label="Preferred offices" id="at-off" className="span-2">{officeOpts.length ? <Chips ariaLabel="Preferred offices" options={officeOpts} value={offices} onChange={setOffices} /> : <p className="muted small">No offices listed for this firm yet.</p>}</Field>
        <Field label="Priority" required id="at-pri"><Select id="at-pri" value={priority} onChange={setPriority} options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} /></Field>
      </div>
    </Modal>
  );
}

// ---------- Goals ----------
export function GoalModal({ analystId, goalId }: { analystId: string; goalId?: string }) {
  const { db, setModal, act, toast, tz } = useApp();
  const existing = goalId ? db.goals.find(g => g.id === goalId) : undefined;
  const ws = weekStart(todayKey(tz));
  const [type, setType] = React.useState<GoalType>(existing?.type ?? 'new_contacts');
  const [target, setTarget] = React.useState(String(existing?.target ?? 5));
  const [label, setLabel] = React.useState(existing?.label ?? '');
  const [startOn, setStart] = React.useState(existing?.startOn ?? ws);
  const [dueOn, setDue] = React.useState(existing?.dueOn ?? addDays(ws, 6));
  const [err, setErr] = React.useState('');
  const close = () => setModal(null);
  const save = () => {
    const n = Number(target);
    if (type !== 'prep_task' && (!Number.isInteger(n) || n < 1)) { setErr('Enter a whole number of at least 1.'); return; }
    if (type === 'prep_task' && !label.trim()) { setErr('Describe the preparation task.'); return; }
    if (dueOn < startOn) { setErr('The due date must be on or after the start date.'); return; }
    const ok = existing
      ? act((d, a) => M.updateGoal(d, a, existing.id, { type, target: type === 'prep_task' ? 1 : n, label: type === 'prep_task' ? label.trim() : undefined, startOn, dueOn }))
      : act((d, a) => M.addGoal(d, a, { analystId, type, target: type === 'prep_task' ? 1 : n, label: type === 'prep_task' ? label.trim() : undefined, startOn, dueOn }));
    if (ok) { close(); toast({ text: existing ? 'Goal updated.' : `Goal set for ${memberName(db, analystId)}.` }); }
  };
  return (
    <Modal title={existing ? 'Edit goal' : `Set a goal for ${memberName(db, analystId)}`} onClose={close} subtitle="Activity goals update automatically from logged activity. Preparation tasks are marked complete by hand."
      footer={<>{existing && <Button variant="danger" onClick={() => { if (act((d, a) => M.updateGoal(d, a, existing.id, { cancelled: true }))) { close(); toast({ text: 'Goal cancelled.' }); } }}>Cancel goal</Button>}<span className="spacer" /><Button onClick={close}>Close</Button><Button variant="primary" onClick={save}>{existing ? 'Save goal' : 'Set goal'}</Button></>}>
      <div className="form-grid">
        <Field label="Goal type" required id="g-type" className="span-2"><Select id="g-type" value={type} onChange={setType} options={(Object.keys(GOAL_TYPES) as GoalType[]).map(k => ({ value: k, label: GOAL_TYPES[k] }))} /></Field>
        {type === 'prep_task'
          ? <Field label="Task" required id="g-label" className="span-2" error={err}><input id="g-label" className="input" value={label} onChange={e => { setLabel(e.target.value); setErr(''); }} placeholder="e.g. Build a DCF from scratch" /></Field>
          : <Field label="Target count" required id="g-target" error={err}><input id="g-target" type="number" min={1} className="input" value={target} onChange={e => { setTarget(e.target.value); setErr(''); }} /></Field>}
        <Field label="Start date" required id="g-start"><input id="g-start" type="date" className="input" value={startOn} onChange={e => setStart(e.target.value)} /></Field>
        <Field label="Due date" required id="g-due"><input id="g-due" type="date" className="input" value={dueOn} onChange={e => setDue(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ---------- Mock request ----------
export function MockRequestModal({ mentorId }: { mentorId: string }) {
  const { db, personaId, setModal, act, toast, tz } = useApp();
  const prof = db.mentorProfiles.find(p => p.memberId === mentorId)!;
  const me = ix(db).member.get(personaId)!;
  const [track, setTrack] = React.useState<Track>((prof.tracks.find(t => me.tracks.includes(t)) ?? prof.tracks[0]) as Track);
  const [type, setType] = React.useState(prof.interviewTypes[0] ?? 'Behavioral');
  const [firmId, setFirmId] = React.useState('');
  const [mode, setMode] = React.useState<'time' | 'link'>(prof.schedulingUrl ? 'link' : 'time');
  const [date, setDate] = React.useState(addDays(todayKey(tz), 3));
  const [time, setTime] = React.useState('18:00');
  const close = () => setModal(null);
  const save = () => {
    const ok = act((d, a) => M.requestMock(d, a, { mentorId, track, interviewType: type, targetFirmId: firmId || undefined, proposedTime: mode === 'time' ? zonedToISO(date, time, tz) : undefined, schedulingLink: mode === 'link' ? prof.schedulingUrl : undefined }));
    if (ok) { close(); toast({ text: `Mock request sent to ${memberName(db, mentorId)}. They will see it under Mock Interviews.` }); }
  };
  return (
    <Modal title={`Request a mock with ${memberName(db, mentorId)}`} onClose={close} subtitle="The mentor sees this request only. It does not share your recruiting workspace."
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save}>Send request</Button></>}>
      <div className="form-grid">
        <Field label="Track" required id="mr-track"><Select id="mr-track" value={track} onChange={setTrack} options={prof.tracks} /></Field>
        <Field label="Interview type" required id="mr-type"><Select id="mr-type" value={type} onChange={setType} options={INTERVIEW_TYPES.filter(t => prof.interviewTypes.includes(t)).length ? INTERVIEW_TYPES.filter(t => prof.interviewTypes.includes(t)) : INTERVIEW_TYPES} /></Field>
        <Field label="Target firm" id="mr-firm" className="span-2"><select id="mr-firm" className="input" value={firmId} onChange={e => setFirmId(e.target.value)}><option value="">No specific firm</option>{visibleFirms(db, personaId).filter(f => f.status === 'approved').sort((a, b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
        <fieldset className="span-2 radio-set">
          <legend>Timing</legend>
          <label className="check"><input type="radio" name="mr-mode" checked={mode === 'time'} onChange={() => setMode('time')} /> Propose a time</label>
          <label className="check"><input type="radio" name="mr-mode" checked={mode === 'link'} disabled={!prof.schedulingUrl} onChange={() => setMode('link')} /> Use the mentor’s scheduling link {!prof.schedulingUrl && <span className="muted">(none listed)</span>}</label>
        </fieldset>
        {mode === 'time' ? <>
          <Field label="Date" required id="mr-date"><input id="mr-date" type="date" className="input" value={date} min={todayKey(tz)} onChange={e => setDate(e.target.value)} /></Field>
          <Field label="Time" required id="mr-time"><input id="mr-time" type="time" className="input" value={time} onChange={e => setTime(e.target.value)} /></Field>
        </> : <p className="span-2 small">Book through <a href={prof.schedulingUrl} target="_blank" rel="noreferrer">{prof.schedulingUrl}</a>, then send this request so the mentor can confirm. <span className="demo-tag">Demo link</span></p>}
      </div>
    </Modal>
  );
}
