// Import review logic shared by screenshot and CSV imports.
// SIMULATED: the prototype never reads image pixels. `sampleExtraction` returns fixed demo rows.
// In production, images go to private storage and a server route runs extraction with the
// API key kept server-side; the review/match logic below is reused unchanged.
import type { ActivityType, DB, DateOnly, ExtractedRow } from './types';
import { ACTIVITY_TYPES } from './types';
import { contactActs, firmOf, ownerContacts } from './derive';
import { addDays, dateKey, todayKey } from './time';
import { firmEmailDomain } from './seed';
import { slug } from './ids';

export interface RawRow {
  screenshot?: string; name: string; email?: string; firmText?: string;
  type: ActivityType | ''; date?: DateOnly; dateHint?: string; subject?: string; automated?: boolean;
}

export const SAMPLE_SCREENSHOTS = [
  { id: 's1', label: 'Sent folder (1 of 3)', folder: 'Sent' },
  { id: 's2', label: 'Sent folder, scrolled (2 of 3, overlaps 1)', folder: 'Sent' },
  { id: 's3', label: 'Inbox (3 of 3)', folder: 'Inbox' },
];

/** Fixed demo extraction. Clearly labeled as simulated wherever it is shown. */
export function sampleExtraction(tz: string): RawRow[] {
  const t = todayKey(tz);
  return [
    { screenshot: 's1', name: 'Maya Chen', email: 'maya.chen@goldmansachs.example', type: 'follow_up', date: addDays(t, -1), subject: 'Re: UW student interested in GS TMT' },
    { screenshot: 's1', name: 'Noah Fischer', email: 'noah.fischer@lazard.example', type: 'outreach', date: addDays(t, -2), subject: 'UW Investment Group: quick question' },
    { screenshot: 's1', name: 'Grace Park', email: 'grace.park@moelis.example', type: 'outreach', dateHint: 'Tue', subject: 'Coffee chat request from a UW sophomore' },
    { screenshot: 's2', name: 'Noah Fischer', email: 'noah.fischer@lazard.example', type: 'outreach', date: addDays(t, -2), subject: 'UW Investment Group: quick question' },
    { screenshot: 's2', name: 'Marcus Johnson', email: 'marcus.johnson@jpmorgan.example', type: 'outreach', date: addDays(t, -1), subject: 'Fellow Husky interested in J.P. Morgan IB' },
    { screenshot: 's2', name: 'Alex Romero', email: 'alex.romero@mail.example', type: 'outreach', date: addDays(t, -1), subject: 'Intro from UWIG' },
    { screenshot: 's2', name: 'Ethan Brooks', email: 'ethan.brooks@centerview.example', type: 'outreach', date: addDays(t, -3), subject: 'Centerview SF: UW student' },
    { screenshot: 's3', name: 'Daniel Okafor', email: 'daniel.okafor@evercore.example', type: 'reply', date: t, subject: 'Re: Following up: UW student' },
    { screenshot: 's3', name: 'Ethan Brooks', email: 'ethan.brooks@centerview.example', type: 'reply', date: addDays(t, -2), subject: 'Automatic reply: Out of office until Monday', automated: true },
  ];
}

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

export function visibleFirms(db: DB, viewerId: string) {
  return db.firms.filter(f => f.status === 'approved' || (f.status === 'pending' && (f.submittedBy === viewerId || db.members.find(m => m.id === viewerId)?.role === 'exec')));
}
export function matchFirmText(db: DB, viewerId: string, text?: string, email?: string): string | undefined {
  const firms = visibleFirms(db, viewerId);
  if (text) {
    const t = slug(text);
    const f = firms.find(x => slug(x.name) === t || x.aliases.some(a => slug(a) === t)) ?? firms.find(x => t.length > 3 && (slug(x.name).includes(t) || t.includes(slug(x.name))));
    if (f) return f.id;
  }
  if (email) {
    const dom = email.split('@')[1]?.toLowerCase();
    const f = firms.find(x => firmEmailDomain(x.name) === dom);
    if (f) return f.id;
  }
  return undefined;
}

/** Turn raw extracted rows into review rows: firm/contact matching, overlaps, already-logged and automated replies. */
export function analyzeRows(db: DB, ownerId: string, raws: RawRow[], tz: string): ExtractedRow[] {
  const mine = ownerContacts(db, ownerId);
  const seen = new Map<string, string>();
  const confirmedKeys = new Set(db.importBatches.filter(b => b.ownerId === ownerId && b.status === 'confirmed').flatMap(b => b.rowKeys));
  return raws.map((r, i) => {
    const content = [r.name.toLowerCase(), r.email?.toLowerCase() ?? '', r.type, r.date ?? r.dateHint ?? '', r.subject ?? ''].join('|');
    const sig = hash(content);
    const duplicateOf = seen.get(sig);
    if (!duplicateOf) seen.set(sig, `r${i}`);
    const firmId = matchFirmText(db, ownerId, r.firmText, r.email);
    const row: ExtractedRow = {
      key: duplicateOf ? `${sig}~${i}` : sig, include: true, screenshot: r.screenshot,
      contactName: r.name, email: r.email, firmId, firmText: r.firmText, type: r.type, date: r.date, dateHint: r.dateHint, subject: r.subject,
      automated: r.automated, duplicateOf,
    };
    const exact = r.email && mine.find(c => c.email?.toLowerCase() === r.email!.toLowerCase());
    if (exact) { row.matchContactId = exact.id; row.matchedBy = 'email'; row.firmId = firmOf(db, exact.firmId)?.id; }
    else if (firmId) {
      const s = mine.find(c => c.name.toLowerCase() === r.name.toLowerCase() && firmOf(db, c.firmId)?.id === firmId);
      if (s) row.suggestedContactId = s.id;
    }
    if (row.matchContactId && row.type && row.date) {
      const prior = contactActs(db, row.matchContactId).find(a => a.type === row.type && dateKey(a.occurredAt, tz) === row.date);
      if (prior) row.alreadyLoggedOn = row.date;
    }
    if (confirmedKeys.has(row.key)) row.alreadyImported = true;
    if (row.automated || row.duplicateOf || row.alreadyLoggedOn || row.alreadyImported) row.include = false;
    return row;
  });
}

export interface RowIssue { level: 'error' | 'warn' | 'info'; text: string }
export function rowStatus(db: DB, row: ExtractedRow, rows: ExtractedRow[]): { match: string; issues: RowIssue[] } {
  const issues: RowIssue[] = [];
  let match = 'New contact';
  if (row.automated) { match = 'Automatic reply'; issues.push({ level: 'info', text: 'Automatic reply. Automatic replies are not counted as replies.' }); }
  if (row.duplicateOf) {
    const n = rows.findIndex((_, i) => `r${i}` === row.duplicateOf) + 1;
    match = 'Duplicate'; issues.push({ level: 'info', text: `Same message as row ${n} (overlapping screenshots). Excluded so it is counted once.` });
  }
  if (row.alreadyLoggedOn) { match = 'Already logged'; issues.push({ level: 'info', text: 'You already logged this activity for this contact on this date.' }); }
  if (row.alreadyImported) { match = 'Already imported'; issues.push({ level: 'info', text: 'This row was confirmed in an earlier import. Confirming again would not add it twice.' }); }
  const c = row.matchContactId ? db.contacts.find(x => x.id === row.matchContactId) : undefined;
  if (c && !row.duplicateOf && !row.alreadyLoggedOn && !row.automated && !row.alreadyImported) match = row.matchedBy === 'email' ? 'Existing contact (exact email)' : 'Existing contact (you confirmed)';
  if (row.suggestedContactId && !row.matchedBy) {
    const s = db.contacts.find(x => x.id === row.suggestedContactId);
    if (!row.suggestionDecision) { match = 'Possible match'; issues.push({ level: 'error', text: `Possible match: ${s?.name} at ${firmOf(db, s?.firmId)?.name}. Choose the existing contact or create a new one.` }); }
    else if (row.suggestionDecision === 'new') match = 'New contact (you chose)';
  }
  if (row.include) {
    if (!row.contactName.trim()) issues.push({ level: 'error', text: 'Contact name is not visible. Enter it.' });
    if (!row.matchContactId && !row.firmId) issues.push({ level: 'error', text: 'Firm not visible in the screenshot. Choose a firm.' });
    if (!row.type) issues.push({ level: 'error', text: 'Choose the activity type.' });
    if (!row.date) issues.push({ level: 'error', text: row.dateHint ? `Screenshot shows “${row.dateHint}”, which could be more than one date. Confirm the date.` : 'Date is not visible. Enter it.' });
    if (row.type === 'reply' && SAMPLE_SCREENSHOTS.find(x => x.id === row.screenshot)?.folder === 'Sent') issues.push({ level: 'warn', text: 'This came from a Sent folder screenshot, which does not show a reply.' });
    if (!row.email && !row.matchContactId) issues.push({ level: 'info', text: 'No email visible. The contact will be saved without one.' });
  }
  return { match, issues };
}
export function rowBlocking(db: DB, row: ExtractedRow, rows: ExtractedRow[]) {
  return row.include && rowStatus(db, row, rows).issues.some(i => i.level === 'error');
}

// ---------------- CSV ----------------
export function parseCSV(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(c => c.trim())) out.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some(c => c.trim())) out.push(row);
  return out.map(r => r.map(c => c.trim()));
}
export const CSV_FIELDS = [
  { key: 'name', label: 'Contact name', guess: /name|contact/i },
  { key: 'firm', label: 'Firm', guess: /firm|company|bank/i },
  { key: 'email', label: 'Email', guess: /e-?mail/i },
  { key: 'type', label: 'Activity type', guess: /type|activity|action|status/i },
  { key: 'date', label: 'Date', guess: /date|when|sent/i },
] as const;
export function parseActivityType(s: string): ActivityType | '' {
  const t = s.toLowerCase();
  if (!t) return '';
  if (/auto/.test(t)) return '';
  if (/follow/.test(t)) return 'follow_up';
  if (/repl|respon/.test(t)) return 'reply';
  if (/complet|had|done/.test(t) && /chat|coffee|call/.test(t)) return 'chat_completed';
  if (/sched|book/.test(t) && /chat|coffee|call/.test(t)) return 'chat_scheduled';
  if (/outreach|sent|email|cold|initial/.test(t)) return 'outreach';
  const exact = (Object.entries(ACTIVITY_TYPES) as [ActivityType, string][]).find(([, l]) => l.toLowerCase() === t);
  return exact ? exact[0] : '';
}
export function parseDate(s: string): DateOnly | undefined {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  return undefined;
}
export function csvToRaw(rows: string[][], mapping: Record<string, number>): RawRow[] {
  return rows.slice(1).map(r => {
    const get = (k: string) => (mapping[k] >= 0 ? r[mapping[k]] ?? '' : '');
    const dateText = get('date');
    const date = parseDate(dateText);
    return { name: get('name'), firmText: get('firm') || undefined, email: get('email') || undefined, type: parseActivityType(get('type')), date, dateHint: !date && dateText ? dateText : undefined, automated: /auto/i.test(get('type')) };
  });
}
export function sampleCSV(tz: string) {
  const t = todayKey(tz);
  return `Name,Company,Email,Activity,Date
Lena Moreau,Bain & Company,lena.moreau@bain.example,Initial outreach,${addDays(t, -1)}
Omar Haddad,Jefferies,,Cold email sent,${addDays(t, -2)}
Maya Chen,Goldman Sachs,maya.chen@goldmansachs.example,Follow-up,last week
Jules Park,Unknown Capital Partners,jules@mail.example,Reply received,${addDays(t, -1)}
`;
}
