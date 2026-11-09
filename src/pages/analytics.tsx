import React from 'react';
import { useApp } from '../app/store';
import { Section } from '../ui/kit';
import { APP_STAGES } from '../domain/types';
import type { Period } from '../domain/derive';
import { cohort, goalCompletion, periodTotals, pipeline } from '../domain/derive';
import { fmtDate, fmtDateTime } from '../domain/time';

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : 'No data');

export function Ratio({ label, n, d, note }: { label: string; n: number; d: number; note?: string }) {
  return (
    <div className="ratio">
      <div className="ratio-l">{label}</div>
      <div className="ratio-v">{pct(n, d)}</div>
      <div className="ratio-c">{d ? `${n} of ${d} contacts` : 'No eligible contacts in this period'}</div>
      {note && <div className="ratio-n">{note}</div>}
    </div>
  );
}

export function CohortCard({ ownerIds, period, title }: { ownerIds: string[]; period: Period; title: string }) {
  const { db, tz } = useApp();
  const c = cohort(db, ownerIds, period, tz);
  return (
    <Section title={title} id={`cohort-${title.replace(/\W/g, '')}`} aside={<span className="pill-note">Based on logged replies</span>}>
      <div className="ratios">
        <Ratio label="Response rate" n={c.replied} d={c.size} />
        <Ratio label="Chat conversion" n={c.chatted} d={c.size} />
      </div>
      <p className="muted small">Cohort: contacts whose first logged outreach was {fmtDate(period.start)} to {fmtDate(period.end)}. Replies observed through {fmtDateTime(c.cutoff, tz)}. Automatic replies are not counted.</p>
    </Section>
  );
}

export function AnalyticsBlock({ ownerIds, period, scopeLabel }: { ownerIds: string[]; period: Period; scopeLabel: string }) {
  const { db, tz } = useApp();
  const t = periodTotals(db, ownerIds, period, tz);
  const g = goalCompletion(db, ownerIds, period, tz);
  const pipe = pipeline(db, ownerIds);
  const cycles = Array.from(pipe.keys()).sort();
  return (
    <div className="analytics">
      <Section title={`Activity totals · ${period.label}`} id="an-totals" aside={<span className="muted small">{scopeLabel} · {fmtDate(period.start)} to {fmtDate(period.end)}</span>}>
        <div className="stat-row">
          <div className="stat"><span className="stat-v">{t.newContacts}</span><span className="stat-l">New outreach</span><span className="stat-h">Contacts receiving their first logged outreach</span></div>
          <div className="stat"><span className="stat-v">{t.followUps}</span><span className="stat-l">Follow-ups</span><span className="stat-h">Follow-up activities logged</span></div>
          <div className="stat"><span className="stat-v">{t.chats}</span><span className="stat-l">Completed chats</span><span className="stat-h">Coffee chats marked completed</span></div>
          <div className="stat"><span className="stat-v">{g.due ? pct(g.done, g.due) : 'No data'}</span><span className="stat-l">Goal completion</span><span className="stat-h">{g.due ? `${g.done} of ${g.due} goals due were met on time` : 'No goals were due in this period'}</span></div>
        </div>
        <p className="muted small">Totals count events in the period. They are not divided by each other; conversion rates use the outreach cohort below.</p>
      </Section>
      <CohortCard ownerIds={ownerIds} period={period} title="Outreach cohort conversion" />
      <Section title="Application pipeline" id="an-pipe" aside={<span className="muted small">Current stage, all cycles</span>}>
        {cycles.length === 0 ? <p className="muted">No data. No applications logged.</p> : (
          <div className="table-wrap">
            <table className="table pipe">
              <thead><tr><th>Cycle</th>{APP_STAGES.map(s => <th key={s} className="num">{s}</th>)}</tr></thead>
              <tbody>{cycles.map(c => <tr key={c}><th scope="row">{c}</th>{APP_STAGES.map(s => <td key={s} className="num">{pipe.get(c)![s] ?? <span className="muted">0</span>}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
