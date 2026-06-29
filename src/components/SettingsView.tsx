import React, { useState, useEffect } from 'react';
import { UserContext, DonnaMemoryFact } from '../types';
import { Check, Clipboard, ShieldCheck, Trash2, UserPlus, Sliders, HardDrive, RefreshCw, AlertTriangle } from 'lucide-react';

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

  // Scope validation states
  const [scopeStatus, setScopeStatus] = useState<{
    loaded: boolean;
    hasCalendar: boolean;
    hasGmail: boolean;
    hasTasks: boolean;
    hasPeople: boolean;
    scopes: string[];
  }>({
    loaded: false,
    hasCalendar: false,
    hasGmail: false,
    hasTasks: false,
    hasPeople: false,
    scopes: []
  });

  useEffect(() => {
    const checkScopes = async () => {
      const token = localStorage.getItem('donna_access_token');
      if (!token) {
        setScopeStatus({
          loaded: true,
          hasCalendar: false,
          hasGmail: false,
          hasTasks: false,
          hasPeople: false,
          scopes: []
        });
        return;
      }
      try {
        const { verifyTokenScopes } = await import('../googleApi');
        const verification = await verifyTokenScopes(token);
        setScopeStatus({
          loaded: true,
          hasCalendar: verification.hasCalendar,
          hasGmail: verification.hasGmail,
          hasTasks: verification.hasTasks,
          hasPeople: verification.hasGmail,
          scopes: verification.scopes
        });
      } catch (err) {
        console.warn("Scope verification failed:", err);
        setScopeStatus(prev => ({ ...prev, loaded: true }));
      }
    };
    checkScopes();
  }, []);

  const handleReconnectGoogle = async () => {
    setIsLinkingGoogle(true);
    setErrorMsg(null);
    try {
      const { signOut, signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const { getGoogleProvider, auth } = await import('../firebase');
      
      const provider = getGoogleProvider();
      
      // Clear current Auth session
      await signOut(auth);
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      
      if (accessToken) {
        localStorage.setItem('donna_demo_mode', 'false');
        localStorage.setItem('donna_access_token', accessToken);
        localStorage.setItem('donna_user_name', result.user.displayName || 'Partner');
        localStorage.setItem('donna_user_email', result.user.email || '');
        localStorage.setItem('donna_user_photo', result.user.photoURL || '');
        localStorage.setItem('donna_user_uid', result.user.uid);
        
        // Update scopes state
        const { verifyTokenScopes } = await import('../googleApi');
        const verification = await verifyTokenScopes(accessToken);
        setScopeStatus({
          loaded: true,
          hasCalendar: verification.hasCalendar,
          hasGmail: verification.hasGmail,
          hasTasks: verification.hasTasks,
          hasPeople: verification.hasGmail,
          scopes: verification.scopes
        });
        
        // Automatically enable all connected services
        onUpdateUserContext({
          ...userContext,
          name: result.user.displayName || userContext.name || 'Partner',
          connectedServices: {
            gmail: true,
            calendar: true,
            tasks: true,
            people: true
          }
        });
        
        setErrorMsg(null);
        window.location.reload(); // Reload to refresh all data feeds instantly!
      } else {
        throw new Error("No access token was returned. Make sure to allow all Google permissions on the prompt.");
      }
    } catch (err: any) {
      console.error("Reconnect failed:", err);
      setErrorMsg(`Reconnection failed: ${err.message || err}`);
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  // Connected services states
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggleService = async (serviceKey: 'gmail' | 'calendar' | 'tasks' | 'people', currentConnected: boolean) => {
    const hasAccessToken = !!localStorage.getItem('donna_access_token');
    setErrorMsg(null);
    
    if (currentConnected) {
      // Disconnect service
      const defaultConnected = !!localStorage.getItem('donna_access_token');
      const currentServices = userContext.connectedServices || {
        gmail: defaultConnected,
        calendar: defaultConnected,
        tasks: defaultConnected,
        people: defaultConnected
      };
      const updatedServices = {
        ...currentServices,
        [serviceKey]: false
      };
      
      // If all are disconnected, we can remove the access token to be clean
      const anyStillConnected = Object.values(updatedServices).some(v => v);
      if (!anyStillConnected) {
        localStorage.removeItem('donna_access_token');
      }

      onUpdateUserContext({
        ...userContext,
        connectedServices: updatedServices
      });
    } else {
      // Connect service
      if (!hasAccessToken) {
        setIsLinkingGoogle(true);
        try {
          const { linkWithPopup, GoogleAuthProvider } = await import('firebase/auth');
          const { getGoogleProvider, auth } = await import('../firebase');
          const provider = getGoogleProvider();
          
          if (!auth.currentUser) {
            throw new Error("No authenticated user session found to connect Google.");
          }
          const result = await linkWithPopup(auth.currentUser, provider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const accessToken = credential?.accessToken;
          if (accessToken) {
            localStorage.setItem('donna_demo_mode', 'false');
            localStorage.setItem('donna_access_token', accessToken);
            localStorage.setItem('donna_user_email', result.user.email || '');
          } else {
            throw new Error("No access token was returned by Google. Ensure permissions are allowed.");
          }
        } catch (err: any) {
          console.error("Connecting Google failed:", err);
          let msg = err.message || String(err);
          if (err.code === 'auth/credential-already-in-use') {
            msg = "This Google account is already linked to another secure ledger.";
          }
          setErrorMsg(msg);
          setIsLinkingGoogle(false);
          return;
        }
        setIsLinkingGoogle(false);
      }

      const defaultConnected = !!localStorage.getItem('donna_access_token');
      const currentServices = userContext.connectedServices || {
        gmail: defaultConnected,
        calendar: defaultConnected,
        tasks: defaultConnected,
        people: defaultConnected
      };
      const updatedServices = {
        ...currentServices,
        [serviceKey]: true
      };
      onUpdateUserContext({
        ...userContext,
        connectedServices: updatedServices
      });
    }
  };

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
          <div className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-white/[0.04] rounded-2xl p-6 space-y-4 font-sans text-left">
            <div className="text-[11px] font-sans font-medium tracking-wider text-[#c9a84c] uppercase border-b border-white/[0.04] pb-2 flex justify-between items-center select-none">
              <span>Connected Services</span>
              {isLinkingGoogle && <span className="text-[10px] text-neutral-500 animate-pulse">AUTHORIZING WORKSPACE...</span>}
            </div>

            {errorMsg && (
              <div className="text-[11px] text-red-400 font-sans p-2.5 bg-red-950/20 border border-red-500/10 rounded-xl select-none">
                {errorMsg}
              </div>
            )}

            {/* If there's an active token, check if any scopes are missing. If so, display a warning banner with a Reconnect button! */}
            {localStorage.getItem('donna_access_token') && scopeStatus.loaded && (!scopeStatus.hasGmail || !scopeStatus.hasCalendar || !scopeStatus.hasTasks) && (
              <div className="bg-amber-950/20 border border-amber-500/10 p-4 rounded-xl space-y-3">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="h-4 w-4 text-[#c9a84c] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-[#f0ebe0] text-[12px] font-medium leading-tight">Incomplete Google Permissions</h5>
                    <p className="text-[11px] text-neutral-400 font-light leading-relaxed">
                      Google OAuth token is missing some required workspace scopes. To allow Donna to function at full capabilities, authorize all requested permissions.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleReconnectGoogle}
                    disabled={isLinkingGoogle}
                    className="h-7 px-3.5 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] text-[11px] font-sans font-medium rounded-full transition-all duration-150 flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLinkingGoogle ? 'animate-spin' : ''}`} />
                    <span>Reconnect Google Workspace</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {[
                { key: 'gmail', name: 'Google Gmail Sync', desc: 'Allows Donna to read and draft emails.' },
                { key: 'calendar', name: 'Google Calendar Sync', desc: 'Allows Donna to list and manage meetings.' },
                { key: 'tasks', name: 'Google Tasks Sync', desc: 'Allows Donna to sync your operational ledger.' },
                { key: 'people', name: 'People Intelligence Sync', desc: 'Allows Donna to analyze email stakeholder dynamics.' }
              ].map(service => {
                const isServiceConnected = userContext.connectedServices 
                  ? !!userContext.connectedServices[service.key as 'gmail' | 'calendar' | 'tasks' | 'people']
                  : !!localStorage.getItem('donna_access_token');

                let verifiedScope = false;
                if (service.key === 'gmail') verifiedScope = scopeStatus.hasGmail;
                else if (service.key === 'calendar') verifiedScope = scopeStatus.hasCalendar;
                else if (service.key === 'tasks') verifiedScope = scopeStatus.hasTasks;
                else if (service.key === 'people') verifiedScope = scopeStatus.hasPeople;

                return (
                  <div key={service.key} className="flex flex-col sm:flex-row justify-between sm:items-center bg-black/20 border border-white/[0.04] p-4 rounded-xl gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[#f0ebe0] text-[13px] font-medium">{service.name}</span>
                        {isServiceConnected ? (
                          <div className="flex items-center space-x-1.5 text-[10px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#43a047] shadow-[0_0_4px_#43a047]" />
                            <span className={verifiedScope ? "text-[#43a047] font-light" : "text-amber-500 font-light animate-pulse"}>
                              {verifiedScope ? 'Authorized & Verified' : 'Missing Permissions'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-600 font-light">Inactive</span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 font-light leading-relaxed">{service.desc}</p>
                    </div>

                    <button
                      onClick={() => handleToggleService(service.key as any, isServiceConnected)}
                      disabled={isLinkingGoogle}
                      className={`h-8 px-4 rounded-full text-xs font-sans font-medium transition-all duration-200 active:scale-[0.97] cursor-pointer self-start sm:self-center shrink-0 ${
                        isServiceConnected 
                          ? 'border border-red-900/40 hover:bg-red-950/20 text-red-400' 
                          : 'bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c]'
                      }`}
                    >
                      {isServiceConnected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
