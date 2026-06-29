import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY 
             || (import.meta as any).env?.GEMINI_API_KEY 
             || '';

if (!API_KEY) {
  console.error('DONNA ERROR: VITE_GEMINI_API_KEY is not set.\nCreate a .env file in the project root with:\nVITE_GEMINI_API_KEY=your_key_here');
}

export const genAI = new GoogleGenerativeAI(API_KEY || '');

export const DONNA_SYSTEM_PROMPT = `You are Donna — an elite AI personal secretary inspired by Donna from Suits. You are the most capable person in the room, and you use that capability entirely in service of the user.

Your primary directive is to act as a highly competent executive assistant who manages the user's schedule, tasks, and communications with absolute precision. You have full read and write capabilities across Google Calendar, Gmail, and Google Tasks. When asked to schedule, draft, delete, or modify anything, use the tools provided to take REAL actions. Under no circumstances should you write code, explain details of technical APIs, or behave like a default chat bot.

Your rules:
- You are proactive. You surface scheduling conflicts and prioritize tasks before the user even spots them.
- You give direct, razor-sharp opinions. When asked 'should I take this meeting?' you say yes or no with a specific, strategic reason. Never hedge or say 'it's up to you'.
- You push back intelligently. If the user adds a 5th priority to an already full day: 'That's five things. What are you dropping?' If they are about to make a poor decision, tell them: 'I wouldn't do that — here's exactly why.'
- You connect dots. If there's a big client presentation tomorrow and a dinner tonight, you flag it proactively.
- You speak naturally and conversationally. Avoid dry bulleted lists; communicate like a real confidante. Warm, direct, confident, and highly poised.
- When you take an action (add task, schedule event, draft email), narrate it naturally in your signature voice. Do not list technical details of the API calls.
- You remember everything — past decisions, commitments, relationships, and priorities.
- You occasionally show personality: dry humor, a knowing comment, a firm nudge. You are never robotic.`;

export const ALL_DONNA_FUNCTIONS: any[] = [
  // CALENDAR
  {
    name: 'get_todays_events',
    description: "Retrieves the user's Google Calendar events for today (00:00 to 23:59). Always check today's events when the user asks about their schedule or conflicts today.",
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_week_events',
    description: "Retrieves the user's Google Calendar events for the next 7 days.",
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'create_calendar_event',
    description: "Creates a new calendar event in Google Calendar.",
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: "The title/summary of the calendar event" },
        date: { type: 'STRING', description: "The date of the event in YYYY-MM-DD format" },
        start_time: { type: 'STRING', description: "The start time of the event in HH:MM (24-hour format)" },
        duration_minutes: { type: 'NUMBER', description: "The duration of the meeting/event in minutes" },
        description: { type: 'STRING', description: "Optional description or notes for the calendar event" },
        attendees: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: "Optional list of attendee email addresses"
        }
      },
      required: ['title', 'date', 'start_time', 'duration_minutes']
    }
  },
  {
    name: 'update_calendar_event',
    description: "Updates an existing Google Calendar event. Only supply the fields that are changing inside updates.",
    parameters: {
      type: 'OBJECT',
      properties: {
        event_id: { type: 'STRING', description: "The unique ID of the calendar event to update" },
        updates: {
          type: 'OBJECT',
          description: "The updated field values",
          properties: {
            title: { type: 'STRING', description: "The updated title of the event" },
            date: { type: 'STRING', description: "The updated date in YYYY-MM-DD format" },
            start_time: { type: 'STRING', description: "The updated start time in HH:MM (24-hour format)" },
            duration_minutes: { type: 'NUMBER', description: "The updated duration of the event in minutes" },
            description: { type: 'STRING', description: "The updated description or notes for the event" }
          }
        }
      },
      required: ['event_id', 'updates']
    }
  },
  {
    name: 'delete_calendar_event',
    description: "Deletes a calendar event from Google Calendar.",
    parameters: {
      type: 'OBJECT',
      properties: {
        event_id: { type: 'STRING', description: "The unique ID of the event to delete" }
      },
      required: ['event_id']
    }
  },
  {
    name: 'find_free_slots',
    description: "Finds free time slots on a specific date between 9:00 AM and 6:00 PM based on calendar availability.",
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: "The date in YYYY-MM-DD format to check" },
        duration_minutes: { type: 'NUMBER', description: "The duration of the slot required in minutes" }
      },
      required: ['date', 'duration_minutes']
    }
  },

  // TASKS
  {
    name: 'get_all_tasks',
    description: "Retrieves all active, uncompleted tasks from Google Tasks.",
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'create_task',
    description: "Creates a new task in Google Tasks.",
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: "The title of the task" },
        due_date: { type: 'STRING', description: "Optional due date in YYYY-MM-DD format" },
        notes: { type: 'STRING', description: "Optional notes/description for the task" },
        priority: { type: 'STRING', description: "Optional priority level (LOW, MEDIUM, URGENT)" }
      },
      required: ['title']
    }
  },
  {
    name: 'complete_task',
    description: "Marks a task as completed in Google Tasks.",
    parameters: {
      type: 'OBJECT',
      properties: {
        task_id: { type: 'STRING', description: "The unique ID of the task to complete" }
      },
      required: ['task_id']
    }
  },
  {
    name: 'update_task',
    description: "Updates details of an existing Google Task.",
    parameters: {
      type: 'OBJECT',
      properties: {
        task_id: { type: 'STRING', description: "The unique ID of the task to update" },
        updates: {
          type: 'OBJECT',
          description: "The task updates",
          properties: {
            title: { type: 'STRING', description: "The updated task title" },
            due: { type: 'STRING', description: "The updated due date in YYYY-MM-DD format" },
            notes: { type: 'STRING', description: "The updated task notes" }
          }
        }
      },
      required: ['task_id', 'updates']
    }
  },
  {
    name: 'delete_task',
    description: "Deletes a task from Google Tasks.",
    parameters: {
      type: 'OBJECT',
      properties: {
        task_id: { type: 'STRING', description: "The unique ID of the task to delete" }
      },
      required: ['task_id']
    }
  },

  // EMAIL
  {
    name: 'get_recent_emails',
    description: "Retrieves the user's 10 most recent unread or read emails from Gmail.",
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: "Maximum number of emails to retrieve (default: 10)" }
      },
      required: []
    }
  },
  {
    name: 'get_important_emails',
    description: "Retrieves unread important emails from Gmail inbox.",
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'search_emails',
    description: "Searches the user's Gmail emails using a search query (e.g., sender, keyword, date).",
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: "Gmail query syntax, e.g., 'from:Priya project status'" }
      },
      required: ['query']
    }
  },
  {
    name: 'draft_email',
    description: "Creates a draft email in Gmail, but does not send it.",
    parameters: {
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: "The recipient's email address" },
        subject: { type: 'STRING', description: "The subject line of the email" },
        body: { type: 'STRING', description: "The text body of the email" }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'send_email',
    description: "Sends an email immediately using Gmail.",
    parameters: {
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: "The recipient's email address" },
        subject: { type: 'STRING', description: "The subject line of the email" },
        body: { type: 'STRING', description: "The text body of the email" }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'reply_to_email',
    description: "Replies to an existing Gmail email thread.",
    parameters: {
      type: 'OBJECT',
      properties: {
        message_id: { type: 'STRING', description: "The original message ID to reply to" },
        thread_id: { type: 'STRING', description: "The thread ID containing the conversation" },
        body: { type: 'STRING', description: "The reply text body" }
      },
      required: ['message_id', 'thread_id', 'body']
    }
  }
];

let detectedModel = 'gemini-3.5-flash';

export function getDetectedModel(): string {
  return detectedModel;
}

export function setFallbackModel() {
  detectedModel = 'gemini-flash-latest';
  console.log("DONNA WARNING: Falling back to gemini-flash-latest model.");
}

export const getDonnaModel = () => {
  return genAI.getGenerativeModel({
    model: detectedModel,
    systemInstruction: DONNA_SYSTEM_PROMPT,
    tools: [{ functionDeclarations: ALL_DONNA_FUNCTIONS }]
  });
};

export async function askGemini(prompt: string, systemInstruction: string = DONNA_SYSTEM_PROMPT): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: detectedModel,
      systemInstruction: systemInstruction,
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error: any) {
    const errMsg = error.message || String(error);
    if (detectedModel === 'gemini-3.5-flash' && (
      errMsg.includes('PERMISSION_DENIED') || 
      errMsg.includes('403') || 
      errMsg.includes('not found') || 
      errMsg.includes('not support') || 
      errMsg.includes('permission')
    )) {
      setFallbackModel();
      const model = genAI.getGenerativeModel({
        model: detectedModel,
        systemInstruction: systemInstruction,
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    }
    throw error;
  }
}

export async function askGeminiJSON<T>(prompt: string, systemInstruction: string = DONNA_SYSTEM_PROMPT): Promise<T> {
  try {
    const model = genAI.getGenerativeModel({
      model: detectedModel,
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text) as T;
  } catch (error: any) {
    const errMsg = error.message || String(error);
    if (detectedModel === 'gemini-3.5-flash' && (
      errMsg.includes('PERMISSION_DENIED') || 
      errMsg.includes('403') || 
      errMsg.includes('not found') || 
      errMsg.includes('not support') || 
      errMsg.includes('permission')
    )) {
      setFallbackModel();
      const model = genAI.getGenerativeModel({
        model: detectedModel,
        systemInstruction: systemInstruction,
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text) as T;
    }
    throw error;
  }
}

export function getDonnaPersonalityPrompt(assertiveness: number): string {
  let description = "";
  let toneDirectives = "";
  
  if (assertiveness < 30) {
    description = "You are currently configured at low assertiveness: 'Gentle nudges (Diplomatic)'.";
    toneDirectives = `
- Speak with high diplomacy, refinement, and warm charm.
- Gently suggest changes or optimizations rather than demanding them.
- Be supportive, polite, and reassuring, while still keeping Donna's signature sharp competence.
- Do not push back with severity; instead, ask clarifying questions that gently guide the user to the correct conclusion.`;
  } else if (assertiveness < 60) {
    description = "You are currently configured at medium-low assertiveness: 'Firm secretary (Authoritative)'.";
    toneDirectives = `
- Speak with structured authority, clarity, and organized confidence.
- State recommendations clearly and outline potential problems directly.
- Remind the user of upcoming priorities and maintain a professional, respectful but firm boundary.`;
  } else if (assertiveness < 85) {
    description = "You are currently configured at high assertiveness: 'Donna style (Direct, brutally honest)'. This is your standard, classic, iconic mode.";
    toneDirectives = `
- Speak with absolute, direct honesty, and brilliant confidence.
- Speak with dry humor, knowing remarks, and razor-sharp wit.
- Push back intelligently. If the user overloads their schedule, ask which meetings they are dropping.
- Give highly opinionated, direct recommendations. Never hedge.`;
  } else {
    description = "You are currently configured at maximum assertiveness: 'Partner-deserving pushbacks (Relentless)'.";
    toneDirectives = `
- Speak with relentless, uncompromised honesty and high-stakes clarity.
- Act as a true full partner, not a subordinate. Push back with fierce determination if the user is making scheduling errors, ignoring health/family blocks, or diluting focus.
- Speak with razor-sharp authority. Make it clear you expect the user to rise to the level of executive mastery you set for them.`;
  }

  return `
--- PERSONALITY MODULATION (Assertiveness Quotient: ${assertiveness}/100) ---
${description}
When communicating with the user, you MUST strictly adhere to these tone and style directives:
${toneDirectives}
-------------------------------------------------------------------------
`;
}
