import React, { useState, useEffect } from 'react';
import { Goal, GoalCategory, Habit, UserContext } from '../types';
import { 
  AlertCircle, Check, CheckSquare, RefreshCw, Sparkles, TrendingUp, Zap, 
  Edit2, Trash2, Plus, Save, X, Compass, Award, Calendar, ChevronRight
} from 'lucide-react';
import { askGemini } from '../gemini';
import { saveGoal, deleteGoal, saveUserPreferences } from '../dbService';
import { auth } from '../firebase';

interface GoalsViewProps {
  userContext: UserContext;
  goals: Goal[];
  habits: Habit[];
  onUpdateGoals: (goals: Goal[]) => void;
  onUpdateHabits: (habits: Habit[]) => void;
  onUpdateUserContext?: (ctx: UserContext) => void;
}

export default function GoalsView({
  userContext,
  goals,
  habits,
  onUpdateGoals,
  onUpdateHabits,
  onUpdateUserContext
}: GoalsViewProps) {
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewText, setReviewText] = useState<string>('');

  // Generate dynamic, eye-safe starting coach advice using user context
  useEffect(() => {
    const currentGoalText = userContext.currentGoal 
      ? `"${userContext.currentGoal}"` 
      : 'your active milestones';
    
    setReviewText(
      `Success isn't about doing everything at once; it's about focused execution on our top targets. Right now, your main focus is on ${currentGoalText}. Let's ensure your daily activities and strategic goals are in perfect alignment. Log your completions below, and click 'Sunday review' to receive a customized strategic audit from me.`
    );
  }, [userContext.currentGoal]);

  const handleFetchReview = async () => {
    setLoadingReview(true);
    try {
      const prompt = `Review these user goals and habits progress for this week:
Goals: ${JSON.stringify(goals)}
Habits: ${JSON.stringify(habits)}
User Context: ${JSON.stringify(userContext)}

Generate Donna's direct, Harvey Specter-style strategic review. Be opinionated, direct, professional, warm, but fully realistic about where they are lacking and how they should adjust their focus. Do not include quotes—just write the review directly as a paragraph of advice.`;

      const review = await askGemini(prompt);
      setReviewText(review);
    } catch (e) {
      console.error(e);
      const currentGoalText = userContext.currentGoal 
        ? `"${userContext.currentGoal}"` 
        : 'your active milestones';
      setReviewText(
        `Review could not be loaded at this time. Donna stands ready to audit your progress once the parameters stabilize. Keep focusing on ${currentGoalText} and log your completions below.`
      );
    } finally {
      setLoadingReview(false);
    }
  };

  const handleIncrementGoal = async (id: string) => {
    const updated = goals.map(g => {
      if (g.id === id) {
        const nextCount = Math.min(g.targetNum, g.weeklyCompletion + 1);
        const streakAdd = nextCount === g.targetNum ? 1 : 0;
        return {
          ...g,
          weeklyCompletion: nextCount,
          currentStreak: g.currentStreak + streakAdd
        };
      }
      return g;
    });
    onUpdateGoals(updated);

    const changed = updated.find(g => g.id === id);
    if (changed) {
      const uid = auth.currentUser?.uid || localStorage.getItem('donna_user_uid');
      if (uid && localStorage.getItem('donna_demo_mode') !== 'true') {
        await saveGoal(uid, changed);
      }
    }
  };

  const handleResetGoal = async (id: string) => {
    const updated = goals.map(g => {
      if (g.id === id) {
        return { ...g, weeklyCompletion: 0 };
      }
      return g;
    });
    onUpdateGoals(updated);

    const changed = updated.find(g => g.id === id);
    if (changed) {
      const uid = auth.currentUser?.uid || localStorage.getItem('donna_user_uid');
      if (uid && localStorage.getItem('donna_demo_mode') !== 'true') {
        await saveGoal(uid, changed);
      }
    }
  };

  // Habit completion for today YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const handleToggleHabitToday = (id: string) => {
    const updated = habits.map(hab => {
      if (hab.id === id) {
        const hCopy = { ...hab.history };
        hCopy[todayStr] = !hCopy[todayStr];
        return {
          ...hab,
          history: hCopy
        };
      }
      return hab;
    });
    onUpdateHabits(updated);
  };

  // --- Dynamic North Star Goal State (from onboarding Qs) ---
  const [isEditingNorthStar, setIsEditingNorthStar] = useState(false);
  const [northStarInput, setNorthStarInput] = useState(userContext.currentGoal || '');

  useEffect(() => {
    setNorthStarInput(userContext.currentGoal || '');
  }, [userContext.currentGoal]);

  const handleSaveNorthStar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!northStarInput.trim()) return;

    const updatedContext = {
      ...userContext,
      currentGoal: northStarInput.trim()
    };
    if (onUpdateUserContext) {
      onUpdateUserContext(updatedContext);
    }
    
    // Save to Firestore if authenticated
    const uid = auth.currentUser?.uid || localStorage.getItem('donna_user_uid');
    if (uid && localStorage.getItem('donna_demo_mode') !== 'true') {
      await saveUserPreferences(uid, { currentGoal: northStarInput.trim() });
    }
    setIsEditingNorthStar(false);
  };

  // --- Add Strategic Goal State ---
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState<GoalCategory>('Work');
  const [newGoalTargetNum, setNewGoalTargetNum] = useState(3);
  const [newGoalWeeklyTarget, setNewGoalWeeklyTarget] = useState('3x per week');

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    const newGoal: Goal = {
      id: `g-${Date.now()}`,
      title: newGoalTitle.trim(),
      category: newGoalCategory,
      weeklyTarget: newGoalWeeklyTarget,
      currentStreak: 0,
      weeklyCompletion: 0,
      targetNum: Number(newGoalTargetNum)
    };

    const updatedGoals = [...goals, newGoal];
    onUpdateGoals(updatedGoals);

    // Sync to Firestore
    const uid = auth.currentUser?.uid || localStorage.getItem('donna_user_uid');
    if (uid && localStorage.getItem('donna_demo_mode') !== 'true') {
      await saveGoal(uid, newGoal);
    }

    // Reset form
    setNewGoalTitle('');
    setNewGoalCategory('Work');
    setNewGoalTargetNum(3);
    setNewGoalWeeklyTarget('3x per week');
    setIsAddingGoal(false);
  };

  // --- Edit/Replace Goal State ---
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalTitle, setEditGoalTitle] = useState('');
  const [editGoalCategory, setEditGoalCategory] = useState<GoalCategory>('Work');
  const [editGoalTargetNum, setEditGoalTargetNum] = useState(3);
  const [editGoalWeeklyTarget, setEditGoalWeeklyTarget] = useState('3x per week');

  const startEditingGoal = (g: Goal) => {
    setEditingGoalId(g.id);
    setEditGoalTitle(g.title);
    setEditGoalCategory(g.category);
    setEditGoalTargetNum(g.targetNum);
    setEditGoalWeeklyTarget(g.weeklyTarget);
  };

  const handleSaveEditedGoal = async (id: string) => {
    if (!editGoalTitle.trim()) return;

    const updatedGoals = goals.map(g => {
      if (g.id === id) {
        return {
          ...g,
          title: editGoalTitle.trim(),
          category: editGoalCategory,
          targetNum: Number(editGoalTargetNum),
          weeklyTarget: editGoalWeeklyTarget
        };
      }
      return g;
    });
    onUpdateGoals(updatedGoals);

    const modifiedGoal = updatedGoals.find(g => g.id === id);
    if (modifiedGoal) {
      const uid = auth.currentUser?.uid || localStorage.getItem('donna_user_uid');
      if (uid && localStorage.getItem('donna_demo_mode') !== 'true') {
        await saveGoal(uid, modifiedGoal);
      }
    }
    setEditingGoalId(null);
  };

  const handleDeleteGoal = async (id: string) => {
    const updatedGoals = goals.filter(g => g.id !== id);
    onUpdateGoals(updatedGoals);

    const uid = auth.currentUser?.uid || localStorage.getItem('donna_user_uid');
    if (uid && localStorage.getItem('donna_demo_mode') !== 'true') {
      await deleteGoal(uid, id);
    }
  };

  const getCategoryColor = (cat: GoalCategory) => {
    switch(cat) {
      case 'Work': return 'text-[#c9a84c] bg-[#c9a84c]/10 border-[#c9a84c]/20';
      case 'Health': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'Learning': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
      case 'Personal': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
    }
  };

  return (
    <div id="goals-habits-panel" className="space-y-6 animate-fade-in pr-1 font-sans">
      
      <div className="flex justify-between items-end border-b border-white/[0.06] pb-4 select-none">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-[#f0ebe0] font-normal">
            Executive growth ledger
          </h2>
          <p className="text-[11px] font-sans font-light text-[#8a8070] mt-1">
            Streak progress audits & coaching guidelines
          </p>
        </div>

        <button
          onClick={handleFetchReview}
          disabled={loadingReview}
          className="h-9 px-5 bg-white/[0.02] hover:bg-[#c9a84c] text-[#c9a84c] hover:text-[#0c0c0c] border border-[#c9a84c]/30 rounded-full text-xs font-sans font-medium transition-all duration-200 active:scale-[0.97] flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          {loadingReview ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 stroke-[1.5]" />
          )}
          <span>{loadingReview ? "Recalculating..." : "Sunday review"}</span>
        </button>
      </div>

      {/* DONNA'S HARVEY SPECTER STYLE COACHING CARD */}
      <div id="donna-coaching-block" className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-[#c9a84c]/20 rounded-2xl p-6 relative group transition-all duration-200 ease-in-out">
        <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-[#c9a84c]/15 text-[#c9a84c] text-[9px] font-sans font-light tracking-wider select-none rounded-bl uppercase">
          Donna executive debrief
        </div>
        <div className="flex items-start space-x-4">
          <div className="p-2.5 rounded-full bg-[#c9a84c]/10 text-[#c9a84c] mt-0.5 select-none shrink-0">
            <TrendingUp className="w-4 h-4 stroke-[1.5]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-sans font-medium text-[#c8a94e] uppercase tracking-wider select-none">
              Coaching report — Executive Debrief
            </div>
            <p className="text-[13px] text-[#f0ebe0] leading-[1.6] font-light italic mt-1.5 font-sans whitespace-pre-wrap pr-4">
              "{reviewText}"
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* GOALS TRACKER MODULE (8 COLS) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* NORTH STAR GOAL SECTION */}
          <div className="bg-gradient-to-r from-[rgba(201,168,76,0.06)] to-transparent border border-[#c9a84c]/25 rounded-2xl p-6 relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#c9a84c]/10 text-[#c9a84c] text-[10px] font-mono tracking-wider select-none rounded-bl uppercase border-l border-b border-[#c9a84c]/20">
              NORTH STAR OBJECTIVE
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-[#c9a84c]/10 border border-[#c9a84c]/20 text-[#c9a84c] rounded-xl shrink-0">
                <Compass className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-mono text-[#8a8070] uppercase tracking-widest">
                  Active focus from onboarding
                </h4>
                
                {isEditingNorthStar ? (
                  <form onSubmit={handleSaveNorthStar} className="mt-2.5 flex items-center gap-2">
                    <input 
                      type="text"
                      className="flex-1 bg-black/40 border border-[#c9a84c]/30 focus:border-[#c9a84c] rounded-xl px-3 py-2 text-[13px] text-[#f0ebe0] font-sans focus:outline-none"
                      value={northStarInput}
                      onChange={(e) => setNorthStarInput(e.target.value)}
                      placeholder="What are we working towards?"
                      autoFocus
                    />
                    <button 
                      type="submit" 
                      className="p-2 bg-[#c9a84c] text-black hover:bg-[#ebd083] rounded-xl transition duration-200 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setNorthStarInput(userContext.currentGoal || '');
                        setIsEditingNorthStar(false);
                      }} 
                      className="p-2 bg-white/[0.04] text-[#8a8070] hover:text-[#f0ebe0] rounded-xl transition duration-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="mt-1.5 flex justify-between items-start gap-4">
                    <p className="text-[15px] text-[#f0ebe0] font-serif font-normal italic leading-relaxed">
                      "{userContext.currentGoal || "No main goal set yet. Click edit to set what we are working towards."}"
                    </p>
                    <button
                      onClick={() => setIsEditingNorthStar(true)}
                      className="p-1.5 text-[#8a8070] hover:text-[#c9a84c] rounded-lg transition-colors hover:bg-[#c9a84c]/5 cursor-pointer shrink-0"
                      title="Replace Focus Goal"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center border-b border-white/[0.04] pb-3 select-none">
            <h3 className="font-serif text-[15px] font-normal text-[#f0ebe0]">
              Strategic goals
            </h3>
            <button
              onClick={() => setIsAddingGoal(!isAddingGoal)}
              className="px-3 py-1 bg-white/[0.02] hover:bg-[#c9a84c]/10 border border-[#c9a84c]/20 hover:border-[#c9a84c] text-[#c9a84c] hover:text-[#f0ebe0] rounded-full text-[11px] font-sans font-light tracking-wide flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
            >
              {isAddingGoal ? (
                <>
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" />
                  <span>Add Strategic Milestone</span>
                </>
              )}
            </button>
          </div>

          {/* ADD GOAL FORM */}
          {isAddingGoal && (
            <form onSubmit={handleAddGoal} className="bg-[rgba(22,22,22,0.9)] border border-[#c9a84c]/30 rounded-2xl p-5 space-y-4 animate-slide-down">
              <div className="text-xs font-mono text-[#c9a84c] uppercase tracking-wider">
                Create strategic milestone
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] text-[#8a8070] mb-1 font-sans">Goal Title</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-2.5 text-[13px] text-[#f0ebe0] font-sans focus:outline-none"
                    placeholder="e.g. Draft Q3 roadmap specification"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8a8070] mb-1 font-sans">Category</label>
                  <select 
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-2.5 text-[13px] text-[#f0ebe0] font-sans focus:outline-none"
                    value={newGoalCategory}
                    onChange={(e) => setNewGoalCategory(e.target.value as GoalCategory)}
                  >
                    <option value="Work">Work</option>
                    <option value="Health">Health</option>
                    <option value="Learning">Learning</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#8a8070] mb-1 font-sans">Target Frequency Label</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-2.5 text-[13px] text-[#f0ebe0] font-sans focus:outline-none"
                    placeholder="e.g. 3x per week"
                    value={newGoalWeeklyTarget}
                    onChange={(e) => setNewGoalWeeklyTarget(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8a8070] mb-1 font-sans">Target Count Num</label>
                  <input 
                    type="number"
                    min="1"
                    max="100"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-2.5 text-[13px] text-[#f0ebe0] font-sans focus:outline-none"
                    value={newGoalTargetNum}
                    onChange={(e) => setNewGoalTargetNum(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 select-none pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGoal(false)}
                  className="px-4 py-2 bg-transparent text-[#8a8070] hover:text-[#f0ebe0] text-xs font-sans transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] font-sans font-medium text-xs rounded-full transition-all duration-200 cursor-pointer"
                >
                  Save Milestone
                </button>
              </div>
            </form>
          )}

          {/* GOALS GRID */}
          <div className="space-y-4">
            {goals && goals.map(g => {
              const progressPct = Math.round((g.weeklyCompletion / g.targetNum) * 100);
              const isDone = g.weeklyCompletion === g.targetNum;
              const isEditingThisGoal = editingGoalId === g.id;

              if (isEditingThisGoal) {
                return (
                  <div key={g.id} className="bg-[rgba(22,22,22,0.95)] border border-[#c9a84c] rounded-2xl p-5 space-y-4 animate-fade-in">
                    <div className="text-xs font-mono text-[#c9a84c] uppercase tracking-wider flex justify-between">
                      <span>Modify milestone</span>
                      <button onClick={() => handleDeleteGoal(g.id)} className="text-red-400 hover:text-red-500 flex items-center gap-1 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Goal</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-[#8a8070] mb-1 font-sans">Goal Title</label>
                        <input 
                          type="text"
                          required
                          className="w-full bg-black/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-2.5 text-[13px] text-[#f0ebe0] font-sans focus:outline-none"
                          value={editGoalTitle}
                          onChange={(e) => setEditGoalTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#8a8070] mb-1 font-sans">Category</label>
                        <select 
                          className="w-full bg-black/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-2.5 text-[13px] text-[#f0ebe0] font-sans focus:outline-none"
                          value={editGoalCategory}
                          onChange={(e) => setEditGoalCategory(e.target.value as GoalCategory)}
                        >
                          <option value="Work">Work</option>
                          <option value="Health">Health</option>
                          <option value="Learning">Learning</option>
                          <option value="Personal">Personal</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#8a8070] mb-1 font-sans">Target Frequency Label</label>
                        <input 
                          type="text"
                          required
                          className="w-full bg-black/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-2.5 text-[13px] text-[#f0ebe0] font-sans focus:outline-none"
                          value={editGoalWeeklyTarget}
                          onChange={(e) => setEditGoalWeeklyTarget(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#8a8070] mb-1 font-sans">Target Count Num</label>
                        <input 
                          type="number"
                          min="1"
                          max="100"
                          required
                          className="w-full bg-black/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-2.5 text-[13px] text-[#f0ebe0] font-sans focus:outline-none"
                          value={editGoalTargetNum}
                          onChange={(e) => setEditGoalTargetNum(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2.5 select-none pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingGoalId(null)}
                        className="px-4 py-2 bg-transparent text-[#8a8070] hover:text-[#f0ebe0] text-xs font-sans transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditedGoal(g.id)}
                        className="px-5 py-2 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] font-sans font-medium text-xs rounded-full transition-all duration-200 cursor-pointer"
                      >
                        Apply Changes
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={g.id}
                  className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-white/[0.04] rounded-2xl p-6 transition-all duration-200 space-y-4 hover:border-white/[0.08]"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 pr-6">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full border ${getCategoryColor(g.category)}`}>
                          {g.category}
                        </span>
                        <span className="text-[10px] font-mono text-[#4a4540]">
                          {g.weeklyTarget}
                        </span>
                      </div>
                      <h4 className={`text-[14px] font-medium text-[#f0ebe0] font-sans transition-colors mt-1.5 ${isDone ? 'text-[#c9a84c]' : ''}`}>
                        {g.title}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-3.5 text-xs font-sans font-light select-none shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-[#8a8070] block">Streak</span>
                        <span className="text-[#c9a84c] font-medium font-mono text-[13px]">{g.currentStreak} weeks</span>
                      </div>
                      <button
                        onClick={() => startEditingGoal(g)}
                        className="p-1.5 text-[#4a4540] hover:text-[#c9a84c] hover:bg-white/[0.02] rounded-lg transition-all cursor-pointer"
                        title="Modify / Replace Goal"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress slide indicator */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-sans font-light select-none">
                      <span className="text-[#8a8070]">Weekly progress: {g.weeklyCompletion} of {g.targetNum}</span>
                      <span className={`${isDone ? 'text-emerald-500 font-medium' : 'text-[#8a8070]'}`}>{progressPct}% finished</span>
                    </div>
                    {/* Bar details */}
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/[0.02]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isDone ? 'bg-gradient-to-r from-[#c9a84c] to-[#ebd083]' : 'bg-[#c9a84c]'}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-sans font-light pt-1 select-none border-t border-white/[0.02]">
                    <button
                      onClick={() => handleDeleteGoal(g.id)}
                      className="text-[#4a4540] hover:text-red-400 transition cursor-pointer flex items-center gap-1"
                      title="Delete Milestone"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                    
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleResetGoal(g.id)}
                        className="text-[#8a8070] hover:text-[#f0ebe0] transition cursor-pointer"
                      >
                        Reset progress
                      </button>
                      <span className="text-[#4a4540]">•</span>
                      <button
                        onClick={() => handleIncrementGoal(g.id)}
                        disabled={isDone}
                        className="text-[#c9a84c] hover:text-[#ebd083] disabled:text-[#4a4540] transition cursor-pointer font-medium"
                      >
                        Record 1 completed step
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!goals || goals.length === 0) && (
              <div className="text-center p-8 bg-[rgba(22,22,22,0.4)] border border-dashed border-white/[0.04] rounded-2xl">
                <p className="text-xs text-[#8a8070] italic">No secondary strategic goals created yet. Click "+ Add Strategic Milestone" above to record one.</p>
              </div>
            )}
          </div>
        </div>

        {/* HABITS TRACKER MODULE (4 COLS) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="flex justify-between items-end border-b border-white/[0.04] pb-3 select-none">
            <h3 className="font-serif text-[15px] font-normal text-[#f0ebe0]">
              Daily rituals
            </h3>
            <span className="text-[10px] font-sans font-light text-[#8a8070] uppercase">
              Rhythm tracker
            </span>
          </div>

          <div className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border-none rounded-2xl p-6 space-y-5">
            <div className="space-y-2.5">
              {habits && habits.map(hab => {
                const checked = !!hab.history[todayStr];
                
                return (
                  <div
                    key={hab.id}
                    onClick={() => handleToggleHabitToday(hab.id)}
                    className={`flex items-center justify-between p-3.5 border rounded-xl transition cursor-pointer select-none active:scale-[0.98] ${checked ? 'border-[#1a5c2e]/40 bg-[#1a5c2e]/8 text-white' : 'border-white/[0.04] bg-white/[0.02] hover:border-[#c9a84c]/20 text-[#8a8070]'}`}
                  >
                    <div className="flex items-center space-x-3 pragma-truncate">
                      {/* Circle checkbox */}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-[#1a5c2e] border-transparent text-white' : 'border-white/[0.12] bg-black/20'}`}>
                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className={`text-[13px] font-sans font-light transition-colors ${checked ? 'text-[#f0ebe0]' : 'text-neutral-400'}`}>{hab.title}</span>
                    </div>

                    <span className="text-[9px] font-sans font-light text-[#4a4540] uppercase tracking-wider shrink-0 pl-2">
                      {checked ? "Done today" : "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Simulated Habit Ring indicators */}
            <div className="pt-4 border-t border-white/[0.04] text-center select-none space-y-4">
              <div className="flex justify-around items-center h-20">
                <div className="relative flex flex-col items-center">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="transparent" stroke="rgba(255,255,255,0.02)" strokeWidth="3.5" />
                    <circle cx="24" cy="24" r="20" fill="transparent" stroke="#c9a84c" strokeWidth="3.5" strokeDasharray="125" strokeDashoffset="45" />
                  </svg>
                  <span className="absolute top-4 text-[9px] font-sans text-[#f0ebe0] font-normal font-mono">65%</span>
                  <span className="text-[10px] font-sans font-light text-[#8a8070] mt-1.5">Focus ring</span>
                </div>

                <div className="relative flex flex-col items-center">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="transparent" stroke="rgba(255,255,255,0.02)" strokeWidth="3.5" />
                    <circle cx="24" cy="24" r="20" fill="transparent" stroke="#c9a84c" strokeWidth="3.5" strokeDasharray="125" strokeDashoffset="80" />
                  </svg>
                  <span className="absolute top-4 text-[9px] font-sans text-[#f0ebe0] font-normal font-mono">35%</span>
                  <span className="text-[10px] font-sans font-light text-[#8a8070] mt-1.5">Cardio run</span>
                </div>
              </div>
              
              <p className="text-[11px] text-[#8a8070] font-light leading-relaxed px-2 italic">
                Donna automatically monitors when completions fall, presenting strategic nudges in your top War Room alerts.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
