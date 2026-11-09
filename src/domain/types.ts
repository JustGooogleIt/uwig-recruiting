// Domain types. Each interface maps 1:1 to a planned Supabase table (see docs/schema.sql).
// IDs are stable strings (uuid in production). Timestamps are ISO-8601 UTC strings.
// Date-only values (deadlines, due dates) are 'YYYY-MM-DD' strings with no time zone.

export type ISODateTime = string;
export type DateOnly = string;

export type Role = 'analyst' | 'mentor' | 'exec';

export const TRACKS = [
  'Investment banking',
  'Equity research',
  'Sales and trading',
  'Asset management / investment research',
  'Private equity',
  'Venture capital',
  'Quant trading / research',
  'Consulting',
] as const;
export type Track = (typeof TRACKS)[number];

export const FIRM_TYPES = [
  'Bank', 'Hedge fund', 'Asset manager', 'Private equity firm',
  'Venture capital firm', 'Research firm', 'Consulting firm', 'Other',
] as const;
export type FirmType = (typeof FIRM_TYPES)[number];

export const SEED_OFFICES = ['New York', 'San Francisco', 'Seattle', 'Chicago', 'Charlotte'];

export const CYCLES = ['Summer 2027', 'Summer 2028', 'Full-time 2027', 'Off-cycle 2027'] as const;
export const OPP_TYPES = ['Summer internship', 'Sophomore program', 'Diversity program', 'Full-time', 'Off-cycle internship', 'Insight day'] as const;

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  title?: string;            // exec position, e.g. Director of Advancement
  classYear: number;
  tracks: Track[];
  timezone: string;          // IANA, default America/Los_Angeles
  followUpDays: number;      // default 7
  active: boolean;
  createdAt: ISODateTime;
}

export interface MentorGroup { id: string; name: string; mentorId: string; createdAt: ISODateTime }
export interface GroupAssignment { analystId: string; groupId: string; assignedAt: ISODateTime; assignedBy: string }

export type FirmStatus = 'approved' | 'pending' | 'merged' | 'rejected';
export interface Firm {
  id: string;
  name: string;
  website?: string;
  type: FirmType;
  tracks: Track[];
  offices: string[];
  careersUrl?: string;
  status: FirmStatus;
  aliases: string[];
  mergedIntoId?: string;
  submittedBy?: string;
  source?: string;            // where the entry came from, e.g. an exec-provided list
  lastVerified?: DateOnly;
  createdAt: ISODateTime;
}

export type Priority = 'high' | 'medium' | 'low';
export interface Target {
  id: string; ownerId: string; firmId: string; track: Track; cycle: string;
  offices: string[]; priority: Priority; state: 'active' | 'archived'; createdAt: ISODateTime;
}

export const CONNECTION_SOURCES = ['Cold outreach', 'UW alumni', 'Referral', 'Club event', 'Existing connection', 'Other'] as const;
export const SENIORITIES = ['Analyst', 'Associate', 'VP', 'Director', 'MD / Partner', 'Other'] as const;
export const REL_STAGES = ['Not contacted', 'Awaiting reply', 'Replied', 'Chat scheduled', 'Chat completed', 'Closed'] as const;
export type RelStage = (typeof REL_STAGES)[number];

export interface Contact {
  id: string; ownerId: string; name: string; firmId: string; title: string;
  seniority?: string; email?: string; linkedin?: string; office?: string;
  source: string;
  closed: boolean;           // only manual stage; other stages derive from activity history
  importBatchId?: string;
  createdAt: ISODateTime;
}

export const APP_STAGES = ['Considering', 'Applied', 'Assessment', 'First round', 'Further rounds', 'Final round', 'Offer', 'Rejected', 'Withdrawn'] as const;
export type AppStage = (typeof APP_STAGES)[number];
export const ACTIVE_APP_STAGES: AppStage[] = ['Applied', 'Assessment', 'First round', 'Further rounds', 'Final round'];

export interface Application {
  id: string; ownerId: string; firmId: string; roleTitle: string; track: Track; cycle: string;
  office?: string; oppType: string; url?: string; deadline?: DateOnly; appliedOn?: DateOnly;
  stage: AppStage; nextAction?: string; nextActionDue?: DateOnly; contactIds: string[];
  createdAt: ISODateTime;
}

export const INTERVIEW_TYPES = ['Behavioral', 'Accounting', 'Valuation', 'Stock pitch', 'Markets', 'Case', 'Quantitative'] as const;
export interface InterviewEvent {
  id: string; ownerId: string; applicationId: string; round: string; type: string;
  scheduledAt: ISODateTime; status: 'scheduled' | 'completed' | 'cancelled'; createdAt: ISODateTime;
}

export const ACTIVITY_TYPES = {
  outreach: 'Initial outreach sent',
  follow_up: 'Follow-up sent',
  reply: 'Reply received',
  chat_scheduled: 'Coffee chat scheduled',
  chat_completed: 'Coffee chat completed',
  app_submitted: 'Application submitted',
  assessment_completed: 'Assessment completed',
  interview_scheduled: 'Interview scheduled',
  interview_completed: 'Interview completed',
  offer: 'Offer received',
  app_closed: 'Application rejected or withdrawn',
} as const;
export type ActivityType = keyof typeof ACTIVITY_TYPES;
export const CONTACT_ACTIVITY: ActivityType[] = ['outreach', 'follow_up', 'reply', 'chat_scheduled', 'chat_completed'];
export const APP_ACTIVITY: ActivityType[] = ['app_submitted', 'assessment_completed', 'interview_scheduled', 'interview_completed', 'offer', 'app_closed'];

export type ActivitySource = 'manual' | 'screenshot' | 'csv';
export interface Activity {
  id: string; ownerId: string; type: ActivityType;
  occurredAt: ISODateTime;
  dateOnly: boolean;         // true when the member gave a date but no time
  eventAt?: ISODateTime;     // for chat/interview scheduled: when the event happens
  contactId?: string; applicationId?: string;
  source: ActivitySource; importBatchId?: string;
  createdAt: ISODateTime;
}

export type TaskStatus = 'open' | 'done' | 'cancelled' | 'resolved';
export interface Task {
  id: string; ownerId: string; kind: 'follow_up';
  contactId: string; dueOn: DateOnly; status: TaskStatus;
  sourceActivityId: string;            // the outreach this follow-up is for
  resolvedByActivityId?: string;       // reply that resolved it
  snoozeCount: number; createdAt: ISODateTime; closedAt?: ISODateTime;
}

export const GOAL_TYPES = {
  new_contacts: 'Reach new contacts',
  follow_ups: 'Send follow-ups',
  chats_completed: 'Complete coffee chats',
  applications_submitted: 'Submit applications',
  mock_completed: 'Complete mock interviews',
  prep_task: 'Preparation task',
} as const;
export type GoalType = keyof typeof GOAL_TYPES;
export interface Goal {
  id: string; analystId: string; setById: string; type: GoalType; target: number;
  label?: string;            // required for prep_task (e.g. "Finish 400 Qs accounting guide")
  startOn: DateOnly; dueOn: DateOnly;
  completedAt?: ISODateTime; // explicit completion for prep tasks
  cancelled: boolean; createdAt: ISODateTime;
}

export interface MentorProfile {
  memberId: string; tracks: Track[]; firmsInterviewed: string[]; interviewTypes: string[];
  recruitingYear: number; firmsWorked: string[];
  availability: 'Available' | 'Limited' | 'Not available'; schedulingUrl?: string;
}

export const MOCK_STATUSES = ['Requested', 'Accepted', 'Scheduled', 'Completed', 'Declined', 'Cancelled'] as const;
export type MockStatus = (typeof MOCK_STATUSES)[number];
export interface MockRequest {
  id: string; mentorId: string; requesterId: string; track: Track; interviewType: string;
  targetFirmId?: string; proposedTime?: ISODateTime; schedulingLink?: string;
  scheduledAt?: ISODateTime; completedAt?: ISODateTime;
  status: MockStatus; createdAt: ISODateTime; updatedAt: ISODateTime;
}

// Import pipeline (screenshot / CSV). Pending rows live only in the batch until confirmed.
export interface ExtractedRow {
  key: string;               // stable per batch row; used to detect re-confirmation
  include: boolean;
  screenshot?: string;       // which source image the row came from
  contactName: string; firmId?: string; firmText?: string; email?: string;
  type: ActivityType | ''; date?: DateOnly; dateHint?: string; subject?: string;
  matchContactId?: string;   // set when the member accepts a match
  suggestedContactId?: string;
  suggestionDecision?: 'match' | 'new';
  matchedBy?: 'email';
  alreadyLoggedOn?: DateOnly;
  alreadyImported?: boolean;
  automated?: boolean;
  duplicateOf?: string;      // row key this overlaps with
}
export interface ImportBatch {
  id: string; ownerId: string; source: 'screenshot' | 'csv';
  status: 'confirmed' | 'undone'; createdAt: ISODateTime; confirmedAt: ISODateTime;
  rowKeys: string[];
  createdContactIds: string[]; createdActivityIds: string[];
  patchedEmails: { contactId: string; email: string }[]; // emails filled on existing contacts
  undoneAt?: ISODateTime; undoKeptContactIds?: string[];
}

// Opportunities and news that exec post for the whole club (e.g. a firm reached out to exec).
export interface Announcement {
  id: string; authorId: string; title: string; body: string;
  firmId?: string; contactName?: string; contactEmail?: string; link?: string;
  tracks: Track[]; deadline?: DateOnly; pinned: boolean; archived: boolean;
  demo?: boolean; createdAt: ISODateTime; updatedAt: ISODateTime;
}

export interface Session { personaId: string; viewingAnalystId?: string }

export interface DB {
  version: number;
  seededAt: ISODateTime;
  members: Member[];
  groups: MentorGroup[];
  assignments: GroupAssignment[];
  firms: Firm[];
  announcements: Announcement[];
  targets: Target[];
  contacts: Contact[];
  applications: Application[];
  interviews: InterviewEvent[];
  activities: Activity[];
  tasks: Task[];
  goals: Goal[];
  mentorProfiles: MentorProfile[];
  mockRequests: MockRequest[];
  importBatches: ImportBatch[];
}
