import React from 'react';
import { repo, useApp } from '../app/store';
import { Button, Chips, Confirm, Field, PageHead, Section, SimTag } from '../ui/kit';
import type { Track } from '../domain/types';
import { TRACKS } from '../domain/types';
import { tzLabel } from '../domain/time';
import * as M from '../domain/mutations';

const ZONES = ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Asia/Hong_Kong', 'Asia/Singapore', 'UTC'];

export function SettingsPage() {
  const { me, act, toast, reset } = useApp();
  const [days, setDays] = React.useState(String(me.followUpDays));
  const [confirm, setConfirm] = React.useState(false);
  const [err, setErr] = React.useState('');
  return (
    <div className="page narrow">
      <PageHead title="Settings" sub={`${me.name} · ${me.email}`} />
      <Section title="Preferences" id="st-pref">
        <div className="form-grid">
          <Field label="Display time zone" required id="st-tz" hint="Times are stored exactly and shown in this zone. Date-only deadlines never shift.">
            <select id="st-tz" className="input" value={me.timezone} onChange={e => { act((d, a) => M.updateSettings(d, a, { timezone: e.target.value })); toast({ text: `Times now shown in ${tzLabel(e.target.value)}.` }); }}>
              {ZONES.map(z => <option key={z} value={z}>{z.replace('_', ' ')} ({tzLabel(z)})</option>)}
            </select>
          </Field>
          <Field label="Suggest a follow-up after" required id="st-days" error={err} hint="Days after outreach with no logged reply. Applies to new outreach.">
            <div className="row-gap">
              <input id="st-days" type="number" min={1} max={30} className="input input-sm w-80" value={days} onChange={e => { setDays(e.target.value); setErr(''); }} />
              <span>days</span>
              <Button size="sm" onClick={() => { const n = +days; if (!Number.isInteger(n) || n < 1 || n > 30) { setErr('Enter a whole number from 1 to 30.'); return; } act((d, a) => M.updateSettings(d, a, { followUpDays: n })); toast({ text: `Follow-ups will be suggested ${n} days after outreach.` }); }}>Save</Button>
            </div>
          </Field>
          <Field label="My recruiting tracks" id="st-tracks" className="span-2" hint="Used as defaults when you add targets and applications. Shown to your mentor.">
            <Chips ariaLabel="My recruiting tracks" options={TRACKS} value={me.tracks} onChange={v => act((d, a) => M.updateSettings(d, a, { tracks: v as Track[] }))} />
          </Field>
        </div>
        <p className="muted small">Reminders are in-app only in this release. Mentors and exec aren’t notified about individual actions.</p>
      </Section>

      <Section title="About this prototype" id="st-about">
        <ul className="sim-list">
          <li><SimTag>Simulated</SimTag> Sign-in. The persona switcher at the top is a demo control, not authentication. Production uses Supabase Auth; roles are set by exec and enforced by database policies.</li>
          <li><SimTag>Simulated</SimTag> Screenshot extraction. The sample import returns fixed rows. Production extracts on the server and stores images privately.</li>
          <li><SimTag>Simulated</SimTag> Permissions. This prototype checks them in the browser. Production enforces them in Postgres row-level security for queries, exports, files and API routes.</li>
          <li><SimTag>Demo data</SimTag> All people, emails, announcements, deadlines and activity are fictional. Firm names are real.</li>
          <li>Out of scope: inbox connections, sending email, automatic applications, SWE recruiting, notes, public rankings and calendar sync.</li>
        </ul>
        <p className="muted small">Storage: {repo.mode === 'local' ? 'saved in this browser only (local storage).' : 'kept in memory only. Changes are lost when you close the page.'}</p>
      </Section>

      <Section title="Demo data" id="st-reset">
        <p>Reset restores the original fictional club data and removes every change made in this browser, for all personas.</p>
        <Button variant="danger" onClick={() => setConfirm(true)}>Reset demo data</Button>
      </Section>
      {confirm && <Confirm title="Reset demo data?" danger confirmLabel="Reset everything" onClose={() => setConfirm(false)} body={<p>All contacts, activity, imports, goals and directory changes you made will be replaced with the original demo data.</p>} onConfirm={reset} />}
    </div>
  );
}
