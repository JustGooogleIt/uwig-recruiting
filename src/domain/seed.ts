// Fictional demo data. All people, email addresses, announcements, deadlines and activity are invented.
// Firm names are real (seed list plus the exec-provided list in firmList.ts).
import type {
  Activity, ActivityType, Application, AppStage, Contact, DB, Firm, FirmType, Goal, GroupAssignment, InterviewEvent,
  Announcement, Member, MentorGroup, MentorProfile, MockRequest, Target, Task, Track,
} from './types';
import { CYCLES, INTERVIEW_TYPES } from './types';
import { addDays, dateKey, DEFAULT_TZ, todayKey, weekStart, zonedToISO } from './time';
import { rng, slug } from './ids';
import { EXEC_FIRMS } from './firmList';

export const DB_VERSION = 4;
export const DEMO_PERSONAS = { analyst: 'mem_avery', mentor: 'mem_jordan', exec: 'mem_sam' };

const FIRST = ['Avery', 'Jordan', 'Sam', 'Riley', 'Morgan', 'Casey', 'Taylor', 'Jamie', 'Quinn', 'Reese', 'Rowan', 'Skyler', 'Parker', 'Emerson', 'Hayden', 'Kai', 'Logan', 'Micah', 'Nico', 'Sasha', 'Ari', 'Dev', 'Ira', 'Jules', 'Lane', 'Remy', 'Sage', 'Tatum', 'Wren', 'Blake', 'Cameron', 'Drew', 'Elliot', 'Finley', 'Harper', 'Isa', 'Jesse', 'Kendall', 'Leo', 'Mina', 'Nadia', 'Omar', 'Priya', 'Ravi', 'Sofia', 'Theo', 'Uma', 'Vera', 'Wes', 'Yara', 'Zane', 'Anika', 'Ben', 'Chloe', 'Diego', 'Elena', 'Felix', 'Grace', 'Hugo', 'Iris', 'Jonah', 'Kira', 'Lena', 'Mateo', 'Noor', 'Owen', 'Paloma', 'Rafael', 'Selin', 'Tomas', 'Vivian', 'Yusuf', 'Zoe', 'Aditi', 'Bryce', 'Celeste', 'Dmitri', 'Esme', 'Farah', 'Gideon'];
const LAST = ['Kim', 'Patel', 'Rivera', 'Nguyen', 'Chen', 'Okafor', 'Garcia', 'Lee', 'Shah', 'Martin', 'Brooks', 'Alvarez', 'Wang', 'Singh', 'Hughes', 'Park', 'Tran', 'Lopez', 'Fischer', 'Romero', 'Nakamura', 'Osei', 'Kowalski', 'Haddad', 'Bauer', 'Mendes', 'Ibrahim', 'Larsen', 'Moreau', 'Sato', 'Reyes', 'Dubois', 'Costa', 'Novak', 'Ahmed', 'Bianchi', 'Cohen', 'Duarte', 'Eriksen', 'Flores', 'Gupta', 'Hale', 'Iyer', 'Jensen', 'Khan', 'Lindqvist', 'Mehta', 'Nash', 'Ortiz', 'Pham'];
const TITLES = ['Analyst', 'Analyst', 'Associate', 'Associate', 'Vice President', 'Senior Analyst', 'Director', 'Investment Analyst', 'Research Associate'];

type FirmSeed = [string, FirmType, Track[], string[], string];
const FIRMS: FirmSeed[] = [
  ['Goldman Sachs', 'Bank', ['Investment banking', 'Sales and trading', 'Asset management / investment research'], ['New York', 'San Francisco', 'Chicago'], 'goldmansachs.com'],
  ['Morgan Stanley', 'Bank', ['Investment banking', 'Sales and trading', 'Equity research'], ['New York', 'San Francisco'], 'morganstanley.com'],
  ['J.P. Morgan', 'Bank', ['Investment banking', 'Sales and trading', 'Equity research', 'Asset management / investment research'], ['New York', 'San Francisco', 'Chicago', 'Seattle'], 'jpmorganchase.com'],
  ['Bank of America', 'Bank', ['Investment banking', 'Sales and trading', 'Equity research'], ['New York', 'Charlotte', 'San Francisco'], 'bankofamerica.com'],
  ['Wells Fargo', 'Bank', ['Investment banking', 'Sales and trading'], ['Charlotte', 'New York', 'San Francisco'], 'wellsfargo.com'],
  ['Truist Securities', 'Bank', ['Investment banking'], ['Charlotte'], 'truist.com'],
  ['Evercore', 'Bank', ['Investment banking'], ['New York', 'San Francisco'], 'evercore.com'],
  ['Lazard', 'Bank', ['Investment banking', 'Asset management / investment research'], ['New York', 'San Francisco', 'Chicago'], 'lazard.com'],
  ['Centerview Partners', 'Bank', ['Investment banking'], ['New York', 'San Francisco'], 'centerviewpartners.com'],
  ['PJT Partners', 'Bank', ['Investment banking'], ['New York', 'San Francisco'], 'pjtpartners.com'],
  ['Moelis & Company', 'Bank', ['Investment banking'], ['New York', 'San Francisco', 'Chicago'], 'moelis.com'],
  ['Houlihan Lokey', 'Bank', ['Investment banking'], ['New York', 'San Francisco', 'Chicago'], 'hl.com'],
  ['Jefferies', 'Bank', ['Investment banking', 'Equity research', 'Sales and trading'], ['New York', 'San Francisco', 'Chicago'], 'jefferies.com'],
  ['William Blair', 'Bank', ['Investment banking', 'Equity research', 'Asset management / investment research'], ['Chicago', 'San Francisco'], 'williamblair.com'],
  ['Piper Sandler', 'Bank', ['Investment banking', 'Equity research'], ['New York', 'Chicago', 'San Francisco'], 'pipersandler.com'],
  ['D.A. Davidson', 'Bank', ['Investment banking', 'Equity research'], ['Seattle'], 'dadavidson.com'],
  ['Citadel', 'Hedge fund', ['Quant trading / research', 'Asset management / investment research'], ['Chicago', 'New York'], 'citadel.com'],
  ['Jane Street', 'Other', ['Quant trading / research'], ['New York'], 'janestreet.com'],
  ['Two Sigma', 'Hedge fund', ['Quant trading / research'], ['New York'], 'twosigma.com'],
  ['Capital Group', 'Asset manager', ['Asset management / investment research'], ['San Francisco', 'New York'], 'capitalgroup.com'],
  ['Dodge & Cox', 'Asset manager', ['Asset management / investment research'], ['San Francisco'], 'dodgeandcox.com'],
  ['Russell Investments', 'Asset manager', ['Asset management / investment research'], ['Seattle', 'New York'], 'russellinvestments.com'],
  ['Parametric', 'Asset manager', ['Asset management / investment research', 'Quant trading / research'], ['Seattle'], 'parametricportfolio.com'],
  ['Fisher Investments', 'Asset manager', ['Asset management / investment research'], ['Seattle'], 'fisherinvestments.com'],
  ['Blackstone', 'Private equity firm', ['Private equity', 'Asset management / investment research'], ['New York', 'San Francisco'], 'blackstone.com'],
  ['KKR', 'Private equity firm', ['Private equity'], ['New York', 'San Francisco'], 'kkr.com'],
  ['TPG', 'Private equity firm', ['Private equity'], ['San Francisco', 'New York'], 'tpg.com'],
  ['Hellman & Friedman', 'Private equity firm', ['Private equity'], ['San Francisco', 'New York'], 'hf.com'],
  ['Madrona Venture Group', 'Venture capital firm', ['Venture capital'], ['Seattle'], 'madrona.com'],
  ['Sequoia Capital', 'Venture capital firm', ['Venture capital'], ['San Francisco'], 'sequoiacap.com'],
  ['Andreessen Horowitz', 'Venture capital firm', ['Venture capital'], ['San Francisco', 'New York'], 'a16z.com'],
  ['Morningstar', 'Research firm', ['Equity research'], ['Chicago', 'New York'], 'morningstar.com'],
  ['McKinsey & Company', 'Consulting firm', ['Consulting'], ['Seattle', 'San Francisco', 'New York', 'Chicago'], 'mckinsey.com'],
  ['Boston Consulting Group', 'Consulting firm', ['Consulting'], ['Seattle', 'San Francisco', 'New York', 'Chicago'], 'bcg.com'],
  ['Bain & Company', 'Consulting firm', ['Consulting'], ['Seattle', 'San Francisco', 'New York', 'Chicago'], 'bain.com'],
  ['Deloitte', 'Consulting firm', ['Consulting'], ['Seattle', 'San Francisco', 'New York', 'Chicago', 'Charlotte'], 'deloitte.com'],
];
export const firmEmailDomain = (name: string) => `${slug(name).replace(/andcompany|company|partners|group|capital|investments/g, '') || slug(name)}.example`;

const ROLE_BY_TRACK: Record<Track, string> = {
  'Investment banking': 'Investment Banking Summer Analyst',
  'Equity research': 'Equity Research Summer Analyst',
  'Sales and trading': 'Sales & Trading Summer Analyst',
  'Asset management / investment research': 'Investment Research Summer Intern',
  'Private equity': 'Private Equity Summer Analyst',
  'Venture capital': 'Venture Capital Summer Associate',
  'Quant trading / research': 'Quantitative Trading Intern',
  Consulting: 'Summer Business Analyst',
};

export function seedDB(): DB {
  const R = rng(20261109);
  const tz = DEFAULT_TZ;
  const today = todayKey(tz);
  const now = new Date().toISOString();
  const at = (daysAgo: number, time = '10:00') => zonedToISO(addDays(today, -daysAgo), time, tz);
  const d = (offset: number) => addDays(today, offset);
  const created = at(60);

  // ---------- Firms & opportunities ----------
  const firms: Firm[] = FIRMS.map(([name, type, tracks, offices, site], i) => ({
    id: `firm_${slug(name)}`, name, type, tracks, offices, website: `https://www.${site}`, careersUrl: `https://www.${site}/careers`,
    status: 'approved', aliases: name === 'J.P. Morgan' ? ['JPMorgan', 'JPMorgan Chase'] : name === 'Boston Consulting Group' ? ['BCG'] : [],
    lastVerified: d(-(5 + (i * 7) % 50)), createdAt: created,
  }));
  firms.push({ id: 'firm_cascadiaridge', name: 'Cascadia Ridge Capital', type: 'Hedge fund', tracks: ['Asset management / investment research'], offices: ['Seattle'], website: 'https://cascadiaridge.example', status: 'pending', aliases: [], submittedBy: 'mem_riley', createdAt: at(3) });
  firms.push({ id: 'firm_jpmorganchase', name: 'JPMorgan Chase & Co.', type: 'Bank', tracks: ['Investment banking'], offices: ['Seattle'], status: 'pending', aliases: [], submittedBy: 'mem_a3', createdAt: at(2) });
  const F = (name: string) => firms.find(f => f.name === name)!.id;

  for (const [name, type, tracks] of EXEC_FIRMS) {
    const id = `firm_${slug(name)}`;
    if (!firms.some(f => f.id === id)) firms.push({ id, name, type, tracks, offices: [], status: 'approved', aliases: [], source: 'Exec firm list', createdAt: created });
  }

  // ---------- Members ----------
  const members: Member[] = [];
  const mk = (id: string, name: string, role: Member['role'], classYear: number, tracks: Track[], title?: string) =>
    members.push({ id, name, title, email: `${name.toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.')}@uwig-demo.example`, role, classYear, tracks, timezone: tz, followUpDays: 7, active: true, createdAt: created });
  mk('mem_sam', 'Sam Rivera', 'exec', 2027, ['Investment banking'], 'President');
  mk('mem_morgan', 'Morgan Nguyen', 'exec', 2027, ['Private equity'], 'VP of Recruiting');
  mk('mem_casey', 'Casey Shah', 'exec', 2027, ['Asset management / investment research'], 'Director of Advancement');
  mk('mem_taylor', 'Taylor Hughes', 'exec', 2028, ['Consulting'], 'VP of Membership');
  mk('mem_jamie', 'Jamie Martin', 'exec', 2028, ['Sales and trading'], 'Treasurer');
  mk('mem_jordan', 'Jordan Patel', 'mentor', 2027, ['Investment banking', 'Private equity']);
  const used = new Set(members.map(m => m.name));
  const nameGen = (seedOffset: number) => {
    for (let k = 0; k < 500; k++) {
      const n = `${FIRST[(seedOffset * 7 + k * 13) % FIRST.length]} ${LAST[(seedOffset * 11 + k * 3) % LAST.length]}`;
      if (!used.has(n)) { used.add(n); return n; }
    }
    return `Member ${seedOffset}`;
  };
  const mentorTracks: Track[][] = [
    ['Investment banking'], ['Equity research', 'Asset management / investment research'], ['Sales and trading'], ['Private equity', 'Investment banking'],
    ['Venture capital'], ['Quant trading / research'], ['Consulting'], ['Investment banking'], ['Asset management / investment research'],
    ['Consulting'], ['Investment banking', 'Equity research'], ['Sales and trading', 'Quant trading / research'], ['Investment banking'], ['Private equity'],
  ];
  for (let i = 0; i < 14; i++) mk(`mem_m${i}`, nameGen(i + 3), 'mentor', R.pick([2026, 2027]), mentorTracks[i]);
  mk('mem_avery', 'Avery Kim', 'analyst', 2028, ['Investment banking', 'Asset management / investment research']);
  mk('mem_riley', 'Riley Okafor', 'analyst', 2028, ['Asset management / investment research']);
  const analystTrackPool: Track[] = ['Investment banking', 'Investment banking', 'Investment banking', 'Equity research', 'Sales and trading', 'Asset management / investment research', 'Private equity', 'Venture capital', 'Quant trading / research', 'Consulting', 'Consulting'];
  for (let i = 0; i < 78; i++) {
    const t1 = R.pick(analystTrackPool);
    const tracks = R.chance(0.4) ? Array.from(new Set([t1, R.pick(analystTrackPool)])) : [t1];
    mk(`mem_a${i}`, nameGen(i + 40), 'analyst', R.pick([2028, 2028, 2029]), tracks);
  }

  // ---------- Groups ----------
  const mentors = members.filter(m => m.role === 'mentor');
  const groups: MentorGroup[] = mentors.map((m, i) => ({ id: `grp_${i}`, name: `${m.name.split(' ')[1]} group`, mentorId: m.id, createdAt: created }));
  const analysts = members.filter(m => m.role === 'analyst');
  const assignments: GroupAssignment[] = [];
  const jordanGroup = groups.find(g => g.mentorId === 'mem_jordan')!;
  const jordanAnalysts = ['mem_avery', 'mem_riley', 'mem_a0', 'mem_a1', 'mem_a2'];
  for (const a of analysts) {
    let gid: string;
    if (jordanAnalysts.includes(a.id)) gid = jordanGroup.id;
    else {
      const idx = +a.id.slice(5);
      gid = groups.filter(g => g !== jordanGroup)[idx % 14].id;
    }
    assignments.push({ analystId: a.id, groupId: gid, assignedAt: created, assignedBy: 'mem_sam' });
  }

  // ---------- Mentor profiles ----------
  const allFirmNames = FIRMS.map(f => f[0]);
  const mentorProfiles: MentorProfile[] = [...mentors, ...members.filter(m => m.role === 'exec').slice(0, 2)].map((m, i) => {
    const trackFirms = FIRMS.filter(f => f[2].some(t => m.tracks.includes(t))).map(f => f[0]);
    const pool = trackFirms.length ? trackFirms : allFirmNames;
    const types = m.tracks.includes('Consulting') ? ['Case', 'Behavioral'] : m.tracks.includes('Quant trading / research') ? ['Quantitative', 'Markets', 'Behavioral'] :
      m.tracks.includes('Sales and trading') ? ['Markets', 'Behavioral'] : m.tracks.some(t => t.startsWith('Asset') || t === 'Equity research') ? ['Stock pitch', 'Valuation', 'Behavioral'] : ['Accounting', 'Valuation', 'Behavioral'];
    return {
      memberId: m.id, tracks: m.tracks, firmsInterviewed: R.sample(pool, 4), interviewTypes: types, recruitingYear: m.classYear - 2,
      firmsWorked: R.sample(pool, R.int(1, 2)), availability: i % 5 === 3 ? 'Limited' : i % 7 === 6 ? 'Not available' : 'Available',
      schedulingUrl: i % 3 === 0 ? `https://cal.example/${slug(m.name)}-mocks` : undefined,
    };
  });
  const jp = mentorProfiles.find(p => p.memberId === 'mem_jordan')!;
  Object.assign(jp, { firmsInterviewed: ['Goldman Sachs', 'Evercore', 'Centerview Partners', 'Blackstone'], firmsWorked: ['Evercore'], interviewTypes: ['Accounting', 'Valuation', 'Behavioral'], availability: 'Available', schedulingUrl: 'https://cal.example/jordan-patel-mocks' });

  // ---------- Personal recruiting data ----------
  const targets: Target[] = [], contacts: Contact[] = [], applications: Application[] = [], interviews: InterviewEvent[] = [], activities: Activity[] = [], goals: Goal[] = [];
  let n = 0;
  const id = (p: string) => `${p}_s${(++n).toString(36)}`;
  const act = (ownerId: string, type: ActivityType, occurredAt: string, extra: Partial<Activity> = {}) => {
    const a: Activity = { id: id('act'), ownerId, type, occurredAt, dateOnly: false, source: 'manual', createdAt: occurredAt, ...extra };
    activities.push(a); return a;
  };
  const contactEmail = (name: string, firmId: string) => `${name.toLowerCase().replace(' ', '.').replace(/[^a-z.]/g, '')}@${firmEmailDomain(firms.find(f => f.id === firmId)!.name)}`;

  // Avery Kim: hand-built so every acceptance criterion has data to act on.
  const A = 'mem_avery';
  ([['Goldman Sachs', 'Investment banking', ['New York', 'San Francisco'], 'high'], ['Evercore', 'Investment banking', ['San Francisco'], 'high'],
    ['Centerview Partners', 'Investment banking', ['San Francisco'], 'high'], ['Morgan Stanley', 'Investment banking', ['New York'], 'medium'],
    ['Russell Investments', 'Asset management / investment research', ['Seattle'], 'medium'], ['J.P. Morgan', 'Investment banking', ['New York', 'Seattle'], 'low'],
    ['Lazard', 'Investment banking', ['San Francisco'], 'medium']] as const).forEach(([f, t, o, p]) =>
    targets.push({ id: id('tgt'), ownerId: A, firmId: F(f), track: t, cycle: 'Summer 2027', offices: [...o], priority: p, state: 'active', createdAt: at(30) }));
  targets.push({ id: id('tgt'), ownerId: A, firmId: F('Bank of America'), track: 'Investment banking', cycle: 'Summer 2027', offices: ['Charlotte'], priority: 'low', state: 'archived', createdAt: at(40) });
  const ac = (name: string, firm: string, title: string, extra: Partial<Contact> = {}) => {
    const c: Contact = { id: id('con'), ownerId: A, name, firmId: F(firm), title, source: 'Cold outreach', closed: false, createdAt: at(35), ...extra };
    contacts.push(c); return c;
  };
  const maya = ac('Maya Chen', 'Goldman Sachs', 'Analyst', { email: 'maya.chen@goldmansachs.example', seniority: 'Analyst', office: 'San Francisco', linkedin: 'https://www.linkedin.com/in/demo-maya-chen' });
  act(A, 'outreach', at(9, '09:15'), { contactId: maya.id });
  const daniel = ac('Daniel Okafor', 'Evercore', 'Associate', { email: 'daniel.okafor@evercore.example', seniority: 'Associate', source: 'UW alumni', office: 'San Francisco' });
  act(A, 'outreach', at(12, '08:40'), { contactId: daniel.id });
  act(A, 'follow_up', at(5, '08:30'), { contactId: daniel.id });
  const priya = ac('Priya Natarajan', 'Morgan Stanley', 'Vice President', { seniority: 'VP', source: 'Referral', office: 'New York' });
  act(A, 'outreach', at(8, '11:00'), { contactId: priya.id });
  act(A, 'reply', at(6, '14:20'), { contactId: priya.id });
  act(A, 'chat_scheduled', at(6, '15:00'), { contactId: priya.id, eventAt: zonedToISO(d(2), '15:30', tz) });
  const ethan = ac('Ethan Brooks', 'Centerview Partners', 'Analyst', { email: 'ethan.brooks@centerview.example', seniority: 'Analyst', office: 'San Francisco' });
  act(A, 'outreach', at(3, '10:05'), { contactId: ethan.id });
  const hannah = ac('Hannah Lee', 'Russell Investments', 'Investment Analyst', { email: 'hannah.lee@russell.example', source: 'Club event', office: 'Seattle' });
  act(A, 'outreach', at(16, '09:00'), { contactId: hannah.id });
  act(A, 'reply', at(14, '13:00'), { contactId: hannah.id });
  act(A, 'chat_scheduled', at(14, '13:30'), { contactId: hannah.id, eventAt: at(1, '12:00') });
  act(A, 'chat_completed', at(1, '12:45'), { contactId: hannah.id });
  ac('Marcus Johnson', 'J.P. Morgan', 'Associate', { seniority: 'Associate', office: 'New York', source: 'UW alumni' });
  const sofia = ac('Sofia Alvarez', 'Lazard', 'Analyst', { email: 'sofia.alvarez@lazard.example', source: 'UW alumni', office: 'San Francisco' });
  act(A, 'outreach', at(22, '09:30'), { contactId: sofia.id });
  act(A, 'follow_up', at(15, '09:30'), { contactId: sofia.id });
  act(A, 'reply', at(13, '17:10'), { contactId: sofia.id });
  act(A, 'chat_scheduled', at(13, '17:30'), { contactId: sofia.id, eventAt: at(10, '16:00') });
  act(A, 'chat_completed', at(10, '16:40'), { contactId: sofia.id });
  const kai = ac('Kai Nakamura', 'Goldman Sachs', 'Associate', { email: 'kai.nakamura@goldmansachs.example', office: 'New York' });
  act(A, 'outreach', at(30, '09:30'), { contactId: kai.id });
  act(A, 'follow_up', at(22, '09:30'), { contactId: kai.id });
  kai.closed = true;

  const app = (o: string, firm: string, extra: Partial<Application>): Application => {
    const a: Application = { id: id('app'), ownerId: o, firmId: F(firm), roleTitle: 'Investment Banking Summer Analyst', track: 'Investment banking', cycle: 'Summer 2027', oppType: 'Summer internship', stage: 'Considering', contactIds: [], createdAt: at(25), ...extra };
    applications.push(a); return a;
  };
  const gs = app(A, 'Goldman Sachs', { office: 'San Francisco', stage: 'Applied', appliedOn: d(-8), nextAction: 'Complete HireVue', nextActionDue: d(3), contactIds: [maya.id], url: 'https://www.goldmansachs.com/careers/demo' });
  act(A, 'app_submitted', at(8, '22:10'), { applicationId: gs.id });
  const ev = app(A, 'Evercore', { office: 'San Francisco', stage: 'First round', appliedOn: d(-18), nextAction: 'Review technicals guide', nextActionDue: d(2), contactIds: [daniel.id] });
  act(A, 'app_submitted', at(18, '20:00'), { applicationId: ev.id });
  const evInt = zonedToISO(d(3), '10:30', tz);
  interviews.push({ id: id('int'), ownerId: A, applicationId: ev.id, round: 'First round', type: 'Behavioral', scheduledAt: evInt, status: 'scheduled', createdAt: at(4) });
  act(A, 'interview_scheduled', at(4, '16:00'), { applicationId: ev.id, eventAt: evInt });
  app(A, 'Russell Investments', { roleTitle: 'Investment Research Summer Intern', track: 'Asset management / investment research', office: 'Seattle', deadline: d(10), nextAction: 'Draft stock pitch one-pager', nextActionDue: d(6) });
  app(A, 'Centerview Partners', { office: 'San Francisco', deadline: d(5), contactIds: [ethan.id] });
  const ws = app(A, 'Wells Fargo', { office: 'Charlotte', stage: 'Rejected', appliedOn: d(-35) });
  act(A, 'app_submitted', at(35), { applicationId: ws.id });
  act(A, 'app_closed', at(20), { applicationId: ws.id });

  const wk = weekStart(today);
  goals.push(
    { id: id('goal'), analystId: A, setById: 'mem_jordan', type: 'new_contacts', target: 5, startOn: addDays(today, -5), dueOn: addDays(today, 6), cancelled: false, createdAt: at(1) },
    { id: id('goal'), analystId: A, setById: 'mem_jordan', type: 'chats_completed', target: 2, startOn: addDays(wk, -7), dueOn: addDays(wk, 6), cancelled: false, createdAt: at(8) },
    { id: id('goal'), analystId: A, setById: 'mem_jordan', type: 'applications_submitted', target: 3, startOn: addDays(today, -20), dueOn: addDays(today, 10), cancelled: false, createdAt: at(20) },
    { id: id('goal'), analystId: A, setById: 'mem_jordan', type: 'prep_task', target: 1, label: 'Finish the accounting section of the technicals guide', startOn: addDays(today, -6), dueOn: addDays(today, 4), cancelled: false, createdAt: at(6) },
    { id: id('goal'), analystId: A, setById: 'mem_jordan', type: 'follow_ups', target: 2, startOn: addDays(wk, -21), dueOn: addDays(wk, -15), cancelled: false, createdAt: at(25) },
  );

  // Everyone else: generated activity with varied engagement.
  const personal = members.filter(m => m.id !== A);
  for (const m of personal) {
    const engagement = m.role !== 'analyst' ? 0.35 : R.pick([0, 0.3, 0.6, 0.6, 0.9, 1, 1, 1.2]);
    const trackFirms = firms.filter(f => f.status === 'approved' && f.tracks.some(t => m.tracks.includes(t)));
    const tfirms = R.sample(trackFirms.length ? trackFirms : firms.filter(f => f.status === 'approved'), R.int(2, 5));
    for (const f of tfirms) targets.push({ id: id('tgt'), ownerId: m.id, firmId: f.id, track: f.tracks.find(t => m.tracks.includes(t)) ?? f.tracks[0], cycle: 'Summer 2027', offices: R.sample(f.offices, 1), priority: R.pick(['high', 'medium', 'low']), state: 'active', createdAt: at(40) });
    if (m.id === 'mem_riley') targets.push({ id: id('tgt'), ownerId: m.id, firmId: 'firm_cascadiaridge', track: 'Asset management / investment research', cycle: 'Summer 2027', offices: ['Seattle'], priority: 'high', state: 'active', createdAt: at(3) });
    const nContacts = Math.round(R.int(2, 8) * engagement);
    const quiet = engagement > 0 && R.chance(0.12); // some members logged nothing recently
    for (let k = 0; k < nContacts; k++) {
      const f = R.pick(tfirms);
      const cname = `${R.pick(FIRST)} ${R.pick(LAST)}`;
      const c: Contact = { id: id('con'), ownerId: m.id, name: cname, firmId: f.id, title: R.pick(TITLES), email: R.chance(0.75) ? contactEmail(cname, f.id) : undefined, office: R.pick(f.offices), source: R.pick(['Cold outreach', 'Cold outreach', 'UW alumni', 'Referral', 'Club event', 'Existing connection']), closed: false, createdAt: at(45) };
      contacts.push(c);
      if (R.chance(0.12)) continue; // not contacted yet
      let t0 = quiet ? R.int(18, 40) : R.int(0, 35);
      act(m.id, 'outreach', at(t0, `${R.int(8, 20)}:${R.pick(['00', '15', '30', '45'])}`), { contactId: c.id });
      let replied = R.chance(0.45);
      if (!replied && t0 >= 7 && R.chance(0.6)) {
        t0 -= R.int(6, 8);
        if (t0 >= 0) { act(m.id, 'follow_up', at(t0, '09:00'), { contactId: c.id }); replied = R.chance(0.35); }
      }
      if (replied && t0 >= 1) {
        const tr = t0 - R.int(1, Math.min(4, t0));
        act(m.id, 'reply', at(tr, '13:00'), { contactId: c.id });
        if (R.chance(0.65)) {
          const ev = tr - R.int(2, 8);
          act(m.id, 'chat_scheduled', at(tr, '13:30'), { contactId: c.id, eventAt: at(ev, '16:00') });
          if (ev < 0) continue;
          if (R.chance(0.85)) act(m.id, 'chat_completed', at(ev, '16:45'), { contactId: c.id });
        }
      }
    }
    const nApps = Math.round(R.int(0, 4) * Math.min(engagement, 1));
    for (let k = 0; k < nApps; k++) {
      const f = R.pick(tfirms);
      const track = f.tracks.find(t => m.tracks.includes(t)) ?? f.tracks[0];
      const stage = R.pick<AppStage>(['Considering', 'Applied', 'Applied', 'Assessment', 'First round', 'Further rounds', 'Final round', 'Rejected', 'Offer']);
      const ap = app(m.id, f.name, { roleTitle: ROLE_BY_TRACK[track], track, office: R.pick(f.offices), stage, cycle: R.chance(0.85) ? 'Summer 2027' : CYCLES[R.int(1, 3)] });
      if (stage === 'Considering') { ap.deadline = R.chance(0.6) ? d(R.int(-3, 30)) : undefined; continue; }
      const sub = quiet ? R.int(20, 40) : R.int(3, 30);
      ap.appliedOn = d(-sub);
      act(m.id, 'app_submitted', at(sub, '21:00'), { applicationId: ap.id });
      if (['First round', 'Further rounds', 'Final round', 'Offer'].includes(stage)) {
        const future = !quiet && R.chance(0.5);
        const when = future ? zonedToISO(d(R.int(1, 12)), '10:00', tz) : at(R.int(1, Math.max(1, sub - 1)), '10:00');
        interviews.push({ id: id('int'), ownerId: m.id, applicationId: ap.id, round: stage === 'Final round' ? 'Superday / final' : 'First round', type: R.pick(INTERVIEW_TYPES), scheduledAt: when, status: future ? 'scheduled' : 'completed', createdAt: at(sub) });
        if (!future) act(m.id, 'interview_completed', when, { applicationId: ap.id });
      }
      if (stage === 'Offer') act(m.id, 'offer', at(1), { applicationId: ap.id });
      if (stage === 'Rejected') act(m.id, 'app_closed', at(R.int(1, sub)), { applicationId: ap.id });
    }
    if (m.role === 'analyst') {
      const group = groups.find(g => g.id === assignments.find(x => x.analystId === m.id)?.groupId)!;
      goals.push({ id: id('goal'), analystId: m.id, setById: group.mentorId, type: 'new_contacts', target: R.int(3, 5), startOn: wk, dueOn: addDays(wk, 6), cancelled: false, createdAt: at(1) });
      goals.push({ id: id('goal'), analystId: m.id, setById: group.mentorId, type: R.pick(['chats_completed', 'applications_submitted', 'follow_ups'] as const), target: R.int(1, 3), startOn: addDays(wk, -14), dueOn: addDays(wk, -1), cancelled: false, createdAt: at(15) });
      if (R.chance(0.3)) goals.push({ id: id('goal'), analystId: m.id, setById: group.mentorId, type: 'prep_task', target: 1, label: R.pick(['Build a DCF from scratch', 'Draft a two-minute stock pitch', 'Practice three market-sizing cases', 'Review the 400 Qs accounting section']), startOn: addDays(today, -10), dueOn: addDays(today, R.int(-3, 7)), completedAt: R.chance(0.4) ? at(2) : undefined, cancelled: false, createdAt: at(10) });
    }
  }

  // Follow-up tasks derived from seeded history (same rule the app uses at runtime).
  const tasks: Task[] = [];
  const byContact = new Map<string, Activity[]>();
  for (const a of activities.slice().sort((x, y) => x.occurredAt.localeCompare(y.occurredAt))) if (a.contactId) (byContact.get(a.contactId) ?? byContact.set(a.contactId, []).get(a.contactId)!).push(a);
  for (const c of contacts) {
    const acts = byContact.get(c.id) ?? [];
    const lastOut = [...acts].reverse().find(a => a.type === 'outreach' || a.type === 'follow_up');
    if (!lastOut || c.closed) continue;
    const reply = acts.find(a => ['reply', 'chat_scheduled', 'chat_completed'].includes(a.type) && a.occurredAt >= lastOut.occurredAt);
    if (reply) continue;
    tasks.push({ id: id('task'), ownerId: c.ownerId, kind: 'follow_up', contactId: c.id, dueOn: addDays(dateKey(lastOut.occurredAt, tz), 7), status: 'open', sourceActivityId: lastOut.id, snoozeCount: 0, createdAt: lastOut.occurredAt });
  }

  // Mock interview requests
  const mockRequests: MockRequest[] = [];
  const mm = (requesterId: string, mentorId: string, status: MockRequest['status'], track: Track, type: string, extra: Partial<MockRequest> = {}) =>
    mockRequests.push({ id: id('mock'), requesterId, mentorId, status, track, interviewType: type, createdAt: at(5), updatedAt: at(3), ...extra });
  mm('mem_avery', 'mem_m0', 'Requested', 'Investment banking', 'Accounting', { targetFirmId: F('Evercore'), proposedTime: zonedToISO(d(4), '18:00', tz) });
  mm('mem_avery', 'mem_jordan', 'Completed', 'Investment banking', 'Behavioral', { scheduledAt: at(9, '18:00'), completedAt: at(9, '19:00') });
  mm('mem_riley', 'mem_jordan', 'Requested', 'Asset management / investment research', 'Stock pitch', { proposedTime: zonedToISO(d(3), '17:00', tz) });
  mm('mem_a0', 'mem_jordan', 'Scheduled', 'Investment banking', 'Valuation', { scheduledAt: zonedToISO(d(1), '19:00', tz), targetFirmId: F('Centerview Partners') });
  mm('mem_a5', 'mem_jordan', 'Accepted', 'Private equity', 'Valuation', { proposedTime: zonedToISO(d(5), '12:00', tz) });
  for (let i = 0; i < 18; i++) {
    const req = R.pick(analysts), men = R.pick(mentors);
    mm(req.id, men.id, R.pick(['Requested', 'Accepted', 'Scheduled', 'Completed', 'Completed', 'Declined']), req.tracks[0], R.pick(INTERVIEW_TYPES), { proposedTime: zonedToISO(d(R.int(-10, 10)), '18:00', tz), completedAt: at(R.int(1, 10)) });
  }
  for (const m of mockRequests) if (m.status !== 'Completed') m.completedAt = undefined;

  // Exec announcements (fictional firms and people).
  const ann = (authorId: string, daysAgo: number, a: Omit<Announcement, 'id' | 'authorId' | 'createdAt' | 'updatedAt' | 'archived' | 'demo'>): Announcement =>
    ({ ...a, id: id('ann'), authorId, archived: false, demo: true, createdAt: at(daysAgo, '06:39'), updatedAt: at(daysAgo, '06:39') });
  const announcements: Announcement[] = [
    ann('mem_casey', 1, { title: 'Internship opportunity: wealth management', pinned: true, tracks: ['Asset management / investment research'],
      body: 'Thank you to everyone who joined the Cascade Peak Partners panel yesterday!\n\nHarbor Lane Wealth Partners is looking for an intern interested in financial planning and wealth management. You would get exposure to client advisory work. If you are interested, email Dana Whitfield to express your interest and ask any questions.',
      contactName: 'Dana Whitfield', contactEmail: 'dana.whitfield@harborlane.example' }),
    ann('mem_morgan', 4, { title: 'Madrona coffee hour for UW students', pinned: false, tracks: ['Venture capital'], firmId: F('Madrona Venture Group'),
      body: 'A Madrona investor reached out offering a coffee hour for UWIG members interested in early-stage investing. Sign up through the link by the deadline. Space is limited to 12 people.',
      link: 'https://forms.example/uwig-madrona', deadline: d(6) }),
    ann('mem_sam', 9, { title: 'Resume book due before winter break', pinned: false, tracks: [],
      body: 'Upload your resume to the UWIG resume book. Exec shares it with firms that ask us for candidates. Use your one-page finance resume.', link: 'https://forms.example/uwig-resume-book', deadline: d(12) }),
  ];

  return { version: DB_VERSION, seededAt: now, members, groups, assignments, firms, announcements, targets, contacts, applications, interviews, activities, tasks, goals, mentorProfiles, mockRequests, importBatches: [] };
}
