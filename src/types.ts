export type PriorityLevel = 'URGENT' | 'HIGH' | 'NORMAL';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: PriorityLevel;
  notes?: string;
  completed: boolean;
  timeEstimate?: string; // Donna's estimated duration (e.g., "1.5h" or "45m")
  donnaNote?: string; // Donna's AI-generated reasoning or assessment
  subtasks?: SubTask[];
  reminderTime?: string; // e.g. "09:00" on due date
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  duration: number; // in minutes
  attendees: string[]; // names of people attending
  description?: string;
  hasConflict?: boolean;
  location?: string;
  reminderMinutes?: number;
  recurrence?: 'NONE' | 'DAILY' | 'WEEKLY';
}

export type RelationshipType = 'Client' | 'Colleague' | 'Manager' | 'Personal' | 'Vendor';

export interface Person {
  id: string;
  name: string;
  role: string;
  company: string;
  relationship: RelationshipType;
  lastInteraction: string; // YYYY-MM-DD
  notes?: string;
  thingsToRemember: string[]; // bullet points of memory
  email?: string;
  source?: 'gmail' | 'gmail_mine' | 'manual';
}

export type GoalCategory = 'Work' | 'Health' | 'Learning' | 'Personal';

export interface Goal {
  id: string;
  title: string;
  category: GoalCategory;
  weeklyTarget: string; // e.g. "3x per week"
  currentStreak: number;
  weeklyCompletion: number; // e.g. 2 (meaning completed 2 times this week)
  targetNum: number; // e.g. 3
}

export interface Habit {
  id: string;
  title: string;
  history: { [date: string]: boolean }; // YYYY-MM-DD -> completed or not
}

export interface AppEmail {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  time: string;
  preview: string;
  body: string;
  isPriority: boolean;
  donnaLabel: string; // e.g. "Reply needed — they're waiting on a decision"
  hasReplied?: boolean;
  draftResponse?: string;
}

export interface FollowUpEmail {
  id: string;
  recipient: string;
  subject: string;
  daysWaiting: number;
  lastSentDate: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  isError?: boolean;
  actionCard?: {
    type: 'add_task' | 'schedule_meeting' | 'reschedule' | 'block_time';
    title: string;
    description: string;
    details: any;
    status: 'pending' | 'approved' | 'rejected';
  };
}

export interface UserContext {
  name: string;
  role: string;
  timezone: string;
  workHoursStart: string; // e.g. "08:00"
  workHoursEnd: string; // e.g. "19:00"
  focusHoursStart: string; // e.g. "10:00"
  focusHoursEnd: string; // e.g. "12:00"
  assertiveness: number; // 0 (gentle) to 100 (firm)
  morningBriefTime: string; // e.g. "07:30"

  // Onboarding properties in sync
  onboardingComplete?: boolean;
  onboardingCompletedAt?: string;
  preferredName?: string;
  roleType?: string;
  roleDescription?: string;
  location?: string;
  workStartTime?: string;      // "09:00"
  workEndTime?: string;        // "19:00"
  focusStartTime?: string;     // "10:00"
  focusEndTime?: string;       // "12:00"
  workStyle?: string[];        // multi-select array
  currentGoal?: string;
  keyPeople?: string;
  doNotDisturb?: string;
  additionalContext?: string;
  assertivenessLevel?: number; // 0-100
  lastGmailSync?: string;
  connectedServices?: {
    gmail: boolean;
    calendar: boolean;
    tasks: boolean;
    people: boolean;
  };
}

export interface DonnaMemoryFact {
  id: string;
  fact: string;
  timestamp: string;
}
