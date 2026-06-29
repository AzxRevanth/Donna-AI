import { Task, CalendarEvent, Person, Goal, AppEmail, UserContext, DonnaMemoryFact, Habit, ChatMessage } from './types';

export const INITIAL_USER_CONTEXT: UserContext = {
  name: "Revant Kumar",
  role: "Product Manager",
  timezone: "US/Pacific",
  workHoursStart: "12:00",
  workHoursEnd: "20:00",
  focusHoursStart: "16:00",
  focusHoursEnd: "18:00",
  assertiveness: 75,
  morningBriefTime: "07:30"
};

export const DEMO_USER_CONTEXT: UserContext = {
  name: "Revant Kumar",
  role: "Managing Partner, Apex Ventures",
  timezone: "US/Pacific",
  workHoursStart: "12:00",
  workHoursEnd: "20:00",
  focusHoursStart: "16:00",
  focusHoursEnd: "18:00",
  assertiveness: 80,
  morningBriefTime: "07:30",
  currentGoal: "Clear out SLCM and mentor tasks by 12:00 so the 16:00 focus window is dedicated to aggressive skill development",
  keyPeople: "Mentor, SLCM Team, Elizabeth Holmes, David Sacks",
  onboardingComplete: true
};

export const DEMO_TASKS: Task[] = [
  {
    id: "demo-task-1",
    title: "Approve Apex merger term sheets",
    dueDate: new Date().toISOString().split('T')[0],
    completed: false,
    priority: "HIGH",
    notes: "Review Section 4.2 specifically for intellectual property transfer guidelines. Capital allocation terms must match our Q3 standards.",
    timeEstimate: "1.5h",
    donnaNote: "David Sacks expects your absolute sign-off before their emergency board call at 11:30 AM."
  },
  {
    id: "demo-task-2",
    title: "Finalize presentation deck for Q3 roadmap",
    dueDate: new Date().toISOString().split('T')[0],
    completed: false,
    priority: "NORMAL",
    notes: "Align with engineering team on active AI integration sprints. Keep slides clean and metrics-heavy.",
    timeEstimate: "2.0h",
    donnaNote: "I've locked out focus hours between 10 AM and 12 PM for you to draft this. Guard this slot aggressively."
  },
  {
    id: "demo-task-3",
    title: "Book follow-up lunch with senior stakeholders",
    dueDate: new Date().toISOString().split('T')[0],
    completed: false,
    priority: "NORMAL",
    notes: "Coordinate calendars and send formal Google Calendar invitation to Marcus Aurelius.",
    timeEstimate: "0.5h",
    donnaNote: "Marcus appreciates physical hand-written correspondence or deep face-to-face check-ins. Recommend the grill downtown."
  },
  {
    id: "demo-task-4",
    title: "Review engineering hiring pipeline",
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completed: false,
    priority: "NORMAL",
    notes: "12 senior resumes pending review in the hiring pipeline. Send short-list recommendations.",
    timeEstimate: "1.0h",
    donnaNote: "I suggest pushing this to tomorrow afternoon so we can prioritize the Apex sign-off today."
  }
];

export const DEMO_EVENTS: CalendarEvent[] = [
  {
    id: "demo-evt-1",
    title: "Q3 Strategy Board Session",
    date: new Date().toISOString().split('T')[0],
    startTime: "09:00",
    duration: 90,
    attendees: ["Elizabeth Holmes", "David Sacks"],
    description: "Discussing our Q3 capital allocation milestones, target hires, and clinical pipeline audits. Bring printed term sheets.",
    hasConflict: false
  },
  {
    id: "demo-evt-2",
    title: "Deep Focus Zone (Protected)",
    date: new Date().toISOString().split('T')[0],
    startTime: "10:00",
    duration: 120,
    attendees: [],
    description: "Do not disturb. Reserved for Q3 roadmap slide deck construction and strategic text editing.",
    hasConflict: true
  },
  {
    id: "demo-evt-3",
    title: "Urgent Sync with David Sacks",
    date: new Date().toISOString().split('T')[0],
    startTime: "11:00",
    duration: 30,
    attendees: ["David Sacks"],
    description: "Emergency contract clarification regarding Section 4.2 intellectual property clause. Overlaps with focus block.",
    hasConflict: true
  },
  {
    id: "demo-evt-4",
    title: "Dinner with Key Partner: Marcus Aurelius",
    date: new Date().toISOString().split('T')[0],
    startTime: "18:00",
    duration: 120,
    attendees: ["Marcus Aurelius"],
    description: "Refining our philosophical alignments on product-market fit and capital integrity.",
    hasConflict: false
  }
];

export const DEMO_PEOPLE: Person[] = [
  {
    id: "demo-p-1",
    name: "Elizabeth Holmes",
    role: "CEO",
    company: "Theranos",
    relationship: "Client",
    lastInteraction: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: "Prefers concise, metrics-driven binary trade-offs. Speaks with extreme confidence and has zero patience for open-ended or hypothetical slides.",
    thingsToRemember: [
      "Always frame options as clear binary choices with direct trade-offs.",
      "Extremely sensitive about timing. Do not delay updates.",
      "Do not challenge proprietary protocols unless David Sacks is on the thread."
    ],
    email: "elizabeth@theranos.com",
    source: "gmail_mine"
  },
  {
    id: "demo-p-2",
    name: "David Sacks",
    role: "General Partner",
    company: "Founders Fund",
    relationship: "Colleague",
    lastInteraction: new Date().toISOString().split('T')[0],
    notes: "Loves macro market trends, operational execution, and direct communication. Values elite preparation and highly structured summaries.",
    thingsToRemember: [
      "Loves real-time metrics and has low patience for theoretical slides.",
      "Verify the exact IP transfer clauses in Section 4.2 before our term-sheet review.",
      "Prefers morning coffee alignment meetings over afternoon pitches."
    ],
    email: "sacks@foundersfund.com",
    source: "gmail_mine"
  },
  {
    id: "demo-p-3",
    name: "Marcus Aurelius",
    role: "Senior Advisor",
    company: "Meditation Corp",
    relationship: "Colleague",
    lastInteraction: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: "A highly thoughtful, philosophical advisor who prioritizes absolute integrity, self-discipline, and long-term ethical alignment.",
    thingsToRemember: [
      "Do not pitch quick exits, speculative growth hacks, or rapid flips.",
      "Appreciates hand-written briefings and deep, focused face-to-face dinner alignment.",
      "Believes that quality of product reflects internal character of the product team."
    ],
    email: "marcus@rome.org",
    source: "gmail_mine"
  }
];

export const DEMO_GOALS: Goal[] = [
  {
    id: "demo-g-1",
    title: "Secure Apex merger approval",
    category: "Work",
    weeklyTarget: "1x per week",
    currentStreak: 0,
    weeklyCompletion: 0,
    targetNum: 1
  },
  {
    id: "demo-g-2",
    title: "Maintain focus slots daily",
    category: "Health",
    weeklyTarget: "5x per week",
    currentStreak: 3,
    weeklyCompletion: 3,
    targetNum: 5
  },
  {
    id: "demo-g-3",
    title: "Read strategic monographs",
    category: "Learning",
    weeklyTarget: "3x per week",
    currentStreak: 2,
    weeklyCompletion: 2,
    targetNum: 3
  }
];

export const DEMO_EMAILS: AppEmail[] = [
  {
    id: "demo-em-1",
    sender: "Elizabeth Holmes",
    senderEmail: "elizabeth@theranos.com",
    subject: "RE: Strategic advisory alignment",
    time: "08:15 AM",
    preview: "Revant, I need you to look at the revised testing protocols. We can't afford another delay on the Q3 sign-offs.",
    body: "Dear Revant,\n\nI need you to look at the revised testing protocols. We can't afford another delay on the Q3 sign-offs. Can you align with David Sacks by 11:00 AM?\n\nBest,\nElizabeth",
    isPriority: true,
    donnaLabel: "Urgent / Elizabeth demands board call sync"
  },
  {
    id: "demo-em-2",
    sender: "David Sacks",
    senderEmail: "sacks@foundersfund.com",
    subject: "Apex Term Sheets - Final Revision",
    time: "07:45 AM",
    preview: "Here is the final PDF. Section 4.2 was amended to reflect our intellectual property guidelines.",
    body: "Revant,\n\nHere is the final PDF. Section 4.2 was amended to reflect our intellectual property guidelines.\n\nLet's discuss on our call at 11:00.\n\n- Sacks",
    isPriority: true,
    donnaLabel: "Apex Term Sheets / Review Section 4.2"
  },
  {
    id: "demo-em-3",
    sender: "Marcus Aurelius",
    senderEmail: "marcus@rome.org",
    subject: "Reflections on product-market fit",
    time: "Yesterday",
    preview: "Waste no more time arguing about what a good product should be. Be one.",
    body: "Revant,\n\nWaste no more time arguing about what a good product should be. Be one.\n\nLet's align during our dinner tonight at 6 PM.\n\nWarmly,\nMarcus",
    isPriority: false,
    donnaLabel: "Dinner alignment tonight"
  }
];

export const DEMO_DONNA_MEMORY: DonnaMemoryFact[] = [
  {
    id: "demo-m-1",
    fact: "David Sacks prefers coffee meetings over formal slide presentations.",
    timestamp: new Date().toISOString()
  },
  {
    id: "demo-m-2",
    fact: "Elizabeth Holmes requires all product updates to be marked strictly as confidential.",
    timestamp: new Date().toISOString()
  }
];

export const DEMO_CHAT: ChatMessage[] = [
  {
    id: "demo-c-1",
    role: "model",
    content: "Welcome back, Revant. I've updated your relationship matrix and filtered the noise in your inbox. David Sacks and Elizabeth Holmes are both pushing for coordination on the Apex term sheet before 11:30 AM today. I have also flagged an active calendar conflict during your 10:00 AM focus slot. Shall we restructure this morning or coordinate with Sacks first?",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
];

export const INITIAL_TASKS: Task[] = [];
export const INITIAL_EVENTS: CalendarEvent[] = [];
export const INITIAL_PEOPLE: Person[] = [];
export const INITIAL_GOALS: Goal[] = [];
export const INITIAL_HABITS: Habit[] = [];
export const INITIAL_EMAILS: AppEmail[] = [];
export const INITIAL_DONNA_MEMORY: DonnaMemoryFact[] = [];
export const INITIAL_CHAT: ChatMessage[] = [];

export function loadStoredData<T>(key: string, backup: T): T {
  // Purge old mock-filled localstorage to start clean with real Google sync data
  const hasPurged = localStorage.getItem('donna_v2_purged');
  if (!hasPurged) {
    localStorage.removeItem('donna_tasks');
    localStorage.removeItem('donna_events');
    localStorage.removeItem('donna_people');
    localStorage.removeItem('donna_goals');
    localStorage.removeItem('donna_habits');
    localStorage.removeItem('donna_emails');
    localStorage.removeItem('donna_donna_memory');
    localStorage.removeItem('donna_chat_history');
    localStorage.setItem('donna_v2_purged', 'true');
  }

  const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
  const uid = localStorage.getItem('donna_user_uid') || 'anonymous';
  const storageKey = isDemo ? `donna_demo_${key}` : `donna_user_${uid}_${key}`;

  const item = localStorage.getItem(storageKey);
  if (!item) {
    localStorage.setItem(storageKey, JSON.stringify(backup));
    return backup;
  }
  try {
    const parsed = JSON.parse(item);
    // Filter out residual mock items with mock IDs if they are not in demo mode
    if (Array.isArray(parsed) && !isDemo) {
      return parsed.filter((x: any) => {
        if (!x || !x.id) return true;
        const idStr = String(x.id);
        return !(
          (idStr.startsWith('task-') && ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'].includes(idStr)) ||
          (idStr.startsWith('evt-') && ['evt-1', 'evt-2', 'evt-3', 'evt-4'].includes(idStr)) ||
          (idStr.startsWith('p-') && ['p-1', 'p-2', 'p-3'].includes(idStr)) ||
          (idStr.startsWith('em-') && ['em-1', 'em-2', 'em-3', 'em-4'].includes(idStr)) ||
          (idStr.startsWith('g-') && ['g-1', 'g-2', 'g-3'].includes(idStr)) ||
          (idStr.startsWith('hab-') && ['hab-1', 'hab-2', 'hab-3'].includes(idStr)) ||
          (idStr.startsWith('m-') && ['m-1', 'm-2', 'm-3'].includes(idStr)) ||
          (idStr.startsWith('c-') && ['c-1'].includes(idStr))
        );
      }) as any;
    }
    return parsed;
  } catch (e) {
    return backup;
  }
}

export function saveStoredData<T>(key: string, data: T): void {
  const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
  const uid = localStorage.getItem('donna_user_uid') || 'anonymous';
  const storageKey = isDemo ? `donna_demo_${key}` : `donna_user_${uid}_${key}`;
  localStorage.setItem(storageKey, JSON.stringify(data));
}
