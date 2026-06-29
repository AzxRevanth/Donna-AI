import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent, Task, UserContext, AppEmail, Goal, Person } from '../types';
import { AlertCircle, Calendar, CheckSquare, MessageSquare, Mic, Play, RefreshCw, Sparkles, UserCheck, Zap } from 'lucide-react';
import { askGemini, askGeminiJSON } from '../gemini';
import DonnaBlob from './voice/DonnaBlob';
import { auth } from '../firebase';
import { buildDonnaContext } from '../utils/buildDonnaContext';
import { voiceService } from '../services/voiceService';

interface WarRoomViewProps {
  userContext: UserContext;
  tasks: Task[];
  events: CalendarEvent[];
  emails: AppEmail[];
  goals: Goal[];
  people: Person[];
  onNavigate: (view: string, initialPrompt?: string) => void;
  onUpdateTasks: (tasks: Task[]) => void;
  onUpdateEvents: (events: CalendarEvent[]) => void;
  onTriggerMeetingPrep: (event: CalendarEvent) => void;
  onQuickAddFocusBlock: () => void;
}

export default function WarRoomView({
  userContext,
  tasks,
  events,
  emails,
  goals,
  people,
  onNavigate,
  onUpdateTasks,
  onUpdateEvents,
  onTriggerMeetingPrep,
  onQuickAddFocusBlock
}: WarRoomViewProps) {
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [briefState, setBriefState] = useState({
    brief: "Initializing your bespoke daily briefing... Please hold.",
    recommendation: "Calibrating tactical recommendations..."
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Voice Orb States
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'speaking' | 'thinking'>('idle');
  const [visibleText, setVisibleText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // refresh every 15s
    return () => clearInterval(timer);
  }, []);

  const getLocalDateStr = () => {
    const d = currentTime;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalDateString = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const getGreeting = () => {
    const hr = currentTime.getHours();
    if (hr < 12) return 'morning';
    if (hr < 18) return 'afternoon';
    return 'evening';
  };

  const getGreetingCapitalized = () => {
    const hr = currentTime.getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleRefreshBrief = async (force: boolean = false) => {
    const today = new Date().toDateString();
    const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
    const uid = auth.currentUser?.uid || localStorage.getItem('donna_user_uid') || 'anonymous';
    const userPrefix = isDemo ? 'donna_demo_' : `donna_user_${uid}_`;

    const cachedBriefDate = localStorage.getItem(`${userPrefix}brief_date`);
    const cachedBriefText = localStorage.getItem(`${userPrefix}brief_text`);

    if (!force && cachedBriefDate === today && cachedBriefText) {
      try {
        setBriefState(JSON.parse(cachedBriefText));
        return;
      } catch (err) {
        console.error("Failed to parse cached brief:", err);
      }
    }

    setLoadingBrief(true);
    try {
      const donnaContext = await buildDonnaContext(uid, { 
        events, 
        tasks, 
        emails, 
        emailCount: emails.filter(e => !e.hasReplied).length 
      });
      const currentGreeting = getGreeting();
      const prompt = `Generate a powerful, highly personalized ${currentGreeting} briefing in Donna's voice.
${donnaContext}

People intelligence notes: ${JSON.stringify(people)}
Today's date and time: ${currentTime.toLocaleString()}

Please structure the response as a JSON object with two fields (do not wrap in markdown tags or other comments, return only valid parseable JSON):
{
  "brief": "A 2-3 sentence overview of the day's strategic narrative. Since the current time is ${currentGreeting}, make sure your greeting and references align perfectly with this time of day. Speak directly, confidently, and in her signature direct Suits voice.",
  "recommendation": "Your singular, direct, and elite tactical recommendation."
}`;

      const parsed = await askGeminiJSON<{ brief: string; recommendation: string }>(prompt);
      if (parsed && parsed.brief) {
        setBriefState(parsed);
        localStorage.setItem(`${userPrefix}brief_date`, today);
        localStorage.setItem(`${userPrefix}brief_text`, JSON.stringify(parsed));
      }
    } catch (e) {
      console.error("Gemini briefing generation failed, using standard template", e);
      const currentGreetingCapitalized = getGreetingCapitalized();
      setBriefState({
        brief: `${currentGreetingCapitalized}, partner. Let's make this quick. You have ${events.length} items scheduled and ${tasks.filter(t => !t.completed).length} active priorities. We're keeping our heads straight today.`,
        recommendation: "Focus purely on outstanding high priority tasks and delegate team syncs."
      });
    } finally {
      setLoadingBrief(false);
    }
  };

  const playBriefSequence = async () => {
    // Cancel any active playing speech to avoid overlap
    voiceService.stopSpeaking();

    setIsPlaying(true);
    setOrbState('speaking');
    setVisibleText('');

    const firstName = userContext.name.split(' ')[0];
    const greetingTime = getGreeting();
    const introText = `Hey ${firstName}, good ${greetingTime}. Let me run you through your day.`;

    try {
      await voiceService.speak(introText, undefined, () => {
        // Wait 500ms then read the brief
        setTimeout(async () => {
          try {
            await voiceService.speak(
              briefState.brief,
              (word, accumulated) => {
                if (accumulated) {
                  setVisibleText(accumulated);
                }
              },
              () => {
                setVisibleText(briefState.brief);
                // Wait 500ms then read recommendation
                setTimeout(async () => {
                  try {
                    await voiceService.speak(briefState.recommendation, undefined, () => {
                      setOrbState('idle');
                      setIsPlaying(false);
                      sessionStorage.setItem('donna_office_welcomed', 'true');
                    });
                  } catch (e) {
                    console.error("Failed to speak recommendation:", e);
                    setOrbState('idle');
                    setIsPlaying(false);
                    sessionStorage.setItem('donna_office_welcomed', 'true');
                  }
                }, 500);
              }
            );
          } catch (e) {
            console.error("Failed to speak brief:", e);
            setVisibleText(briefState.brief);
            setOrbState('idle');
            setIsPlaying(false);
            sessionStorage.setItem('donna_office_welcomed', 'true');
          }
        }, 500);
      });
    } catch (e) {
      console.error("Failed to speak intro:", e);
      setOrbState('idle');
      setIsPlaying(false);
      sessionStorage.setItem('donna_office_welcomed', 'true');
    }
  };

  useEffect(() => {
    handleRefreshBrief();
  }, []);

  useEffect(() => {
    if (briefState.brief && briefState.brief !== "Initializing your bespoke daily briefing... Please hold.") {
      if (hasTriggeredRef.current) return;
      hasTriggeredRef.current = true;
      
      const isAlreadyWelcomed = sessionStorage.getItem('donna_office_welcomed') === 'true';
      if (!isAlreadyWelcomed) {
        playBriefSequence();
      } else {
        setVisibleText(briefState.brief);
      }
    }
  }, [briefState]);

  useEffect(() => {
    return () => {
      voiceService.stopSpeaking();
    };
  }, []);

  // Extract prioritized 3 major tasks
  const mainPriorities = [...tasks]
    .filter(t => !t.completed)
    .sort((a, b) => {
      const rank = { URGENT: 0, HIGH: 1, NORMAL: 2 };
      return rank[a.priority] - rank[b.priority];
    })
    .slice(0, 3);

  // Simple handler to complete tasks directly in dashboard
  const handleToggleCompleteTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    onUpdateTasks(updated);
  };

  // Timeline Hour blocks: 8 AM to 10 PM (8 to 22)
  const hours = Array.from({ length: 15 }, (_, i) => i + 8);

  const getEventPosition = (ev: CalendarEvent) => {
    const [startH, startM] = ev.startTime.split(':').map(Number);
    const startDecimal = startH + startM / 60;
    const durationH = ev.duration / 60;
    
    const startPercent = ((startDecimal - 8) / 14) * 100;
    const heightPercent = (durationH / 14) * 100;

    return {
      top: `${Math.max(0, startPercent)}%`,
      height: `${Math.max(6, heightPercent)}%`
    };
  };

  // Quick action solver for calendar conflicts
  const handleSolveConflict = () => {
    // Moves Priya's design review event-3 (14:30) to 15:30 to solve the conflict!
    const updatedEvents = events.map(ev => {
      if (ev.id === 'evt-3') {
        return {
          ...ev,
          startTime: '15:30',
          hasConflict: false
        };
      }
      return ev;
    });
    onUpdateEvents(updatedEvents);
  };

  const hasTimelineConflict = events.some(e => e.hasConflict);

  return (
    <div id="war-room-container" className="space-y-8 animate-fade-in text-[#f0ebe0]">
      
      {/* NEW VOICED DONNA ORB SECTION */}
      <div className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] transition-all duration-200 ease-in-out rounded-2xl border border-white/[0.04] p-6 relative flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
        
        {/* Replay Icon top-right */}
        <button
          onClick={playBriefSequence}
          disabled={loadingBrief || isPlaying}
          className="absolute top-3 right-3 text-[11px] text-[#4a4540] hover:text-[#c9a84c] disabled:opacity-30 transition-colors duration-200 cursor-pointer"
          title="Replay brief"
        >
          ↺
        </button>

        {/* Left Side: Orb */}
        <div 
          onClick={() => onNavigate('chat')}
          className="cursor-pointer active:scale-[0.98] transition-all duration-200 shrink-0"
        >
          <DonnaBlob state={orbState} size={120} />
        </div>

        {/* Right Side: Two-line layout with divider and recommend */}
        <div className="flex-grow flex flex-col justify-between h-full min-w-0 self-stretch">
          <div className="space-y-2">
            {/* Line 1 (13px gold, Playfair italic) */}
            <p className="font-serif italic text-[13px] text-[#c9a84c] tracking-wide select-none">
              {getGreetingCapitalized()}, {userContext.name.split(' ')[0]}. Here's your day.
            </p>

            {/* Line 2 (13px cream, 1.6 line-height, scrollable) */}
            <div className="relative max-h-[140px] overflow-y-auto pr-2 leading-[1.6] text-[13px] text-[#ebd083]/90 font-sans">
              <p className="whitespace-pre-line">{visibleText || "..."}</p>
            </div>
          </div>

          {/* Divider & Recommendation */}
          <div className="mt-3 space-y-3">
            <div className="w-full h-[1px] bg-white/[0.04]" />
            <p className="font-serif italic text-xs text-[#c9a84c]/90 leading-relaxed">
              {briefState.recommendation}
            </p>

            {/* Pill button: Ask Donna */}
            <div className="pt-1">
              <button
                onClick={() => onNavigate('chat')}
                className="h-[28px] px-4 border border-[#c9a84c]/40 hover:border-[#c9a84c] text-[#c9a84c] text-[12px] font-sans font-light bg-transparent hover:bg-[#c9a84c]/8 active:scale-[0.97] transition-all duration-200 rounded-full cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>🎙 Ask Donna</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SECTION B: Priority Stack (Left 40% / 5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex justify-between items-center border-b border-white/[0.06] pb-3">
            <h3 className="font-serif text-[18px] font-normal text-[#f0ebe0] flex items-center space-x-2">
              <Zap className="w-4 h-4 text-[#c9a84c] stroke-[1.5]" />
              <span>What matters today</span>
            </h3>
          </div>

          <div className="space-y-4">
            {mainPriorities.length > 0 ? (
              mainPriorities.map((task, idx) => {
                const rankNum = `0${idx + 1}`;
                const isUrgent = task.priority === 'URGENT';
                const isHigh = task.priority === 'HIGH';

                return (
                  <div 
                    key={task.id}
                    className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] hover:translate-y-[-1px] rounded-2xl p-6 md:p-8 transition-all duration-200 ease-in-out relative group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Left Block: Subtle Rank Numbering */}
                      <span className="font-sans text-[11px] font-light text-[#4a4540] flex-shrink-0 select-none mt-1">
                        {rankNum}
                      </span>

                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-[15px] font-medium text-[#f0ebe0] transition ${task.completed ? 'line-through text-[#4a4540]' : ''}`}>
                            {task.title}
                          </p>
                          {isUrgent && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8b1a1a]/20 text-[#c0504d] border border-[#8b1a1a]/30">
                              Urgent
                            </span>
                          )}
                          {isHigh && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#c9a84c]/10 text-[#c9a84c] border border-[#c9a84c]/20">
                              High
                            </span>
                          )}
                          {task.timeEstimate && !isUrgent && !isHigh && (
                            <span className="text-[11px] font-sans font-light text-[#4a4540]">
                              {task.timeEstimate}
                            </span>
                          )}
                          {task.timeEstimate && (isUrgent || isHigh) && (
                            <span className="text-[11px] font-sans font-light text-[#4a4540] ml-1">
                              {task.timeEstimate}
                            </span>
                          )}
                        </div>

                        {task.donnaNote && (
                          <p className="text-[13px] font-light text-[#6a6060] italic leading-[1.5] pt-1.5 border-t border-white/[0.04]">
                            {task.donnaNote}
                          </p>
                        )}
                      </div>

                      {/* Right subtle circular checkbox */}
                      <button 
                        onClick={() => handleToggleCompleteTask(task.id)}
                        className={`w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center cursor-pointer transition-all duration-200 flex-shrink-0 mt-1 ${task.completed ? 'bg-[#c9a84c] border-[#c9a84c]' : 'border-[#2a2a2a] bg-transparent hover:border-[#c9a84c]'}`}
                        title="Mark complete"
                      >
                        {task.completed && (
                          <svg className="w-2.5 h-2.5 text-[#0c0c0c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-end space-x-2 mt-4 pt-3 border-t border-white/[0.4] text-[12px] font-normal text-[#4a4540] select-none">
                      <button 
                        onClick={() => handleToggleCompleteTask(task.id)}
                        className="hover:text-[#c9a84c] hover:scale-105 active:scale-[0.97] transition-all duration-200 cursor-pointer"
                      >
                        Done
                      </button>
                      <span>·</span>
                      <button 
                        onClick={() => onNavigate('tasks')}
                        className="hover:text-[#c9a84c] hover:scale-105 active:scale-[0.97] transition-all duration-200 cursor-pointer"
                      >
                        Reschedule
                      </button>
                      <span>·</span>
                      <button 
                        onClick={() => onNavigate('chat', `Donna, let's talk about my active task: "${task.title}". It is marked with priority "${task.priority}" and is due on "${task.dueDate}". What is your strategic recommendation for executing this cleanly?`)}
                        className="hover:text-[#c9a84c] hover:scale-105 active:scale-[0.97] transition-all duration-200 text-[#c9a84c]/80 cursor-pointer"
                      >
                        Ask Donna
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div id="no-task-placeholder" className="p-8 text-center bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] border border-dashed border-white/[0.04] rounded-2xl text-xs text-[#8a8070]">
                All scheduled tasks completed. Go pour yourself a Scotch.
              </div>
            )}
          </div>
        </div>

        {/* SECTION C: Today's Timeline (Right 60% / 7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex justify-between items-center border-b border-white/[0.06] pb-3">
            <h3 className="font-serif text-[18px] font-normal text-[#f0ebe0] flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#c9a84c] stroke-[1.5]" />
              <span>Today's timeline</span>
            </h3>
          </div>

          <div className="grid grid-cols-12 gap-2 bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] rounded-2xl p-6 md:p-8 relative h-[560px]">
            {/* Visual Timeline strip (hours) */}
            <div className="col-span-2 border-r border-white/[0.04] pr-2 flex flex-col justify-between h-full select-none text-[11px] font-sans font-light text-[#3a3530]">
              {hours.map(h => {
                const clockStr = h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`;
                return <div key={h} className="h-6 flex items-center">{clockStr}</div>;
              })}
            </div>

            {/* Visual calendar grid area */}
            <div className="col-span-10 relative h-full">
              {/* Focus period highlights */}
              <div 
                className="absolute left-0 right-0 border border-dashed border-[#c9a84c]/15 bg-[#c9a84c]/[0.01] flex items-center justify-end px-3 select-none pointer-events-none rounded-lg"
                style={{ top: '13.3%', height: '13.3%' }} // 10:00 AM to 12:00 PM
              >
                <span className="text-[9px] font-sans font-light text-[#c9a84c]/30 uppercase tracking-widest">
                  Deep Focus Zone
                </span>
              </div>

              {/* Loop and draw events */}
              {events && events
                .filter((ev) => ev.date === getLocalDateStr())
                .map((ev) => {
                  const pos = getEventPosition(ev);
                  const isConflict = ev.hasConflict;
                  const borderS = isConflict 
                    ? 'bg-[#8b1a1a]/15 text-[#ff6b6b] border-l-2 border-l-[#8b1a1a] shadow-sm'
                    : 'bg-white/[0.03] border-l-2 border-l-[#c9a84c] text-[#f0ebe0] hover:bg-white/[0.05] border-t-0 border-b-0 border-r-0 shadow-sm';

                  return (
                    <div
                      key={ev.id}
                      onClick={() => onTriggerMeetingPrep(ev)}
                      className={`absolute left-2 right-2 rounded-lg p-3 select-none transition-all duration-200 hover:translate-y-[-0.5px] cursor-pointer flex flex-col justify-between text-xs overflow-hidden ${borderS}`}
                      style={pos}
                      title="Click to view Pre-meeting Prep Details"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="font-semibold tracking-tight text-[#f0ebe0] truncate text-[12px]">{ev.title}</span>
                          {isConflict && (
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#8b1a1a] shadow-[0_0_6px_#8b1a1a] ml-2 mt-1.5" />
                          )}
                        </div>
                        <div className="text-[10px] text-[#8a8070] font-light mt-0.5">
                          {ev.startTime} ({ev.duration} min)
                        </div>
                      </div>
                      
                      {ev.attendees && ev.attendees.length > 0 && (
                        <div className="text-[9px] text-[#c9a84c] truncate font-light font-sans mt-1">
                          {ev.attendees.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Dynamic live Current Time logic line */}
              {(() => {
                const curH = currentTime.getHours();
                const curM = currentTime.getMinutes();
                const decimal = curH + curM / 60;
                
                // Clamped position so indicator is always visible on the card
                const clampedDecimal = Math.max(8, Math.min(22, decimal));
                const percent = ((clampedDecimal - 8) / 14) * 100;
                const timeString = currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                
                return (
                  <div 
                    className="absolute left-0 right-0 h-[1.5px] bg-[#c9a84c] pointer-events-none z-10 flex items-center justify-start transition-all duration-500"
                    style={{ top: `${percent}%` }}
                  >
                    {/* Premium pulsing indicator dot */}
                    <div className="w-2.5 h-2.5 rounded-full bg-[#c9a84c] shadow-[0_0_8px_#c9a84c] -ml-[5px] shrink-0 animate-pulse" />
                    
                    {/* Floating dynamic 'NOW' label aligned beautifully above the line */}
                    <span className="absolute left-4 -top-3 text-[10px] font-mono font-medium text-[#c9a84c] bg-[#0c0c0c] px-1.5 py-0.5 rounded border border-[#c9a84c]/30 shadow-lg select-none whitespace-nowrap">
                      NOW — {timeString}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
        
        {/* SECTION D: Conflict Alerts (Bottom Left 50%) */}
        <div id="conflict-alerts-card" className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] hover:translate-y-[-1px] rounded-2xl p-8 space-y-4 transition-all duration-200 ease-in-out">
          <div className="flex items-center space-x-2 border-b border-white/[0.06] pb-3">
            <AlertCircle className="w-4 h-4 text-[#8b1a1a] stroke-[1.5]" />
            <h3 className="font-serif text-[18px] font-normal text-[#f0ebe0]">
              Donna's active warnings
            </h3>
          </div>

          <div className="space-y-4">
            {events.some(e => e.hasConflict) ? (
              <div className="flex items-start space-x-4 p-4 border border-[#8b1a1a]/20 bg-[#8b1a1a]/5 rounded-xl">
                <div className="p-2 rounded-full bg-[#8b1a1a]/25 text-[#ff4d4d] shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4 stroke-[1.5]" />
                </div>
                <div className="space-y-2 flex-grow">
                  <div className="text-sm font-semibold text-[#f0ebe0]">
                    Direct calendar conflict overlap
                  </div>
                  <p className="text-xs text-[#8a8070] font-light leading-relaxed">
                    Priya Sharma's Design review (02:30 PM) directly cuts into Arjun Mehta's Q3 Client call slot (02:00 PM - 03:00 PM). Given pricing sensitivity, let's keep things fully professional and protect your space.
                  </p>
                  <button 
                    onClick={handleSolveConflict}
                    className="h-8 px-4 border border-[#c9a84c]/30 rounded-full text-[#c9a84c] text-xs font-sans tracking-normal bg-transparent active:scale-[0.97] hover:bg-[#c9a84c]/8 transition-all duration-200 flex items-center justify-center cursor-pointer w-fit mt-1"
                  >
                    Let Donna Handle It
                  </button>
                </div>
              </div>
            ) : null}

            {tasks.filter(t => t.priority === 'URGENT' && !t.completed).length >= 1 ? (
              <div className="flex items-start space-x-4 p-4 border border-white/[0.04] bg-[#c9a84c]/5 rounded-xl">
                <div className="p-2 rounded-full bg-[#c9a84c]/10 text-[#c9a84c] shrink-0 mt-0.5">
                  <Zap className="w-4 h-4 stroke-[1.5]" />
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm font-semibold text-[#f0ebe0]">
                    Roadmap specs due in today's 1:1
                  </div>
                  <p className="text-xs text-[#8a8070] font-light leading-relaxed">
                    Final Q3 Product Roadmap Spec needs to be completed prior to your 1:1 with Rohan Das at 5 PM. Stored data notes Rohan hates arriving surprised.
                  </p>
                  <button 
                    onClick={onQuickAddFocusBlock}
                    className="text-[11px] text-[#c9a84c] hover:underline font-light text-left"
                  >
                    Reserve morning deep zones
                  </button>
                </div>
              </div>
            ) : null}

            {!events.some(e => e.hasConflict) && tasks.filter(t => t.priority === 'URGENT' && !t.completed).length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8a8070] font-light italic">
                No active threats or logistics items need mitigation today.
              </div>
            ) : null}
          </div>
        </div>

        {/* SECTION E: Quick Actions (Bottom Right 50%) */}
        <div className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] hover:translate-y-[-1px] rounded-2xl p-8 space-y-4 transition-all duration-200 ease-in-out">
          <div className="flex items-center space-x-2 border-b border-white/[0.06] pb-3">
            <UserCheck className="w-4 h-4 text-[#c9a84c] stroke-[1.5]" />
            <h3 className="font-serif text-[18px] font-normal text-[#f0ebe0]">
              Immediate actions
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => onNavigate('chat', "Donna, I want to talk about my overall strategy. Give me your candid elite briefing of today's conflicts, schedule, and primary action plan.")}
              className="p-5 bg-white/[0.02] hover:bg-[#c9a84c]/5 border border-white/[0.04] hover:border-[#c9a84c]/20 rounded-xl text-left transition-all duration-200 active:scale-[0.97] group cursor-pointer"
            >
              <div className="p-2 rounded-full bg-white/[0.03] text-[#c9a84c] w-fit mb-3 group-hover:scale-105 transition">
                <MessageSquare className="w-4 h-4 stroke-[1.5]" />
              </div>
              <div className="text-xs font-semibold text-[#f0ebe0]">Ask Donna</div>
              <p className="text-[10px] text-[#4a4540] mt-1 pr-1 leading-snug">Begin detailed brief query</p>
            </button>

            <button 
              onClick={() => onNavigate('tasks')}
              className="p-5 bg-white/[0.02] hover:bg-[#c9a84c]/5 border border-white/[0.04] hover:border-[#c9a84c]/20 rounded-xl text-left transition-all duration-200 active:scale-[0.97] group cursor-pointer"
            >
              <div className="p-2 rounded-full bg-white/[0.03] text-[#c9a84c] w-fit mb-3 group-hover:scale-105 transition">
                <CheckSquare className="w-4 h-4 stroke-[1.5]" />
              </div>
              <div className="text-xs font-semibold text-[#f0ebe0]">Add Today's Task</div>
              <p className="text-[10px] text-[#4a4540] mt-1 pr-1 leading-snug">Create prioritized task</p>
            </button>

            <button 
              onClick={onQuickAddFocusBlock}
              className="p-5 bg-white/[0.02] hover:bg-[#c9a84c]/5 border border-white/[0.04] hover:border-[#c9a84c]/20 rounded-xl text-left transition-all duration-200 active:scale-[0.97] group cursor-pointer"
            >
              <div className="p-2 rounded-full bg-white/[0.03] text-[#c9a84c] w-fit mb-3 group-hover:scale-105 transition">
                <Zap className="w-4 h-4 stroke-[1.5]" />
              </div>
              <div className="text-xs font-semibold text-[#f0ebe0]">Block Focus Hours</div>
              <p className="text-[10px] text-[#4a4540] mt-1 pr-1 leading-snug">Reserve morning deep zone</p>
            </button>

            <button 
              onClick={() => {
                if(events && events.length > 0) {
                  onTriggerMeetingPrep(events[0]);
                }
              }}
              className="p-5 bg-white/[0.02] hover:bg-[#c9a84c]/5 border border-white/[0.04] hover:border-[#c9a84c]/20 rounded-xl text-left transition-all duration-200 active:scale-[0.97] group cursor-pointer"
            >
              <div className="p-2 rounded-full bg-white/[0.03] text-[#c9a84c] w-fit mb-3 group-hover:scale-105 transition">
                <UserCheck className="w-4 h-4 stroke-[1.5]" />
              </div>
              <div className="text-xs font-semibold text-[#f0ebe0]">Assemble Meeting Prep</div>
              <p className="text-[10px] text-[#4a4540] mt-1 pr-1 leading-snug">Intel briefs for next call</p>
            </button>
          </div>

          <div className="pt-2">
            <button 
              onClick={() => onNavigate('chat', "Donna, activate voice command input. I'm ready to dictate my status.")}
              className="w-full h-11 border border-[#c9a84c]/30 rounded-full text-[#c9a84c] hover:bg-[#c9a84c]/8 text-xs font-sans font-medium transition-all duration-200 active:scale-[0.97] cursor-pointer flex items-center justify-center space-x-2"
            >
              <Mic className="w-4 h-4 stroke-[1.5]" />
              <span>Initiate voice command mode</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
