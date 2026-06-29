import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const buildDonnaContext = async (
  uid: string, 
  extras: { events?: any[]; tasks?: any[]; emails?: any[]; emailCount?: number } = {}
): Promise<string> => {
  try {
    const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
    let s: any = null;

    if (isDemo) {
      const stored = localStorage.getItem('donna_demo_user_context');
      if (stored) {
        try {
          s = JSON.parse(stored);
        } catch (e) {
          s = null;
        }
      }
      if (!s) {
        s = {
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
      }
    } else {
      const settings = await getDoc(
        doc(db, 'users', uid, 'preferences', 'settings')
      );
      s = settings.data();
    }

    if (!s) {
      return 'DONNA STATUS: SYSTEM STANDBY';
    }
    
    const getTimeOfDay = () => {
      const hr = new Date().getHours();
      if (hr < 12) return 'morning';
      if (hr < 18) return 'afternoon';
      return 'evening';
    };

    return `
DONNA'S COMPLETE CONTEXT FOR ${(s.preferredName || s.name || 'PARTNER').toUpperCase()}:

WHO THEY ARE:
Name: ${s.preferredName || s.name || 'Partner'} (always use this name)
What they do: ${s.roleDescription || s.role || 'Executive Partner'}
Role type: ${s.roleType || 'Other'}
Location: ${s.location || s.timezone || 'US/Pacific'}
Current main goal: ${s.currentGoal || 'Optimizing performance'}
Key people they work with: ${s.keyPeople || 'N/A'}

HOW THEY WORK:
Work hours: ${s.workStartTime || s.workHoursStart || '09:00'} to ${s.workEndTime || s.workHoursEnd || '19:00'}
Focus window (protect this time): ${s.focusStartTime || s.focusHoursStart || '10:00'} to ${s.focusEndTime || s.focusHoursEnd || '12:00'}
Work style preferences: ${Array.isArray(s.workStyle) ? s.workStyle.join(', ') : (s.workStyle || 'Deep focus')}
Do not disturb for: ${s.doNotDisturb || 'N/A'}
Additional context: ${s.additionalContext || 'N/A'}

YOUR COMMUNICATION STYLE WITH THEM:
Assertiveness level: ${s.assertivenessLevel ?? s.assertiveness ?? 75}/100
${(s.assertivenessLevel ?? s.assertiveness ?? 75) > 70 
  ? 'Be direct, push back hard, act decisively.' 
  : (s.assertivenessLevel ?? s.assertiveness ?? 75) > 40 
  ? 'Be clear and direct but considerate.' 
  : 'Be gentle, ask before acting, soften feedback.'}

TODAY'S DATE: ${new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', 
  month: 'long', day: 'numeric'
})}
TIME OF DAY: ${getTimeOfDay()}
${extras.events ? `TODAY'S CALENDAR: ${JSON.stringify(
  extras.events.map((e: any) => ({title: e.title || e.summary, 
    start: e.startTime || e.start?.dateTime})))}` : ''}
${extras.tasks ? `ACTIVE TASKS: ${JSON.stringify(
  extras.tasks.map((t: any) => ({title: t.title, due: t.dueDate || t.due}))
  )}` : ''}
${extras.emailCount !== undefined 
  ? `UNREAD EMAILS COUNT: ${extras.emailCount}` : ''}
${extras.emails && extras.emails.length > 0 ? `LATEST EMAILS IN INBOX: ${JSON.stringify(
  extras.emails.slice(0, 5).map((m: any) => ({
    sender: m.sender || m.from || 'Unknown',
    subject: m.subject || '(No Subject)',
    preview: m.preview || m.snippet || '',
    isPriority: !!m.isPriority
  }))
)}` : ''}
  `.trim();
  } catch (error) {
    console.error("Error building Donna context:", error);
    return `DONNA STATUS: OFFLINE MODE / STANDBY`;
  }
};
