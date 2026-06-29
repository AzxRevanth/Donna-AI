import React, { useState, useEffect } from 'react';
import { Task, UserContext } from '../types';
import { AlertCircle, Calendar, CheckSquare, Clock, Plus, RefreshCw, Trash2, Zap } from 'lucide-react';
import { askGemini, askGeminiJSON } from '../gemini';

interface TasksViewProps {
  userContext: UserContext;
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  onNavigate: (view: string, initialPrompt?: string) => void;
}

export default function TasksView({
  userContext,
  tasks,
  onUpdateTasks,
  onNavigate
}: TasksViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'priority'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [prioritizing, setPrioritizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleSmartCalibration = async (force: boolean = false) => {
    // Cache check: only calibrate with Gemini if tasks changed or last ranking was > 2 hours ago
    const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
    const uid = localStorage.getItem('donna_user_uid') || 'anonymous';
    const userPrefix = isDemo ? 'donna_demo_' : `donna_user_${uid}_`;

    const lastRanked = localStorage.getItem(`${userPrefix}ranked_at`);
    const rankedTasks = localStorage.getItem(`${userPrefix}ranked_tasks`);
    const cachedTaskIds = localStorage.getItem(`${userPrefix}ranked_task_ids`);
    const currentTaskIds = JSON.stringify(tasks.map(t => t.id).sort());
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

    if (!force && 
        lastRanked && parseInt(lastRanked) > twoHoursAgo && 
        rankedTasks && 
        cachedTaskIds === currentTaskIds) {
      try {
        const parsed = JSON.parse(rankedTasks);
        onUpdateTasks(parsed);
        return;
      } catch (err) {
        console.error("Failed to load cached ranked tasks:", err);
      }
    }

    // Skip automatically running calibration on mount if tasks are empty or we're already prioritizing
    if (tasks.length === 0) return;

    setPrioritizing(true);
    try {
      const prompt = `Review these active tasks for the user:
${tasks.map(t => `- [${t.priority}] ${t.title} (due: ${t.dueDate}, notes: ${t.notes || 'none'}, current note: ${t.donnaNote || 'none'})`).join('\n')}

Based on user role: ${userContext.role} (and timezone ${userContext.timezone}), analyze and reorganize these tasks.
Assign an appropriate priority ('URGENT', 'HIGH', 'NORMAL') and write a signature Donna note ('donnaNote') for each task detailing your elite Suits-style direct opinion on why it holds this priority or how the user should navigate it. Avoid robotic or passive summaries. Speak directly and confidently.

Return a JSON array of objects matching this exact structure (no Markdown wrapper blocks):
[
  {
    "title": "exact task title matches the original title above",
    "priority": "URGENT" | "HIGH" | "NORMAL",
    "donnaNote": "Your smart custom analysis note"
  }
]`;

      const updatedList = await askGeminiJSON<any[]>(prompt);
      if (Array.isArray(updatedList)) {
        const storedTasksMetadata = JSON.parse(localStorage.getItem(`${userPrefix}tasks_metadata`) || '{}');
        
        const calibrated = tasks.map(t => {
          const match = updatedList.find(u => u.title?.toLowerCase() === t.title?.toLowerCase());
          if (match) {
            storedTasksMetadata[t.id] = {
              priority: match.priority || t.priority,
              donnaNote: match.donnaNote || t.donnaNote,
              timeEstimate: t.timeEstimate || '1h'
            };
            return {
              ...t,
              priority: match.priority || t.priority,
              donnaNote: match.donnaNote || t.donnaNote
            };
          }
          return t;
        });
        
        localStorage.setItem(`${userPrefix}tasks_metadata`, JSON.stringify(storedTasksMetadata));
        localStorage.setItem(`${userPrefix}ranked_at`, Date.now().toString());
        localStorage.setItem(`${userPrefix}ranked_tasks`, JSON.stringify(calibrated));
        localStorage.setItem(`${userPrefix}ranked_task_ids`, currentTaskIds);
        onUpdateTasks(calibrated);
        if (force) {
          setStatusMessage({
            text: "Calibration complete, partner. I've restructured your stack. Check my notes on why we're doing slide reviews first.",
            type: 'success'
          });
          setTimeout(() => setStatusMessage(null), 5000);
        }
      }
    } catch (err) {
      console.error("Calibration failed", err);
      if (force) {
        setStatusMessage({
          text: "Calibration failed. Please verify your connection.",
          type: 'error'
        });
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } finally {
      setPrioritizing(false);
    }
  };

  // Run smart calibration on load (respects cache check so it won't fire a call if already cached and fresh)
  useEffect(() => {
    handleSmartCalibration(false);
  }, []);

  // Form states
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL'>('NORMAL');
  const [notes, setNotes] = useState('');
  const [letDonnaPrioritize, setLetDonnaPrioritize] = useState(true);

  const handleToggleComplete = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    onUpdateTasks(updated);
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    onUpdateTasks(updated);
  };

  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalPriority = priority;
    let finalNote = "Personally logged by Partner.";
    let finalEstimate = "1h";

    if (letDonnaPrioritize) {
      setPrioritizing(true);
      try {
        // Query server to let Donna prioritize this single task in context with other tasks!
        const response = await fetch("/api/donna/prioritize-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks: [{ id: "temp", title, dueDate, priority: 'NORMAL', notes }],
            userContext
          })
        });
        const prioritized = await response.json();
        if (prioritized && prioritized.length > 0) {
          finalPriority = prioritized[0].priority;
          finalNote = prioritized[0].donnaNote || "A recommended focus item.";
          finalEstimate = prioritized[0].timeEstimate || "1.5h";
        }
      } catch (err) {
        console.error("AI task prioritization failed, fallback standard values:", err);
      } finally {
        setPrioritizing(false);
      }
    } else {
      // Heuristics basic estimate based on words
      const words = title.toLowerCase();
      if (words.includes("review") || words.includes("deck")) finalEstimate = "1.5h";
      else if (words.includes("brief") || words.includes("proposal") || words.includes("roadmap")) finalEstimate = "3h";
      else if (words.includes("call") || words.includes("meeting")) finalEstimate = "30m";
      else finalEstimate = "45m";
    }

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title,
      dueDate,
      priority: finalPriority,
      notes,
      completed: false,
      timeEstimate: finalEstimate,
      donnaNote: finalNote
    };

    onUpdateTasks([newTask, ...tasks]);
    setTitle('');
    setNotes('');
    setLetDonnaPrioritize(true);
    setShowAddForm(false);
  };

  // Filter conditions
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'today') {
      return task.dueDate === todayStr;
    }
    if (activeTab === 'upcoming') {
      return task.dueDate > todayStr;
    }
    if (activeTab === 'priority') {
      return task.priority === 'URGENT' || task.priority === 'HIGH';
    }
    return true; // 'all'
  });

  const pendingTodayCount = tasks.filter(t => t.dueDate === todayStr && !t.completed).length;
  const isOverloaded = pendingTodayCount >= 4;

  return (
    <div id="task-center-container" className="space-y-6 animate-fade-in pr-1">

      <div className="flex justify-between items-end border-b border-white/[0.06] pb-4">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-[#f0ebe0] font-normal">
            Task center
          </h2>
          <p className="text-[11px] font-sans font-light text-[#8a8070] mt-1">
            Total ledger volume: {tasks.length} items logged
          </p>
        </div>

        {statusMessage && (
          <div className={`text-xs px-4 py-2 bg-neutral-900 border font-sans select-none rounded-xl self-center ${
            statusMessage.type === 'success' 
              ? 'bg-[#ebd083]/10 border-[#c9a84c]/20 text-[#ebd083]' 
              : 'bg-red-950/20 border-red-500/10 text-red-400'
          }`}>
            {statusMessage.text}
          </div>
        )}

        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleSmartCalibration(true)}
            disabled={prioritizing}
            className="h-9 px-5 border border-[#c9a84c]/40 hover:bg-[#c9a84c]/8 text-[#c9a84c] font-sans font-medium text-xs rounded-full active:scale-[0.97] transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${prioritizing ? 'animate-spin' : ''}`} />
            <span>Donna's Smart Calibration</span>
          </button>
          
          <button
            onClick={() => setShowAddForm(true)}
            className="h-9 px-5 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] font-sans font-medium text-xs rounded-full active:scale-[0.97] transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>New task ledger</span>
          </button>
        </div>
      </div>

      {/* OVERLOAD WARNING SUMMARY CARD */}
      {isOverloaded && (
        <div id="overload-warn-banner" className="bg-[#8b1a1a]/15 border border-[#8b1a1a]/30 p-6 rounded-2xl flex items-start space-x-4 relative overflow-hidden shadow-md">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-[#8b1a1a]/5 blur-lg pointer-events-none" />
          <div className="p-2 rounded-full bg-[#8b1a1a]/25 text-[#ff4d4d] shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 stroke-[1.5] animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-sans font-light text-[#ff4d4d] tracking-wider uppercase">
              Donna's resource warning
            </div>
            <p className="text-xs text-[#f0ebe0] font-light leading-relaxed mt-1 font-sans">
              "You have {pendingTodayCount} active items scheduled for today. Realistically, you are going to finish 3 of them with high focus. The rest are administrative noise. Let's make sure you get the Roadmap spec done, and shove the team email updates to the bottom."
            </p>
          </div>
        </div>
      )}

      {/* TAB NAVIGATION AND CONTAINER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Tab Filters */}
        <div className="flex md:flex-col overflow-x-auto gap-1 select-none md:border-r md:border-white/[0.04] md:pr-4">
          {[
            { id: 'all', label: 'All operations' },
            { id: 'today', label: 'Immediate today' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'priority', label: 'Core urgents' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`text-[13px] font-sans font-normal text-left h-[40px] px-4 rounded-lg transition-all duration-200 shrink-0 cursor-pointer ${activeTab === tab.id ? 'bg-[#c9a84c]/8 text-[#c9a84c]' : 'hover:bg-white/[0.03] text-[#8a8070] hover:text-[#f0ebe0]'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task Cards Stack */}
        <div className="md:col-span-3 space-y-4">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => {
              const isUrgent = task.priority === 'URGENT';
              const isHigh = task.priority === 'HIGH';

              return (
                <div
                  key={task.id}
                  className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] hover:translate-y-[-1px] transition-all duration-200 ease-in-out border-none rounded-2xl p-7 md:p-8 space-y-4 relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 pr-8">
                      {/* Subtly styled circular checkbox */}
                      <button
                        onClick={() => handleToggleComplete(task.id)}
                        className={`w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center cursor-pointer transition-all duration-200 flex-shrink-0 mt-1 ${task.completed ? 'bg-[#c9a84c] border-[#c9a84c]' : 'border-[#2a2a2a] bg-transparent hover:border-[#c9a84c]'}`}
                      >
                        {task.completed && (
                          <svg className="w-2.5 h-2.5 text-[#0c0c0c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      
                      <div className="space-y-1">
                        <h4 className={`text-[15px] font-medium transition ${task.completed ? 'line-through text-[#4a4540]' : 'text-[#f0ebe0]'}`}>
                          {task.title}
                        </h4>
                        <div className="flex items-center space-x-3 text-[11px] font-sans font-light text-[#4a4540]">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 stroke-[1.2]" />
                            <span>Due: {task.dueDate}</span>
                          </span>
                          <span>·</span>
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 stroke-[1.2]" />
                            <span>{task.timeEstimate || '1h'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 select-none shrink-0">
                      {isUrgent && (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#8b1a1a]/20 text-[#c0504d] border border-[#8b1a1a]/30">
                          Urgent
                        </span>
                      )}
                      {isHigh && (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#c9a84c]/10 text-[#c9a84c] border border-[#c9a84c]/20">
                          High
                        </span>
                      )}
                    </div>
                  </div>

                  {task.notes && (
                    <p className="text-[13px] font-light text-[#6a6060] italic leading-[1.5] pl-[34px]">
                      {task.notes}
                    </p>
                  )}

                  {task.donnaNote && (
                    <div className="pl-[34px] pt-3 mt-2 border-t border-white/[0.04] flex items-start space-x-2">
                      <Zap className="w-3.5 h-3.5 text-[#c9a84c] shrink-0 mt-0.5 stroke-[1.5]" />
                      <p className="text-xs text-[#c9a84c]/80 italic">
                        {task.donnaNote}
                      </p>
                    </div>
                  )}

                  {/* Operational actions footer */}
                  <div className="flex items-center justify-end pl-[34px] text-[12px] font-normal text-[#4a4540] select-none pt-1">
                    <button
                      onClick={() => handleToggleComplete(task.id)}
                      className="hover:text-[#c9a84c] hover:scale-105 active:scale-[0.97] transition-all duration-200 cursor-pointer"
                    >
                      {task.completed ? "Mark unfinished" : "Mark finished"}
                    </button>
                    <span className="mx-2">·</span>
                    <button
                      onClick={() => onNavigate('chat', `Donna, let's talk about my active task: "${task.title}". It is marked with priority "${task.priority}" and is due on "${task.dueDate}". How can we refactor our strategy or delegate to tackle this?`)}
                      className="hover:text-[#c9a84c] hover:scale-105 active:scale-[0.97] transition-all duration-200 text-[#c9a84c]/80 cursor-pointer"
                    >
                      Refactor strategy with Donna
                    </button>
                    <span className="mx-2">·</span>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="hover:text-red-500 hover:scale-105 active:scale-[0.97] transition-all duration-200 text-red-700/80 cursor-pointer flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3 stroke-[1.5]" />
                      <span>Archive ledger</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] border border-dashed border-white/[0.04] rounded-2xl text-xs text-[#8a8070]">
              No tasks currently tracked under this folder. Clear sky.
            </div>
          )}
        </div>
      </div>

      {/* MODAL / SLIDEOUT PANEL FOR ADD TASK */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[rgba(20,18,14,0.6)] backdrop-blur-[40px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] hover:translate-y-[-1px] transition-all duration-200 ease-in-out border border-[#c9a84c]/15 rounded-2xl p-6 md:p-8 relative space-y-6">
            <div className="flex justify-between items-center border-b border-white/[0.06] pb-3">
              <h3 className="font-serif text-lg text-[#f0ebe0] font-normal flex items-center space-x-2">
                <CheckSquare className="w-4 h-4 text-[#c9a84c] stroke-[1.5]" />
                <span>Add task ledger</span>
              </h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-xs text-[#8a8070] hover:text-[#f0ebe0] transition cursor-pointer font-sans font-light"
              >
                Close (ESC)
              </button>
            </div>

            <form onSubmit={handleAddTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                  Task Label / Core Objective
                </label>
                <input 
                  type="text"
                  required
                  className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                  placeholder="e.g., Finalize design tokens slide deck"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Deadline Date
                  </label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Fallback Priority Preset
                  </label>
                  <select 
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                  >
                    <option value="NORMAL">Normal pace</option>
                    <option value="HIGH">High priority</option>
                    <option value="URGENT">Urgent requirement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                  Strategic Notes & Parameters
                </label>
                <textarea 
                  rows={3}
                  className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
                  placeholder="Add details, links, or comments..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="bg-[#1a1810]/40 p-4 border border-[#c9a84c]/20 flex items-start space-x-3 rounded-xl">
                <input 
                  type="checkbox"
                  id="let-donna-prioritize"
                  className="mt-1 cursor-pointer accent-[#c9a84c]"
                  checked={letDonnaPrioritize}
                  onChange={(e) => setLetDonnaPrioritize(e.target.checked)}
                />
                <div>
                  <label htmlFor="let-donna-prioritize" className="block text-xs font-semibold text-[#c9a84c] cursor-pointer select-none">
                    Prioritize using Donna's AI core
                  </label>
                  <p className="text-[10px] text-[#8a8070] mt-0.5 leading-snug">
                    If enabled, Donna's backend will review your current schedules, calculate real complexity, determine correct priority, and compile custom advisory notes.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="h-10 px-5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] text-[#8a8070] hover:text-[#f0ebe0] text-xs font-sans font-light rounded-full transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={prioritizing}
                  className="h-10 px-6 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] text-xs font-sans font-medium rounded-full active:scale-[0.97] transition-all duration-200 cursor-pointer flex items-center space-x-1.5"
                >
                  {prioritizing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0c0c0c]" />
                      <span>Asking Donna...</span>
                    </>
                  ) : (
                    <span>Add to general ledger</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
