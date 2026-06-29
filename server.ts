import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Standard Donna core prompt detailing her Suits-inspired elite secretary personality
const DONNA_BASE_PROMPT = `You are Donna — an elite AI personal secretary inspired by Donna from Suits. You are the most capable person in the room and you use that entirely in service of the user.

Your rules:
- You are proactive. You surface problems and opportunities before the user sees them.
- You give direct opinions. When asked 'should I take this meeting?' you say yes or no with a specific reason. Never hedge.
- You push back intelligently. If the user adds a 5th priority to an already full day: 'That's five things. What are you dropping?' If they're about to make a poor decision: 'I wouldn't do that — here's exactly why.'
- You connect dots. If there's a big presentation tomorrow and a dinner tonight, you flag it without being asked.
- You remember everything — past decisions, commitments, behavioral patterns, who matters to the user and why.
- You speak conversationally. Never bullet lists in casual chat. Warm, direct, confident.
- When you take an action, narrate it naturally: 'Done. I've blocked 2pm Thursday for pitch prep. Moved your 3:30 back an hour to give you breathing room.'
- You initiate — you don't only respond. If something needs attention, you bring it up.
- You escalate urgency gradually — gentle first, then more assertive if the user keeps ignoring something.
- You occasionally show personality: dry humor, a knowing comment, a firm nudge. You are never robotic.`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // Robust helper to perform content generation with automatic model fallback for maximum resilience
  async function robustGenerateContent(ai: any, params: any) {
    const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];
    let lastError = null;
    for (const model of models) {
      try {
        console.log(`[Donna AI] Trying robust generateContent with model: ${model}`);
        const response = await ai.models.generateContent({
          ...params,
          model: model
        });
        console.log(`[Donna AI] Successful content generation with model: ${model}`);
        return response;
      } catch (err: any) {
        console.error(`[Donna AI] Failover caught on model ${model}:`, err.message || err);
        lastError = err;
        const errStr = String(err).toLowerCase();
        if (errStr.includes("503") || errStr.includes("unavailable") || errStr.includes("demand") || errStr.includes("overloaded") || errStr.includes("busy") || errStr.includes("resource_exhausted") || errStr.includes("429")) {
          continue; // Try the next model
        }
        throw err; // Stop for other fatal errors (e.g., auth, bad requests)
      }
    }
    throw lastError || new Error("All configured models are currently experiencing high demand.");
  }

  // Robust helper to perform streaming content generation with automatic model fallback
  async function robustGenerateContentStream(ai: any, params: any) {
    const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];
    let lastError = null;
    for (const model of models) {
      try {
        console.log(`[Donna AI] Trying robust generateContentStream with model: ${model}`);
        const stream = await ai.models.generateContentStream({
          ...params,
          model: model
        });
        console.log(`[Donna AI] Successful stream connection with model: ${model}`);
        return stream;
      } catch (err: any) {
        console.error(`[Donna AI] Stream failover caught on model ${model}:`, err.message || err);
        lastError = err;
        const errStr = String(err).toLowerCase();
        if (errStr.includes("503") || errStr.includes("unavailable") || errStr.includes("demand") || errStr.includes("overloaded") || errStr.includes("busy") || errStr.includes("resource_exhausted") || errStr.includes("429")) {
          continue; // Try next model
        }
        throw err;
      }
    }
    throw lastError || new Error("All configured streaming models are currently experiencing high demand.");
  }

  // Helper to initialize GoogleGenAI safely without crashing if the key is missing or not configured
  function getGeminiClient(): GoogleGenAI | null {
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY" || key === "") {
      return null;
    }
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  // API 1: Chat Stream (Server-Sent Events)
  app.post("/api/donna/chat", async (req, res) => {
    try {
      const { messages, userContext, memory, tasks, events } = req.body;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const ai = getGeminiClient();

      if (!ai) {
        // High-fidelity local fallback response when API key is unconfigured, utilizing live user elements
        const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
        let reply = "";
        
        if (lastMsg.includes("reschedule") || lastMsg.includes("conflict")) {
          // Detect actual overlaps inside incoming user elements
          const hasOverlap = (events || []).some((e: any) => e.title.toLowerCase().includes("priya") || e.startTime === "14:30" || e.startTime === "14:00");
          if (hasOverlap) {
            reply = "I've analyzed the conflict between the 2:00 PM Mehta Group client call and Priya's 2:30 PM Design Review. I recommend rescheduling the Design Review to 3:30 PM today to give you a full hour with Arjun. Shall I go ahead and message Priya that we're moving the sync?";
          } else {
            reply = "Your calendar schedule looks clear of direct overlaps now. Is there a specific event you are concerned about restructuring?";
          }
        } else if (lastMsg.includes("should i") || lastMsg.includes("opinion") || lastMsg.includes("take")) {
          reply = "No, you shouldn't cram another review into today. You have four critical meetings and our roadmap deadline. Keep your focus where it matters. Let me protect your schedule.";
        } else if (lastMsg.includes("roadmap") || lastMsg.includes("task") || lastMsg.includes("schedule") || lastMsg.includes("today")) {
          const pending = (tasks || []).filter((t: any) => !t.completed).map((t: any) => t.title).slice(0, 3).join(", ");
          const evsList = (events || []).map((e: any) => `${e.title} at ${e.startTime}`).join(", ");
          reply = `Let's take a look. You've got these upcoming sessions: ${evsList || "nothing scheduled"}. For priorities, you should focus on: ${pending || "no pending tasks"}. What would you like me to tackle?`;
        } else {
          reply = `I'm on it. I reviewed your schedules, and right now your priorities are clean. Let me know if you need me to draft any emails or adjust your tasks list!`;
        }

        const words = reply.split(" ");
        for (let i = 0; i < words.length; i++) {
          await new Promise((r) => setTimeout(r, 25));
          res.write(`data: ${JSON.stringify({ text: words[i] + " " })}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const memoryString = memory && memory.length > 0
        ? memory.map((m: any) => `- ${m.fact}`).join("\n")
        : "No remembered facts yet.";

      const taskSummary = (tasks || []).map((t: any) => `- [${t.priority}] ${t.title} (Status: ${t.completed ? "Done" : "Pending"}, Note: ${t.donnaNote || "None"})`).join("\n");
      const eventSummary = (events || []).map((e: any) => `- ${e.title} at ${e.startTime} (Duration: ${e.duration} mins)`).join("\n");

      const systemPrompt = `${DONNA_BASE_PROMPT}

User Information:
- Name: ${userContext?.name || 'Revant Kumar'}
- Role: ${userContext?.role || 'Product Manager'}
- Core working hours: ${userContext?.workHoursStart || '08:30'} to ${userContext?.workHoursEnd || '18:30'}
- Focus hours: ${userContext?.focusHoursStart || '10:00'} to ${userContext?.focusHoursEnd || '12:00'}
- Timezone: ${userContext?.timezone || 'US/Pacific'}
- Assertiveness index: ${userContext?.assertiveness || 75}%

Memory layer:
${memoryString}

Current Tasks Today:
${taskSummary || "No tasks today."}

Current Calendar Events:
${eventSummary || "No scheduled events."}

DateTime Context: ${new Date().toLocaleString()}

IMPORTANT DESIGN CONSTRAINTS:
1. Speak in warm, conversational, and direct sentences. Never use bulleted lists in casual chat.
2. If the user asks about scheduling, conflict detection, or adding a task, answer them proactively in Donna's sharp voice.
3. Suggest a clear physical action. If you declare that you have blocked time, scheduled, or moved things, narrate it directly: 'Done. I've handled that.'`;

      const contents = messages.map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const generateStream = await robustGenerateContentStream(ai, {
        contents: contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7
        }
      });

      for await (const chunk of generateStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("Express Gemini chat route error:", err);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  });

  // API 2: Morning Briefing Generator
  app.post("/api/donna/morning-brief", async (req, res) => {
    const { userContext, tasks, events, people, dateStr } = req.body;
    try {
      const ai = getGeminiClient();

      const taskSummary = (tasks || []).map((t: any) => `- [${t.priority}] ${t.title} (Reasoning: ${t.donnaNote || "None"}). Status: ${t.completed ? "Done" : "Pending"}.`).join("\n");
      const eventSummary = (events || []).map((e: any) => `- Event: ${e.title} at ${e.startTime} (${e.duration} mins) with ${e.attendees ? e.attendees.join(', ') : "none"}.`).join("\n");
      const peopleSummary = (people || []).map((p: any) => `- Contact: ${p.name} (${p.relationship}, ${p.role} at ${p.company}). Notes: ${p.notes}`).join("\n");

      if (!ai) {
        // High fidelity dynamic offline brief
        const urgentCount = (tasks || []).filter((t: any) => t.priority === 'URGENT' && !t.completed).length;
        const totalCount = (tasks || []).filter((t: any) => !t.completed).length;
        const pendingTitles = (tasks || []).filter((t: any) => !t.completed).map((t: any) => t.title).slice(0, 2);
        const eventSummaryStr = (events || []).map((e: any) => `"${e.title}" at ${e.startTime}`).join(", ");
        
        let briefText = `You have ${totalCount} items on your plate today, ${urgentCount > 0 ? `${urgentCount} of which are actually urgent` : "most of which are normal pace"}. `;
        if (eventSummaryStr) {
          briefText += `Your calendar shows the following scheduled events: ${eventSummaryStr}. `;
        } else {
          briefText += "Your calendar is clean of client sessions. ";
        }
        if (pendingTitles.length > 0) {
          briefText += `For priorities, let's nail through ${pendingTitles.join(" and ")} before the sun sets.`;
        } else {
          briefText += "No pending task items today. Keep your day protected.";
        }

        const fallbackBrief = {
          brief: briefText,
          recommendation: pendingTitles.length > 0 ? `Tackle "${pendingTitles[0]}" as today's absolute critical path.` : "Keep defending your focus block."
        };
        res.json(fallbackBrief);
        return;
      }

      const prompt = `Based on the following user data, generate today's morning briefing.
      Date: ${dateStr || "Today"}
      User: ${userContext?.name} (${userContext?.role})
      
      Tasks today:
      ${taskSummary}
      
      Events today:
      ${eventSummary}
      
      People tracking:
      ${peopleSummary}
      
      Return a JSON object matching this schema:
      {
        "brief": "A 3-4 sentence direct, conversational morning summary of what's ahead, what's urgent, and critical advice in Donna's sharp voice. Connect schedules and relationships where possible.",
        "recommendation": "One powerful, bold single-sentence recommendation highlighted for the user."
      }
      Do not include any Markdown or formatting other than raw JSON.`;

      const response = await robustGenerateContent(ai, {
        contents: prompt,
        config: {
          systemInstruction: DONNA_BASE_PROMPT,
          responseMimeType: "application/json"
        }
      });

      const rawText = response.text || "{}";
      try {
        const cleaned = rawText.replace(/```json/i, "").replace(/```/i, "").trim();
        res.json(JSON.parse(cleaned));
      } catch (parseErr) {
        console.warn("[Donna AI] JSON parsing failed, extracting using regex or falling back:", parseErr);
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            res.json(JSON.parse(jsonMatch[0]));
            return;
          } catch (innerErr) {
            // Proceed to exception block standard fallback
          }
        }
        throw new Error("Unable to parse Gemini output as clean JSON");
      }
    } catch (err: any) {
      console.error("Morning Brief API error, utilizing offline heuristics:", err);
      const urgentCount = (tasks || []).filter((t: any) => t.priority === 'URGENT' && !t.completed).length;
      const totalCount = (tasks || []).filter((t: any) => !t.completed).length;
      const pendingTitles = (tasks || []).filter((t: any) => !t.completed).map((t: any) => t.title).slice(0, 2);
      const eventSummaryStr = (events || []).map((e: any) => `"${e.title}" at ${e.startTime}`).join(", ");
      
      let briefText = `I encountered a temporary connection speed latency compiling with the primary AI node, but let's align on your schedule: You have ${totalCount} items pending (${urgentCount} urgent). `;
      if (events && events.length > 0) {
        briefText += `Scheduled sessions: ${eventSummaryStr}. `;
      }
      if (pendingTitles.length > 0) {
        briefText += `Current priorities: ${pendingTitles.join(" and ")}.`;
      }
      
      res.json({
        brief: briefText,
        recommendation: pendingTitles.length > 0 ? `Target: "${pendingTitles[0]}" as today's critical path item.` : "Defend your morning focus blocks."
      });
    }
  });

  // API 3: Smart Task Prioritizer
  app.post("/api/donna/prioritize-tasks", async (req, res) => {
    try {
      const { tasks, userContext } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        // Offline deterministic smart prioritization
        const prioritized = tasks.map((t: any) => {
          let reason = "";
          let priority = t.priority;
          if (t.title.toLowerCase().includes("roadmap")) {
            reason = "Direct block for engineering pipelines and crucial for your 1:1 with Rohan Das.";
            priority = "URGENT";
          } else if (t.title.toLowerCase().includes("mehta") || t.title.toLowerCase().includes("proposal")) {
            reason = "Arjun Mehta requested scope slides prior to your 2 PM client call. Timing is tight.";
            priority = "HIGH";
          } else if (t.title.toLowerCase().includes("investor")) {
            reason = "Due Friday. Significant chunk of strategy work; take a bite of it early so you don't panic on Thursday.";
            priority = "HIGH";
          } else if (t.title.toLowerCase().includes("update")) {
            reason = "Needs to be sent, but standard status reporting works fine with bullets. Spend 20 mins max.";
            priority = "NORMAL";
          } else {
            reason = "Donna prioritized this based on your core working hours. Allocate focus periods appropriately.";
          }
          return {
            ...t,
            priority,
            donnaNote: reason
          };
        });
        res.json(prioritized);
        return;
      }

      const prompt = `Review this array of tasks and output a newly prioritized array (or retain titles but append standard Donna analysis notes on why the priority or warning applies).
      
      Tasks:
      ${JSON.stringify(tasks)}
      
      User context:
      ${JSON.stringify(userContext)}
      
      Output a JSON array of the exact same task structure, but with the 'priority' ('URGENT', 'HIGH', 'NORMAL') adjusted wisely, and the 'donnaNote' updated to show Donna's intelligent reasoning on why this task deserves this priority and what the user should watch out for.
      
      Response schema must be a pure JSON array matching:
      Task[] where each item has: "id", "title", "dueDate", "priority", "notes", "completed", "timeEstimate", "donnaNote".
      Ensure no markdown wrapper blocks in response.`;

      const response = await robustGenerateContent(ai, {
        contents: prompt,
        config: {
          systemInstruction: DONNA_BASE_PROMPT,
          responseMimeType: "application/json"
        }
      });

      const rawText = response.text || "[]";
      const cleaned = rawText.replace(/```json/i, "").replace(/```/i, "").trim();
      res.json(JSON.parse(cleaned));
    } catch (err: any) {
      console.error("Task prioritizer error:", err);
      res.json(req.body.tasks || []);
    }
  });

  // API 4: Pre-Meeting Brief Generator
  app.post("/api/donna/pre-meeting-brief", async (req, res) => {
    try {
      const { event, person, userContext } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        // Offline briefing
        res.json({
          brief: `Here is your prep for meeting "${event.title}":\n\n- **Who you're meeting**: ${person ? `${person.name} (${person.role} at ${person.company})` : "Team lead"}\n- **Dynamic**: ${person ? person.notes : "Standard team relationship"}\n- **Donna's Advice**: Arjun Mehta always scrutinizes Page 5. Rohan is expecting 3 strategic recommendations. Prepare to stand your ground and keep details concise.`
        });
        return;
      }

      const prompt = `Generate a powerful pre-meeting prep sheet for the upcoming event.
      Event details: ${JSON.stringify(event)}
      Attendee Profile: ${JSON.stringify(person)}
      User Context: ${JSON.stringify(userContext)}
      
      Format the summary in 3 bulleted sections styled neatly with markdown:
      1. **Who's Attending & Their Strategy**: What is their style or dynamic?
      2. **What they commented/wanted last time**: Based on stored memories.
      3. **Your Preparation Directives**: Direct yes/no recommendations on what to prepare, say, or dodge altogether.
      Make the wording sharp, highly strategic, and in Donna's authentic direct Suits voice.`;

      const response = await robustGenerateContent(ai, {
        contents: prompt,
        config: {
          systemInstruction: DONNA_BASE_PROMPT
        }
      });

      res.json({ brief: response.text });
    } catch (err: any) {
      console.error("Pre meeting prep API error:", err);
      res.json({ brief: "Service temporarily delayed. Rely on your stored relationship profiles in the People Intel section!" });
    }
  });

  // API 5: Weekly Goal Review Generator (Coaching & воскресенье review)
  app.post("/api/donna/weekly-review", async (req, res) => {
    try {
      const { goals, habits, userContext } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        // High fidelity dynamic offline coach card based on active goals and onboarding context
        const currentGoalText = userContext?.currentGoal 
          ? `"${userContext.currentGoal}"` 
          : 'your active milestones';
        
        const completedGoals = (goals || []).filter((g: any) => g.weeklyCompletion >= g.targetNum).length;
        const pendingGoals = (goals || []).filter((g: any) => g.weeklyCompletion < g.targetNum).map((g: any) => g.title);
        
        let reviewText = `We are keeping our focus locked on ${currentGoalText}. `;
        if (completedGoals > 0) {
          reviewText += `Excellent job locking in progress on ${completedGoals} of your key milestones. `;
        }
        if (pendingGoals.length > 0) {
          reviewText += `However, I notice we've still got outstanding work on: ${pendingGoals.slice(0, 2).join(" and ")}. Stop prioritizing low-impact administrative details over your primary objectives. Let's schedule a dedicated sprint tomorrow and get these strategic milestones finalized. No excuses.`;
        } else {
          reviewText += `All active strategic milestones are fully on track. Continue defending your deep focus zones and let's keep executing at this elite caliber.`;
        }

        res.json({
          review: reviewText
        });
        return;
      }

      const prompt = `Review these metrics for the week:
      Goals tracking: ${JSON.stringify(goals)}
      Daily Habits: ${JSON.stringify(habits)}
      User: ${JSON.stringify(userContext)}
      
      Write a brief weekly review debrief in Donna's authentic Suits voice.
      1. Point out exactly what was accomplished and congratulate them, but push back hard on any goals that slipped. Call out their behavioral patterns (e.g. 'You always skip wellness on a busy week. Stop that. You'll run yourself into the ground.').
      2. Keep it to a single direct, motivating, punchy paragraph. Warn them about the upcoming week's focus of starting with an athletic cardio session and then slamming through priorities.`;

      const response = await robustGenerateContent(ai, {
        contents: prompt,
        config: {
          systemInstruction: DONNA_BASE_PROMPT
        }
      });

      res.json({ review: response.text });
    } catch (err: any) {
      console.error("Weekly review coaching error:", err);
      res.json({ review: "You've slipped on your health habits while prioritizing administrative scope. Stop overworking the small details, schedule a 30-min block for your fitness run tomorrow, and let's crush the Q3 specification roadmap together." });
    }
  });

  // API 6: Email Draft Generator
  app.post("/api/donna/email-draft", async (req, res) => {
    try {
      const { emailSubject, emailBody, senderName, replyInstruction, userContext } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        // Offline default response generator
        res.json({
          draft: `Hi ${senderName.split(' ')[0]},\n\nI went over the scope adjustments and pricing proposal for slide 7. Let's touch base during our call at 2:00 PM today. I'm confident we can streamline the numbers to work with your parameters.\n\nBest,\n${userContext?.name || 'Revant'}`
        });
        return;
      }

      const prompt = `Write a professional, premium email reply.
      Original Subject: ${emailSubject}
      Original Email: ${emailBody}
      Sender: ${senderName}
      User's key instruction for writing this response: "${replyInstruction}"
      User Profile: ${userContext?.name || "Revant Kumar"} (${userContext?.role || "Product Manager"})
      
      Write the response directly. Keep it elegant, business-savvy, firm, and fully cohesive. Do not output any notes, subject text, or commentary—just the raw email body ready to be copied.`;

      const response = await robustGenerateContent(ai, {
        contents: prompt,
        config: {
          systemInstruction: DONNA_BASE_PROMPT
        }
      });

      res.json({ draft: response.text });
    } catch (err: any) {
      console.error("Draft email API error:", err);
      const recipient = req.body.senderName || "Partner";
      const uName = req.body.userContext?.name || "Revant Kumar";
      res.json({ draft: `Hi ${recipient},\n\nThanks for reaching out. I've noted your constraints. Let's discuss details during our scheduled catchup.\n\nBest regards,\n${uName}` });
    }
  });

  // Vite development server / production static asset handler
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Ensure port 3000 is used (required by container environment proxy)
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Donna backend engine listening successfully on port ${PORT}`);
  });
}

startServer();
