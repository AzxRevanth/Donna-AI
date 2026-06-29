import React, { useState } from 'react';
import { CalendarEvent, Person, UserContext } from '../types';
import { AlertCircle, Calendar, Clock, Plus, RefreshCw, Users, ShieldAlert, Sparkles } from 'lucide-react';
import { askGemini } from '../gemini';

interface CalendarViewProps {
  userContext: UserContext;
  events: CalendarEvent[];
  people: Person[];
  onUpdateEvents: (events: CalendarEvent[]) => void;
  onNavigate: (view: string) => void;
  selectedPrepEvent: CalendarEvent | null;
  onClearSelectedPrep: () => void;
}

export default function CalendarView({
  userContext,
  events,
  people,
  onUpdateEvents,
  onNavigate,
  selectedPrepEvent,
  onClearSelectedPrep
}: CalendarViewProps) {
  const [activeMode, setActiveMode] = useState<'week' | 'day' | 'month'>('week');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [briefResponse, setBriefResponse] = useState<string>('');

  // Form states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [attendeeText, setAttendeeText] = useState('');
  const [description, setDescription] = useState('');

  const [activePrepMeeting, setActivePrepMeeting] = useState<CalendarEvent | null>(selectedPrepEvent || null);

  // Generate date markers for the week: Monday to Sunday of current week
  const getWeekDates = () => {
    const dates = [];
    const current = new Date();
    // Start of week (Monday)
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(current.setDate(diff));

    for (let i = 0; i < 7; i++) {
      const next = new Date(monday);
      next.setDate(monday.getDate() + i);
      dates.push(next);
    }
    return dates;
  };

  const weekDays = getWeekDates();

  const handleFetchPrepBrief = async (ev: CalendarEvent) => {
    setActivePrepMeeting(ev);
    setLoadingBrief(true);
    setBriefResponse('');

    // Attempt to locate associated person profile from People database!
    const matchingPerson = people.find(p => {
      if (!ev.attendees) return false;
      return ev.attendees.some(aName => p.name.toLowerCase().includes(aName.toLowerCase()));
    });

    try {
      const prompt = `Generate a powerful pre-meeting prep sheet for the upcoming event.
Event details: ${JSON.stringify(ev)}
Attendee Profile: ${JSON.stringify(matchingPerson || null)}
User Context: ${JSON.stringify(userContext)}

Format the summary in 3 bulleted sections styled neatly with markdown:
1. **Who's Attending & Their Strategy**: What is their style or dynamic?
2. **What they commented/wanted last time**: Based on stored memories.
3. **Your Preparation Directives**: Direct yes/no recommendations on what to prepare, say, or dodge altogether.
Make the wording sharp, highly strategic, and in Donna's authentic direct Suits voice (opinionated, elite, warm, concise).`;

      const brief = await askGemini(prompt);
      setBriefResponse(brief);
    } catch (e) {
      console.error(e);
      setBriefResponse("Offline mode: Prepare to negotiate billing models. Stored reports show client Arjun Mehta prefers concise emails and raw numbers.");
    } finally {
      setLoadingBrief(false);
    }
  };

  React.useEffect(() => {
    if (selectedPrepEvent) {
      handleFetchPrepBrief(selectedPrepEvent);
    }
  }, [selectedPrepEvent]);

  const handleAddEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Split attendee comma values
    const attendeeList = attendeeText
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title,
      date,
      startTime,
      duration: Number(duration),
      attendees: attendeeList,
      description
    };

    // Quick overlap conflict check!
    const updatedEvents = [...events, newEvent].map((ev, idx, arr) => {
      const overlaps = arr.filter(other => {
        if (other.id === ev.id || other.date !== ev.date) return false;
        
        const [h1, m1] = ev.startTime.split(':').map(Number);
        const [h2, m2] = other.startTime.split(':').map(Number);

        const evStart = h1 * 60 + m1;
        const evEnd = evStart + ev.duration;

        const otherStart = h2 * 60 + m2;
        const otherEnd = otherStart + other.duration;

        const overlapOverlap = Math.max(evStart, otherStart) < Math.min(evEnd, otherEnd);
        return overlapOverlap;
      });

      if (overlaps.length > 0) {
        return { ...ev, hasConflict: true };
      }
      return ev;
    });

    onUpdateEvents(updatedEvents);
    setTitle('');
    setAttendeeText('');
    setDescription('');
    setShowAddEvent(false);
  };

  const handleDeleteEvent = (id: string) => {
    const updated = events.filter(e => e.id !== id);
    onUpdateEvents(updated);
    if (activePrepMeeting?.id === id) {
      setActivePrepMeeting(null);
    }
  };

  return (
    <div id="calendar-intelligence-view" className="space-y-6 animate-fade-in pr-1">
      
      <div className="flex justify-between items-end border-b border-white/[0.06] pb-4 select-none">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-[#f0ebe0] font-normal">
            Executive calendar intel
          </h2>
          <p className="text-[11px] font-sans font-light text-[#8a8070] mt-1">
            Active workspace integration synchronized
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Toggles */}
          <div className="flex bg-white/[0.02] p-1 border border-white/[0.04] rounded-full">
            {['week', 'day', 'month'].map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveMode(mode as any)}
                className={`text-[11px] font-sans font-light px-3.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${activeMode === mode ? 'bg-[#c9a84c] text-[#0c0c0c] font-normal' : 'text-[#8a8070] hover:text-[#f0ebe0]'}`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddEvent(true)}
            className="h-9 px-5 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] font-sans font-medium text-xs rounded-full active:scale-[0.97] transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add event</span>
          </button>
        </div>
      </div>

      {/* Donna's Scheduling Advisor Box */}
      <div className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] hover:translate-y-[-1px] rounded-2xl p-6 border border-[#c9a84c]/20 flex items-start space-x-4 select-none duration-200 transition-all ease-in-out">
        <Sparkles className="w-4.5 h-4.5 text-[#c9a84c] shrink-0 mt-0.5 stroke-[1.5]" />
        <div>
          <div className="text-[11px] font-sans font-medium text-[#c8a94e] uppercase tracking-wider">
            Donna's schedule advisory
          </div>
          <p className="text-xs text-[#f0ebe0] font-light mt-1 pr-4 leading-relaxed font-sans">
            "Your calendar overlaps around 2 PM is highly risky today. I've highlighted Priya Sharma's Design review in red conflict indicator. To safeguard precious client negotiations, you should move Priya to 3:30 PM — I have already drafted a buffer block for your morning."
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* CALENDAR WEEK/DAY VIEW AREA */}
        <div className="lg:col-span-8 bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border-none rounded-2xl p-6 md:p-8 space-y-4">
          <div className="grid grid-cols-7 gap-2 select-none text-center border-b border-white/[0.04] pb-3 text-[11px] font-sans font-light text-[#8a8070]">
            {weekDays.map((d, i) => {
              const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
              return (
                <div key={i} className={`p-1.5 rounded-xl flex flex-col items-center`}>
                  <span className="text-[10px] uppercase font-mono tracking-tight">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className={`text-[13px] font-medium font-sans tracking-tight mt-1 h-6 w-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#c9a84c]/20 text-[#c9a84c] font-semibold' : 'text-[#f0ebe0]'}`}>{d.getDate()}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            {events && events.length > 0 ? (
              [...events]
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(ev => {
                  const isConflict = ev.hasConflict;
                  const isSelected = activePrepMeeting?.id === ev.id;
                  const cardBg = isConflict 
                    ? 'border-l-2 border-l-[#8b1a1a] bg-[#8b1a1a]/15 text-[#ff6b6b]' 
                    : isSelected
                      ? 'border-l-2 border-l-[#c9a84c] bg-[#c9a84c]/8'
                      : 'border-l-2 border-l-[#4a4540] bg-white/[0.03] hover:bg-white/[0.05] hover:translate-y-[-0.5px]';

                  return (
                    <div
                      key={ev.id}
                      onClick={() => handleFetchPrepBrief(ev)}
                      className={`border-t-0 border-r-0 border-b-0 rounded-r-xl p-5 transition-all duration-200 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${cardBg}`}
                      title="Click to view Pre-meeting Prep Details"
                    >
                      <div className="flex items-start space-x-3.5">
                        <div className={`p-2 rounded-full shrink-0 ${isConflict ? 'bg-[#8b1a1a]/25 text-[#ff4d4d]' : 'bg-[#c9a84c]/10 text-[#c9a84c]'}`}>
                          {isConflict ? <ShieldAlert className="w-4 h-4 stroke-[1.5]" /> : <Calendar className="w-4 h-4 stroke-[1.5]" />}
                        </div>
                        <div className="space-y-1 pr-6">
                          <h4 className="text-[15px] font-medium text-[#f0ebe0] font-sans flex items-center gap-2">
                            <span>{ev.title}</span>
                            {isConflict && (
                              <span className="text-[10px] font-sans font-light bg-[#8b1a1a]/25 text-[#ff6b6b] px-2 py-0.5 rounded-full border border-[#8b1a1a]/40">
                                Overlap conflict
                              </span>
                            )}
                          </h4>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-sans font-light text-[#8a8070]">
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3.5 h-3.5 stroke-[1.2]" />
                              <span>{ev.startTime} ({ev.duration}m)</span>
                            </span>
                            <span>·</span>
                            <span className="text-[#8a8070] italic">Date: {ev.date}</span>
                          </div>
                          {ev.description && (
                            <p className="text-[12px] text-[#8a8070] font-light mt-1 leading-relaxed">
                              {ev.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 md:self-center select-none shrink-0 w-full md:w-auto justify-between md:justify-end border-t border-white/[0.04] md:border-none pt-3 md:pt-0">
                        {ev.attendees && ev.attendees.length > 0 ? (
                          <div className="text-[11px] font-sans font-light text-[#c9a84c] flex items-center space-x-1">
                            <Users className="w-3.5 h-3.5 stroke-[1.2]" />
                            <span>{ev.attendees.join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-sans font-light text-[#4a4540]">No partners</span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(ev.id);
                          }}
                          className="text-[12px] font-normal text-[#4a4540] hover:text-red-500 transition-all duration-200 cursor-pointer bg-transparent border-none p-0"
                        >
                          Cancel meeting
                        </button>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="p-12 text-center bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] border border-dashed border-white/[0.04] rounded-2xl text-xs text-[#8a8070]">
                All cleared. No active events matching.
              </div>
            )}
          </div>
        </div>

        {/* PRE MEETING INTELLIGENCE SIDEBAR DRAWER */}
        <div id="premeeting-brief-sidebar" className="lg:col-span-4 bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border-none rounded-2xl p-6 md:p-8 flex flex-col justify-between h-[510px] relative">
          <div className="space-y-4 overflow-y-auto max-h-[400px] pr-1 scrollbar-none">
            <div className="flex items-center space-x-2 border-b border-white/[0.04] pb-3">
              <Sparkles className="w-4 h-4 text-[#c9a84c] stroke-[1.5]" />
              <h3 className="font-serif text-[15px] font-normal text-[#f0ebe0]">
                Donna's pre-meeting brief
              </h3>
            </div>

            {activePrepMeeting ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-sans font-light tracking-wider text-[#8a8070]">
                    Active dossier
                  </div>
                  <h4 className="text-[13px] font-medium text-[#f0ebe0] font-sans">
                    {activePrepMeeting.title}
                  </h4>
                </div>

                {loadingBrief ? (
                  <div className="p-8 text-center space-y-2 select-none">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#c9a84c] mx-auto" />
                    <p className="text-[10px] font-sans font-light text-[#8a8070] uppercase">
                      Donna's secretary core compiling dossier...
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-[#8a8070] font-light leading-relaxed font-sans space-y-3 bg-black/[0.2] p-4 border border-white/[0.04] rounded-xl">
                    {briefResponse ? (
                      <div className="whitespace-pre-wrap">{briefResponse}</div>
                    ) : (
                      <p className="italic">
                        Click on any logged calendar block to retrieve Donna's personalized administrative agenda and profile preparation notes.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-[#8a8070] font-light italic">
                Select any calendar block from the timeline to initiate Donna's pre-meeting dossier assembly.
              </div>
            )}
          </div>

          <button 
            onClick={() => onNavigate('people')}
            className="w-full h-10 border border-[#c9a84c]/30 rounded-full text-[#c9a84c] hover:bg-[#c9a84c]/8 text-xs font-sans font-medium transition-all duration-200 active:scale-[0.97] cursor-pointer"
          >
            Review people profiles ledger
          </button>
        </div>

      </div>

      {/* EVENT ADD DIALOG / MODAL */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[rgba(20,18,14,0.6)] backdrop-blur-[40px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-[#c9a84c]/15 rounded-2xl p-6 md:p-8 relative space-y-6">
            <div className="flex justify-between items-center border-b border-white/[0.06] pb-3">
              <h3 className="font-serif text-lg text-[#f0ebe0] font-normal flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#c9a84c] stroke-[1.5]" />
                <span>Reserve calendar block</span>
              </h3>
              <button 
                onClick={() => setShowAddEvent(false)}
                className="text-xs text-[#8a8070] hover:text-[#f0ebe0] transition cursor-pointer font-sans font-light"
              >
                Close (ESC)
              </button>
            </div>

            <form onSubmit={handleAddEventSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                  Meeting Title / Subject
                </label>
                <input 
                  type="text"
                  required
                  className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                  placeholder="e.g., Board Alignment or Design Review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Date
                  </label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none font-sans"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Start Time
                  </label>
                  <input 
                    type="time"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none font-sans"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Duration (mins)
                  </label>
                  <input 
                    type="number"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none font-sans"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                  Attendees (comma separated names)
                </label>
                <input 
                  type="text"
                  className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                  placeholder="Priya Sharma, Rohan Das"
                  value={attendeeText}
                  onChange={(e) => setAttendeeText(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                  Meeting Description
                </label>
                <textarea 
                  rows={2}
                  className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
                  placeholder="Core metrics alignment..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddEvent(false)}
                  className="h-10 px-5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] text-[#8a8070] hover:text-[#f0ebe0] text-xs font-sans font-light rounded-full transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-6 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] text-xs font-sans font-medium rounded-full active:scale-[0.97] transition-all duration-200 cursor-pointer"
                >
                  Book block & check conflicts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
