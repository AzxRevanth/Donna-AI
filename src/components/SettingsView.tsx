import React, { useState } from 'react';
import { UserContext, DonnaMemoryFact } from '../types';
import { Check, Clipboard, ShieldCheck, Trash2, UserPlus, Sliders, HardDrive, RefreshCw } from 'lucide-react';

interface SettingsViewProps {
  userContext: UserContext;
  donnaMemory: DonnaMemoryFact[];
  onUpdateUserContext: (ctx: UserContext) => void;
  onUpdateDonnaMemory: (memory: DonnaMemoryFact[]) => void;
}

export default function SettingsView({
  userContext,
  donnaMemory,
  onUpdateUserContext,
  onUpdateDonnaMemory
}: SettingsViewProps) {
  // Local form context mapped from userContext (with defaults)
  const [preferredName, setPreferredName] = useState(userContext.preferredName || userContext.name || '');
  const [roleType, setRoleType] = useState(userContext.roleType || 'Professional');
  const [roleDescription, setRoleDescription] = useState(userContext.roleDescription || userContext.role || '');
  const [timezone, setTimezone] = useState(userContext.timezone || 'US/Pacific');
  const [morningBriefTime, setMorningBriefTime] = useState(userContext.morningBriefTime || '07:30');
  
  const [workHoursStart, setWorkHoursStart] = useState(userContext.workHoursStart || userContext.workStartTime || '09:00');
  const [workHoursEnd, setWorkHoursEnd] = useState(userContext.workHoursEnd || userContext.workEndTime || '19:00');
  
  const [focusHoursStart, setFocusHoursStart] = useState(userContext.focusHoursStart || userContext.focusStartTime || '10:00');
  const [focusHoursEnd, setFocusHoursEnd] = useState(userContext.focusHoursEnd || userContext.focusEndTime || '12:00');
  
  const [currentGoal, setCurrentGoal] = useState(userContext.currentGoal || '');
  const [keyPeople, setKeyPeople] = useState(userContext.keyPeople || '');
  const [doNotDisturb, setDoNotDisturb] = useState(userContext.doNotDisturb || '');
  const [additionalContext, setAdditionalContext] = useState(userContext.additionalContext || '');
  
  const [assertiveness, setAssertiveness] = useState(userContext.assertivenessLevel ?? userContext.assertiveness ?? 75);

  // Memo fact adding
  const [newMemoryText, setNewMemoryText] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserContext = {
      ...userContext,
      name: preferredName,
      preferredName,
      role: roleDescription,
      roleDescription,
      roleType,
      timezone,
      workHoursStart,
      workStartTime: workHoursStart,
      workHoursEnd,
      workEndTime: workHoursEnd,
      focusHoursStart,
      focusStartTime: focusHoursStart,
      focusHoursEnd,
      focusEndTime: focusHoursEnd,
      assertiveness,
      assertivenessLevel: assertiveness,
      morningBriefTime,
      currentGoal,
      keyPeople,
      doNotDisturb,
      additionalContext
    };
    onUpdateUserContext(updated);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3500);
  };

  const handleDeleteMemory = (id: string) => {
    const updated = donnaMemory.filter(m => m.id !== id);
    onUpdateDonnaMemory(updated);
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;

    const newFact: DonnaMemoryFact = {
      id: `m-${Date.now()}`,
      fact: newMemoryText,
      timestamp: new Date().toISOString()
    };
    onUpdateDonnaMemory([...donnaMemory, newFact]);
    setNewMemoryText('');
  };

  const getAssertivenessLabel = (val: number) => {
    if (val < 30) return "Gentle nudges (Diplomatic)";
    if (val < 60) return "Firm secretary (Authoritative)";
    if (val < 85) return "Donna style (Direct, brutally honest)";
    return "Partner-deserving pushbacks (Relentless)";
  };

  const roleOptions = ['Student', 'Professional', 'Founder/Entrepreneur', 'Freelancer', 'Executive', 'Creator', 'Other'];

  return (
    <div id="settings-configuration-view" className="space-y-6 animate-fade-in pr-1 font-sans">
      
      <div className="border-b border-white/[0.06] pb-4 select-none">
        <h2 className="font-serif text-2xl md:text-3xl text-[#f0ebe0] font-normal">
          Settings
        </h2>
        <p className="text-[11px] font-sans font-light text-[#8a8070] mt-1">
          Calibrate Donna's tone, focus windows, and executive memory profiles
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* PROFILE SETTINGS FORM (7 COLS) */}
        <form onSubmit={handleSaveProfile} className="lg:col-span-7 bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-white/[0.04] rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center space-x-2.5 border-b border-white/[0.04] pb-3 select-none">
            <Sliders className="w-4 h-4 text-[#c9a84c] stroke-[1.5]" />
            <h3 className="font-serif text-[15px] font-normal text-[#f0ebe0]">
              Profile calibration parameters
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                Preferred Name <span className="text-[#c9a84c]">*</span>
              </label>
              <input 
                type="text"
                required
                className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="What should Donna call you?"
              />
            </div>

            <div>
              <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                Local Timezone <span className="text-[#c9a84c]">*</span>
              </label>
              <input 
                type="text"
                required
                className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
          </div>

          {/* Role Type Pills */}
          <div className="space-y-2">
            <label className="block text-[11px] font-sans font-light text-[#8a8070]">
              Role Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {roleOptions.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRoleType(option)}
                  className={`px-3 py-1.5 rounded-full border text-[11px] font-sans font-light transition-all duration-200 cursor-pointer ${roleType === option ? 'bg-[#c9a84c]/10 border-[#c9a84c] text-[#c9a84c]' : 'bg-[#050505]/20 border-white/[0.08] text-[#8a8070] hover:border-white/[0.15]'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
              Role / Field Description <span className="text-[#c9a84c]">*</span>
            </label>
            <input 
              type="text"
              required
              className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="e.g. Product Manager at a startup, Freelance designer"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                Work hours (Start) <span className="text-[#c9a84c]">*</span>
              </label>
              <input 
                type="time"
                required
                className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                value={workHoursStart}
                onChange={(e) => setWorkHoursStart(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                Work hours (End) <span className="text-[#c9a84c]">*</span>
              </label>
              <input 
                type="time"
                required
                className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                value={workHoursEnd}
                onChange={(e) => setWorkHoursEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                Focus window (Start) <span className="text-[#c9a84c]">*</span>
              </label>
              <input 
                type="time"
                required
                className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                value={focusHoursStart}
                onChange={(e) => setFocusHoursStart(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                Focus window (End) <span className="text-[#c9a84c]">*</span>
              </label>
              <input 
                type="time"
                required
                className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                value={focusHoursEnd}
                onChange={(e) => setFocusHoursEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                Morning briefing trigger <span className="text-[#c9a84c]">*</span>
              </label>
              <input 
                type="time"
                required
                className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                value={morningBriefTime}
                onChange={(e) => setMorningBriefTime(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                Do Not Disturb For
              </label>
              <input 
                type="text"
                className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                value={doNotDisturb}
                onChange={(e) => setDoNotDisturb(e.target.value)}
                placeholder="e.g. Marketing emails, late night alerts"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
              Current Main Goal <span className="text-[#c9a84c]">*</span>
            </label>
            <textarea 
              rows={2}
              required
              className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
              value={currentGoal}
              onChange={(e) => setCurrentGoal(e.target.value)}
              placeholder="e.g. Launching a product in 3 months"
            />
          </div>

          <div>
            <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
              Key People / Stakeholders
            </label>
            <textarea 
              rows={2}
              className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
              value={keyPeople}
              onChange={(e) => setKeyPeople(e.target.value)}
              placeholder="e.g. Co-founders, Rohan (manager)"
            />
          </div>

          <div>
            <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
              Additional Context for Donna
            </label>
            <textarea 
              rows={3}
              className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Working style preferences, pet peeves, etc."
            />
          </div>

          {/* Slider Assertiveness Quotient */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs font-sans select-none">
              <span className="text-[#8a8070] font-light">Donna's assertiveness style</span>
              <span className="text-[#c9a84c] font-medium">{getAssertivenessLabel(assertiveness)} ({assertiveness}%)</span>
            </div>
            
            <input 
              type="range"
              min="0"
              max="100"
              className="w-full h-1 bg-[#111] accent-[#c9a84c] rounded-lg border-none cursor-pointer"
              value={assertiveness}
              onChange={(e) => setAssertiveness(Number(e.target.value))}
            />
            <p className="text-[11px] text-[#8a8070] font-light select-none leading-relaxed pl-1">
              Controls when and how firm Donna is in her feedback, alert lists and conversations (e.g. pushing back or act decisively on calendar conflicts).
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] select-none">
            <span className={`text-[11px] font-sans text-[#ebd083] transition-opacity duration-300 ${saveSuccess ? 'opacity-100' : 'opacity-0'}`}>
              Administrative profile calibrated successfully.
            </span>
            <button
              type="submit"
              className="h-10 px-6 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] font-sans font-medium text-xs rounded-full active:scale-[0.97] transition-all duration-200 cursor-pointer"
            >
              Calibrate parameters
            </button>
          </div>
        </form>

        {/* DONNA'S LEDGER MEMORY CARD (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-white/[0.04] rounded-2xl p-6 space-y-5">
            <div className="flex items-center space-x-2.5 border-b border-white/[0.04] pb-3 select-none">
              <HardDrive className="w-4 h-4 text-[#c9a84c] stroke-[1.5]" />
              <h3 className="font-serif text-[15px] font-normal text-[#f0ebe0]">
                Donna's active ledger memories
              </h3>
            </div>

            <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1 scrollbar-none">
              {donnaMemory && donnaMemory.map(mem => (
                <div 
                  key={mem.id}
                  className="p-3.5 bg-black/20 border border-white/[0.04] rounded-xl flex justify-between items-start gap-4 hover:border-[#c9a84c]/20 transition-all duration-200"
                >
                  <p className="text-[12px] text-[#8a8070] font-light leading-relaxed font-sans">
                    "{mem.fact}"
                  </p>
                  <button
                    onClick={() => handleDeleteMemory(mem.id)}
                    className="text-[#4a4540] hover:text-red-500 transition-colors duration-200 cursor-pointer select-none p-0.5 rounded-full hover:bg-white/[0.02]"
                    title="Purge memory"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                </div>
              ))}
              {donnaMemory.length === 0 && (
                <p className="text-xs text-center text-[#8a8580] italic py-8">No ledger memories logged yet.</p>
              )}
            </div>

            {/* Form to inject new memory */}
            <form onSubmit={handleAddMemory} className="pt-3 border-t border-white/[0.04] space-y-3">
              <div>
                <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5 select-none font-light">
                  Teach / inject memory fact
                </label>
                <input 
                  type="text"
                  required
                  className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                  placeholder="e.g. 'I do not take calls on Friday general briefings'"
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                />
              </div>
              <div className="flex justify-end select-none">
                <button
                  type="submit"
                  className="h-8 px-4 border border-[#c9a84c]/30 rounded-full text-[#c9a84c] hover:bg-[#c9a84c]/8 text-xs font-sans font-medium transition-all duration-200 active:scale-[0.97] cursor-pointer"
                >
                  Teach Donna fact
                </button>
              </div>
            </form>
          </div>

          {/* CONNECTED ACCOUNTS CARD WITH STATUS SPOT */}
          <div className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-white/[0.04] rounded-2xl p-5 space-y-3.5 select-none font-sans">
            <div className="text-[11px] font-sans font-light text-[#8a8070] border-b border-white/[0.04] pb-2">
              Connected Exchanges Integrator
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center bg-black/20 border border-white/[0.04] p-3 rounded-xl">
                <span className="text-[#f0ebe0] text-[13px] font-light">Google Calendar API Sync</span>
                <span className="text-[10px] font-sans font-light text-[#43a047] bg-[#43a047]/10 border border-[#43a047]/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#43a047] animate-pulse" />
                  <span>CONNECTED</span>
                </span>
              </div>

              <div className="flex justify-between items-center bg-black/20 border border-white/[0.04] p-3 rounded-xl">
                <span className="text-[#f0ebe0] text-[13px] font-light">Google Gmail API Sync</span>
                <span className="text-[10px] font-sans font-light text-[#43a047] bg-[#43a047]/10 border border-[#43a047]/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#43a047] animate-pulse" />
                  <span>CONNECTED</span>
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
