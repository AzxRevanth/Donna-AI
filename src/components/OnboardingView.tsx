import React, { useState, useEffect } from 'react';
import { Eye, Lock, Zap, Check, ArrowRight } from 'lucide-react';
import { auth, getGoogleProvider } from '../firebase';
import { linkWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { askGemini } from '../gemini';
import { saveUserPreferences } from '../dbService';
import DonnaBlob from './voice/DonnaBlob';

interface OnboardingViewProps {
  onComplete: (data: any) => void;
}

export default function OnboardingView({ onComplete }: OnboardingViewProps) {
  const [screen, setScreen] = useState<1 | 2 | 3>(1);

  // Screen 1: Disclaimer states
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isEmailUserWithoutGoogle, setIsEmailUserWithoutGoogle] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkingError, setLinkingError] = useState<string | null>(null);

  const handleConnectGoogle = async () => {
    setIsLinking(true);
    setLinkingError(null);
    try {
      const provider = getGoogleProvider();
      if (!auth.currentUser) {
        throw new Error("No active credentials found to connect Google. Please try logging in again.");
      }
      const result = await linkWithPopup(auth.currentUser, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      if (accessToken) {
        localStorage.setItem('donna_demo_mode', 'false');
        localStorage.setItem('donna_access_token', accessToken);
        localStorage.setItem('donna_user_email', result.user.email || '');
        if (result.user.displayName) {
          localStorage.setItem('donna_user_name', result.user.displayName);
          setPreferredName(result.user.displayName.split(' ')[0]);
        }
        setIsEmailUserWithoutGoogle(false); // Link successful! Upgrade to standard onboarding experience.
      } else {
        throw new Error("No Google access token was returned. Ensure permissions are allowed.");
      }
    } catch (err: any) {
      console.error("Failed to link Google account during onboarding:", err);
      let errMsg = err.message || String(err);
      if (err.code === 'auth/credential-already-in-use') {
        errMsg = "This Google account is already linked to another user's secure ledger. Please use a different Google account or log in with Google.";
      }
      setLinkingError(errMsg);
    } finally {
      setIsLinking(false);
    }
  };

  // Screen 2: Form fields
  const [preferredName, setPreferredName] = useState('');
  const [roleType, setRoleType] = useState('Professional');
  const [otherRoleType, setOtherRoleType] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [location, setLocation] = useState('');

  // Time fields (represented as 12-hour values for premium onboarding UI)
  const [startHour, setStartHour] = useState('9');
  const [startMin, setStartMin] = useState('00');
  const [startAmPm, setStartAmPm] = useState('AM');

  const [endHour, setEndHour] = useState('7');
  const [endMin, setEndMin] = useState('00');
  const [endAmPm, setStartEndAmPm] = useState('PM');

  const [focusStartHour, setFocusStartHour] = useState('10');
  const [focusStartMin, setFocusStartMin] = useState('00');
  const [focusStartAmPm, setFocusStartAmPm] = useState('AM');

  const [focusEndHour, setFocusEndHour] = useState('12');
  const [focusEndMin, setFocusEndMin] = useState('00');
  const [focusEndAmPm, setFocusEndAmPm] = useState('PM');

  const [workStyle, setWorkStyle] = useState<string[]>(['Deep focus blocks']);
  const [currentGoal, setCurrentGoal] = useState('');
  const [keyPeople, setKeyPeople] = useState('');
  const [doNotDisturb, setDoNotDisturb] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [assertivenessLevel, setAssertivenessLevel] = useState(75);

  // Screen 3 states
  const [personalizedLine, setPersonalizedLine] = useState('');
  const [loadingPersonalizedLine, setLoadingPersonalizedLine] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Set default preferred name from logged in Google user
  useEffect(() => {
    if (auth.currentUser?.displayName) {
      setPreferredName(auth.currentUser.displayName.split(' ')[0]);
    } else {
      const storedName = localStorage.getItem('donna_user_name');
      if (storedName) {
        setPreferredName(storedName.split(' ')[0]);
      }
    }

    // Detect if signed in using Email & Password (without connecting Google)
    const hasGoogleProvider = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');
    const hasAccessToken = !!localStorage.getItem('donna_access_token');
    const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
    if (auth.currentUser && !hasGoogleProvider && !hasAccessToken && !isDemo) {
      setIsEmailUserWithoutGoogle(true);
    }
  }, []);

  // Time Conversion Helpers
  const convertTo24h = (h: string, m: string, ampm: string): string => {
    let hr = parseInt(h, 10);
    if (ampm === 'PM' && hr < 12) hr += 12;
    if (ampm === 'AM' && hr === 12) hr = 0;
    return `${hr.toString().padStart(2, '0')}:${m.padStart(2, '0')}`;
  };

  const workStartTime = convertTo24h(startHour, startMin, startAmPm);
  const workEndTime = convertTo24h(endHour, endMin, endAmPm);
  const focusStartTime = convertTo24h(focusStartHour, focusStartMin, focusStartAmPm);
  const focusEndTime = convertTo24h(focusEndHour, focusEndMin, focusEndAmPm);

  // Validate required questions (Q1 to Q9)
  const isFormValid = () => {
    const finalRole = roleType === 'Other' ? otherRoleType : roleType;
    return (
      preferredName.trim() !== '' &&
      finalRole.trim() !== '' &&
      roleDescription.trim() !== '' &&
      location.trim() !== '' &&
      currentGoal.trim() !== ''
    );
  };

  // Skip / Continue state logic
  const handleSkip = () => {
    // Sets sensible defaults
    const defaults = {
      onboardingComplete: true,
      onboardingCompletedAt: new Date().toISOString(),
      preferredName: preferredName || auth.currentUser?.displayName?.split(' ')[0] || 'Partner',
      roleType: 'Professional',
      roleDescription: roleDescription || 'Executive Coordinator',
      location: location || 'US/Pacific',
      workStartTime: '09:00',
      workEndTime: '19:00',
      focusStartTime: '10:00',
      focusEndTime: '12:00',
      workStyle: ['Deep focus blocks'],
      currentGoal: currentGoal || 'Optimizing active productivity vectors',
      keyPeople: keyPeople || 'Internal stakeholders',
      doNotDisturb: doNotDisturb || 'Marketing notifications',
      additionalContext: additionalContext || 'Standard onboarding default context.',
      assertivenessLevel: 75,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'US/Pacific'
    };
    saveAndEnter(defaults);
  };

  const handleContinueToScreen3 = async () => {
    if (!isFormValid()) return;
    setScreen(3);
    setLoadingPersonalizedLine(true);

    const finalRole = roleType === 'Other' ? otherRoleType : roleType;
    const prompt = `The user just completed onboarding. Their name is ${preferredName}, they are a ${finalRole} working on ${currentGoal}. Generate one sentence in Donna's voice acknowledging who they are and what she's going to help them with. Warm, direct, confident. Not generic. Max 20 words.`;
    
    try {
      const response = await askGemini(prompt);
      const cleaned = response.replace(/^"|"$/g, '').trim();
      setPersonalizedLine(cleaned);

      // Speak line if speechSynthesis is available
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleaned);
        const voices = window.speechSynthesis.getVoices();
        // Prefer a natural English female voice if possible
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural'));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error("Gemini context personalization error:", err);
      setPersonalizedLine(`Welcome back, ${preferredName}. I have synchronized your coordinates and we are ready to move.`);
    } finally {
      setLoadingPersonalizedLine(false);
    }
  };

  const handleFinalSubmit = () => {
    const finalRole = roleType === 'Other' ? otherRoleType : roleType;
    const finalData = {
      onboardingComplete: true,
      onboardingCompletedAt: new Date().toISOString(),
      preferredName,
      roleType: finalRole,
      roleDescription,
      location,
      workStartTime,
      workEndTime,
      focusStartTime,
      focusEndTime,
      workStyle,
      currentGoal,
      keyPeople,
      doNotDisturb,
      additionalContext,
      assertivenessLevel,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'US/Pacific'
    };
    saveAndEnter(finalData);
  };

  const saveAndEnter = async (data: any) => {
    setIsSaving(true);
    const uid = auth.currentUser?.uid || localStorage.getItem('donna_user_uid') || 'demo-uid';
    try {
      await saveUserPreferences(uid, data);
      onComplete(data);
    } catch (err) {
      console.error("Onboarding saving error:", err);
      // Fallback
      onComplete(data);
    } finally {
      setIsSaving(false);
    }
  };

  const getAssertivenessDesc = (val: number) => {
    if (val <= 30) return "Donna will nudge softly and ask before acting";
    if (val <= 60) return "Donna will be direct but considerate";
    if (val <= 85) return "Donna will push back and act decisively";
    return "Donna will not sugarcoat anything";
  };

  const roleOptions = ['Student', 'Professional', 'Founder/Entrepreneur', 'Freelancer', 'Executive', 'Creator', 'Other'];
  const workStyleOptions = ['Deep focus blocks', 'Back-to-back meetings', 'Async communication', 'Quick daily standups', 'Flexible/varies'];

  const toggleWorkStyle = (style: string) => {
    if (workStyle.includes(style)) {
      setWorkStyle(workStyle.filter(item => item !== style));
    } else {
      setWorkStyle([...workStyle, style]);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0c0c0c] text-[#f0ebe0] font-sans flex flex-col justify-between items-center relative overflow-x-hidden">
      {/* Background Accent Gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#8a6f30]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[#c9a84c]/5 blur-[160px] pointer-events-none" />

      {/* TOP PROGRESS INDICATOR BAR */}
      <div className="w-full max-w-5xl px-6 pt-8 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded border border-[#c9a84c]/40 flex items-center justify-center bg-[#1a1810]">
            <span className="font-serif text-xs font-bold text-[#c9a84c] pl-0.5">D</span>
          </div>
          <span className="font-serif font-medium tracking-wide text-xs text-[#8a8070] uppercase">Donna Onboarding</span>
        </div>

        {/* Progress dots */}
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${screen === 1 ? 'bg-[#c9a84c] shadow-[0_0_8px_#c9a84c]' : 'border border-[#c9a84c]/50 bg-transparent'}`} />
          <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${screen === 2 ? 'bg-[#c9a84c] shadow-[0_0_8px_#c9a84c]' : 'border border-[#c9a84c]/50 bg-transparent'}`} />
          <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${screen === 3 ? 'bg-[#c9a84c] shadow-[0_0_8px_#c9a84c]' : 'border border-[#c9a84c]/50 bg-transparent'}`} />
        </div>
      </div>

      {/* MAIN SCREEN CANVAS */}
      <div className="w-full flex-grow flex items-center justify-center z-10 px-4 py-12 md:px-8 max-w-4xl">
        
        {/* SCREEN 1: DISCLAIMER */}
        {screen === 1 && isEmailUserWithoutGoogle ? (
          <div className="w-full space-y-8 max-w-2xl text-center animate-fade-in select-none">
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-full border border-[#c9a84c]/30 flex items-center justify-center mx-auto mb-6 bg-[#161616] shadow-2xl relative">
                <span className="font-serif text-3xl font-bold tracking-normal text-[#c9a84c] pl-0.5">D</span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl text-[#f0ebe0] font-normal tracking-tight">
                Limited Experience Without Google
              </h2>
              <p className="text-xs font-sans font-light text-[#8a8070] max-w-md mx-auto italic">
                Donna works without Google, but several intelligent features depend on Google integrations.
              </p>
            </div>

            <div className="p-6 md:p-8 rounded-2xl bg-[rgba(22,22,22,0.85)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-[#c9a84c]/10 text-left max-w-xl mx-auto space-y-4">
              <p className="text-xs text-[#8a8070] font-light leading-relaxed">
                Without connecting a Google account:
              </p>
              <ul className="space-y-2 text-xs font-sans font-light text-[#ebd083]/90 list-disc list-inside">
                <li>Donna cannot read or send Gmail.</li>
                <li>Donna cannot read or manage Google Calendar.</li>
                <li>Donna cannot sync Google Tasks.</li>
                <li>People Intelligence will be unavailable because Donna cannot analyze email history.</li>
                <li>Morning Briefs will only use locally available data.</li>
                <li>Automatic scheduling, email drafting, follow-up detection and proactive planning will be limited.</li>
              </ul>
            </div>

            {linkingError && (
              <div className="text-xs text-red-400/90 font-sans max-w-md mx-auto p-3 bg-red-950/25 border border-red-500/15 rounded-xl">
                {linkingError}
              </div>
            )}

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleConnectGoogle}
                disabled={isLinking}
                className="h-11 px-8 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] font-sans font-semibold text-xs rounded-full flex items-center justify-center space-x-2 transition-all duration-200 active:scale-[0.97] cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isLinking ? (
                  <span>Connecting to Google...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.865 0-7-3.135-7-7s3.135-7 7-7c1.84 0 3.515.715 4.775 1.885l2.45-2.45C17.155 1.485 14.86 1 12.24 1 6.725 1 2.24 5.485 2.24 11s4.485 10 10 10c5.755 0 9.76-4.045 9.76-9.925 0-.595-.065-1.185-.18-1.79H12.24z"/>
                    </svg>
                    <span>Connect Google Account</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setIsEmailUserWithoutGoogle(false); // Proceed to normal disclaimer
                }}
                className="h-11 px-8 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] text-[#8a8070] hover:text-[#f0ebe0] font-sans font-medium text-xs rounded-full flex items-center justify-center transition-all duration-200 active:scale-[0.97] cursor-pointer"
              >
                <span>Continue Without Google</span>
              </button>
            </div>
          </div>
        ) : screen === 1 && (
          <div className="w-full space-y-8 max-w-3xl text-center animate-fade-in select-none">
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-full border border-[#c9a84c]/30 flex items-center justify-center mx-auto mb-6 bg-[#161616] shadow-2xl relative">
                <span className="font-serif text-3xl font-bold tracking-normal text-[#c9a84c] pl-0.5">D</span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl text-[#f0ebe0] font-normal tracking-tight">
                Before we begin.
              </h2>
              <p className="text-sm font-sans font-light text-[#8a8070] max-w-md mx-auto">
                Donna is your AI personal secretary. Here's what that means.
              </p>
            </div>

            {/* Disclaimer Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="p-5 rounded-2xl bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-white/[0.04]">
                <div className="flex items-center space-x-2.5 text-[#c9a84c] mb-3">
                  <div className="p-1.5 rounded-lg bg-[#c9a84c]/5 border border-[#c9a84c]/20">
                    <Eye className="w-4 h-4 stroke-[1.5]" />
                  </div>
                  <h3 className="text-[13px] font-medium font-sans">What Donna reads</h3>
                </div>
                <p className="text-[12px] text-[#8a8070] font-light leading-relaxed">
                  Your Gmail, Google Calendar, and Google Tasks. She reads these to understand your schedule, priorities, and the people you work with.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-white/[0.04]">
                <div className="flex items-center space-x-2.5 text-[#c9a84c] mb-3">
                  <div className="p-1.5 rounded-lg bg-[#c9a84c]/5 border border-[#c9a84c]/20">
                    <Lock className="w-4 h-4 stroke-[1.5]" />
                  </div>
                  <h3 className="text-[13px] font-medium font-sans">How it's used</h3>
                </div>
                <p className="text-[12px] text-[#8a8070] font-light leading-relaxed">
                  Everything stays in your account. Donna uses your data to give you context-aware advice. Nothing is stored on external servers beyond your Firebase project.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-white/[0.04]">
                <div className="flex items-center space-x-2.5 text-[#c9a84c] mb-3">
                  <div className="p-1.5 rounded-lg bg-[#c9a84c]/5 border border-[#c9a84c]/20">
                    <Zap className="w-4 h-4 stroke-[1.5]" />
                  </div>
                  <h3 className="text-[13px] font-medium font-sans">What Donna can do</h3>
                </div>
                <p className="text-[12px] text-[#8a8070] font-light leading-relaxed">
                  With your permission, Donna can create calendar events, complete tasks, and draft or send emails on your behalf. She confirms before sending anything.
                </p>
              </div>
            </div>

            {/* Checkbox confirmation & Get started button */}
            <div className="pt-6 flex flex-col items-center space-y-6">
              <label className="flex items-start text-left max-w-lg cursor-pointer space-x-3 text-xs text-[#8a8070] font-light select-none">
                <input 
                  type="checkbox"
                  checked={disclaimerAccepted}
                  onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                  className="mt-0.5 accent-[#c9a84c] rounded border border-white/[0.08] focus:ring-0 focus:ring-offset-0 bg-[#0c0c0c] w-4 h-4"
                />
                <span>
                  I understand that Donna will access my Google Workspace data to function as my personal assistant.
                </span>
              </label>

              <button
                onClick={() => setScreen(2)}
                disabled={!disclaimerAccepted}
                className="h-11 px-8 bg-[#c9a84c] hover:bg-[#ebd083] disabled:bg-[#c9a84c]/20 text-[#0c0c0c] disabled:text-[#4a4540] font-sans font-medium text-xs rounded-full flex items-center space-x-2 transition-all duration-200 active:scale-[0.97] cursor-pointer shadow-lg select-none disabled:cursor-not-allowed"
              >
                <span>Get started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 2: FORM */}
        {screen === 2 && (
          <div className="w-full space-y-6 max-w-3xl animate-fade-in flex flex-col h-[75vh]">
            <div className="space-y-1 pb-4 select-none border-b border-white/[0.04]">
              <h2 className="font-serif text-2xl md:text-3xl text-[#f0ebe0] font-normal">
                Tell Donna about you.
              </h2>
              <p className="text-xs font-sans font-light text-[#8a8070]">
                The more she knows, the sharper she gets.
              </p>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-grow overflow-y-auto pr-2 space-y-8 scrollbar-thin">
              
              {/* SECTION: WHO YOU ARE */}
              <div className="space-y-4">
                <div className="text-[10px] font-mono tracking-wider uppercase text-[#c9a84c] select-none font-bold">
                  The basics
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                      Q1 — What do you go by? <span className="text-[#c9a84c]">*</span>
                    </label>
                    <input 
                      type="text"
                      required
                      value={preferredName}
                      onChange={(e) => setPreferredName(e.target.value)}
                      placeholder="What should Donna call you?"
                      className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                      Q4 — Where are you based? <span className="text-[#c9a84c]">*</span>
                    </label>
                    <input 
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City, Country"
                      className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[11px] font-sans font-light text-[#8a8070]">
                    Q2 — What best describes what you do? <span className="text-[#c9a84c]">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {roleOptions.map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setRoleType(option)}
                        className={`px-4 py-2 rounded-full border text-xs font-sans font-light transition-all duration-200 cursor-pointer ${roleType === option ? 'bg-[#c9a84c]/10 border-[#c9a84c] text-[#c9a84c]' : 'bg-[#050505]/20 border-white/[0.08] text-[#8a8070] hover:border-white/[0.15]'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  {roleType === 'Other' && (
                    <div className="animate-fade-in pt-1">
                      <input 
                        type="text"
                        required
                        value={otherRoleType}
                        onChange={(e) => setOtherRoleType(e.target.value)}
                        placeholder="Tell Donna"
                        className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Q3 — What's your specific role or field? <span className="text-[#c9a84c]">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    placeholder="e.g. Product Manager at a startup, CS student at BITS, Freelance designer"
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                  />
                </div>
              </div>

              {/* SECTION: HOW YOU WORK */}
              <div className="space-y-5">
                <div className="text-[10px] font-mono tracking-wider uppercase text-[#c9a84c] select-none font-bold">
                  Your work style
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Q5 */}
                  <div>
                    <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                      Q5 — When does your day usually start?
                    </label>
                    <div className="flex items-center space-x-2">
                      <select 
                        value={startHour} 
                        onChange={(e) => setStartHour(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c] flex-grow"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
                          <option key={h} value={h} className="bg-[#111]">{h}</option>
                        ))}
                      </select>
                      <select 
                        value={startMin} 
                        onChange={(e) => setStartMin(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c] flex-grow"
                      >
                        {['00', '15', '30', '45'].map(m => (
                          <option key={m} value={m} className="bg-[#111]">{`:${m}`}</option>
                        ))}
                      </select>
                      <select 
                        value={startAmPm} 
                        onChange={(e) => setStartAmPm(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c]"
                      >
                        <option value="AM" className="bg-[#111]">AM</option>
                        <option value="PM" className="bg-[#111]">PM</option>
                      </select>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Donna won't brief you before this</span>
                  </div>

                  {/* Q6 */}
                  <div>
                    <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                      Q6 — When do you usually wrap up?
                    </label>
                    <div className="flex items-center space-x-2">
                      <select 
                        value={endHour} 
                        onChange={(e) => setStartEndAmPm(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c] flex-grow"
                        style={{ display: 'none' }} // hidden container
                      />
                      <select 
                        value={endHour} 
                        onChange={(e) => setEndHour(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c] flex-grow"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
                          <option key={h} value={h} className="bg-[#111]">{h}</option>
                        ))}
                      </select>
                      <select 
                        value={endMin} 
                        onChange={(e) => setEndMin(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c] flex-grow"
                      >
                        {['00', '15', '30', '45'].map(m => (
                          <option key={m} value={m} className="bg-[#111]">{`:${m}`}</option>
                        ))}
                      </select>
                      <select 
                        value={endAmPm} 
                        onChange={(e) => setStartEndAmPm(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c]"
                      >
                        <option value="AM" className="bg-[#111]">AM</option>
                        <option value="PM" className="bg-[#111]">PM</option>
                      </select>
                    </div>
                  </div>

                </div>

                {/* Q7 */}
                <div className="p-4 rounded-xl bg-black/20 border border-white/[0.04]">
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-2">
                    Q7 — When are you at your sharpest? (Focus window)
                  </label>
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center space-x-2 flex-grow">
                      <span className="text-xs font-sans text-gray-500 w-10 shrink-0 select-none">Start:</span>
                      <select 
                        value={focusStartHour} 
                        onChange={(e) => setFocusStartHour(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c] flex-grow"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
                          <option key={h} value={h} className="bg-[#111]">{h}</option>
                        ))}
                      </select>
                      <select 
                        value={focusStartMin} 
                        onChange={(e) => setFocusStartMin(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c] flex-grow"
                      >
                        {['00', '15', '30', '45'].map(m => (
                          <option key={m} value={m} className="bg-[#111]">{`:${m}`}</option>
                        ))}
                      </select>
                      <select 
                        value={focusStartAmPm} 
                        onChange={(e) => setFocusStartAmPm(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c]"
                      >
                        <option value="AM" className="bg-[#111]">AM</option>
                        <option value="PM" className="bg-[#111]">PM</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2 flex-grow">
                      <span className="text-xs font-sans text-gray-500 w-10 shrink-0 select-none">End:</span>
                      <select 
                        value={focusEndHour} 
                        onChange={(e) => setFocusEndHour(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c] flex-grow"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
                          <option key={h} value={h} className="bg-[#111]">{h}</option>
                        ))}
                      </select>
                      <select 
                        value={focusEndMin} 
                        onChange={(e) => setFocusEndMin(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c] flex-grow"
                      >
                        {['00', '15', '30', '45'].map(m => (
                          <option key={m} value={m} className="bg-[#111]">{`:${m}`}</option>
                        ))}
                      </select>
                      <select 
                        value={focusEndAmPm} 
                        onChange={(e) => setFocusEndAmPm(e.target.value)}
                        className="bg-[#050505]/40 border border-white/[0.08] text-[#f0ebe0] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[#c9a84c]"
                      >
                        <option value="AM" className="bg-[#111]">AM</option>
                        <option value="PM" className="bg-[#111]">PM</option>
                      </select>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#c9a84c] mt-2 block">Donna protects this time from meetings</span>
                </div>

                {/* Q8 */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-sans font-light text-[#8a8070]">
                    Q8 — How do you prefer to work? (Select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {workStyleOptions.map(style => {
                      const selected = workStyle.includes(style);
                      return (
                        <button
                          key={style}
                          type="button"
                          onClick={() => toggleWorkStyle(style)}
                          className={`px-4 py-2 rounded-full border text-xs font-sans font-light transition-all duration-200 cursor-pointer ${selected ? 'bg-[#c9a84c]/10 border-[#c9a84c] text-[#c9a84c]' : 'bg-[#050505]/20 border-white/[0.08] text-[#8a8070] hover:border-white/[0.15]'}`}
                        >
                          {style}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION: WHAT DONNA SHOULD KNOW */}
              <div className="space-y-4">
                <div className="text-[10px] font-mono tracking-wider uppercase text-[#c9a84c] select-none font-bold">
                  Context Donna needs
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Q9 — What are you working toward right now? <span className="text-[#c9a84c]">*</span>
                  </label>
                  <textarea 
                    rows={3}
                    required
                    value={currentGoal}
                    onChange={(e) => setCurrentGoal(e.target.value)}
                    placeholder="e.g. Launching a product in 3 months, finishing my thesis, growing my client base"
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Q10 — Who do you work with most?
                  </label>
                  <textarea 
                    rows={2}
                    value={keyPeople}
                    onChange={(e) => setKeyPeople(e.target.value)}
                    placeholder="e.g. A co-founder, my manager Rohan, clients from the finance sector"
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Q11 — What should Donna never interrupt you for?
                  </label>
                  <input 
                    type="text"
                    value={doNotDisturb}
                    onChange={(e) => setDoNotDisturb(e.target.value)}
                    placeholder="e.g. Marketing emails, calendar invites from unknown people, anything before 9am"
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between">
                    <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                      Q12 — Anything else Donna should know about you?
                    </label>
                    <span className="text-[10px] text-gray-500 font-light italic">Optional — but the more you share, the better Donna gets</span>
                  </div>
                  <textarea 
                    rows={4}
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="Working style, pet peeves, communication preferences, anything relevant"
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* SECTION: DONNA'S PERSONALITY */}
              <div className="space-y-4">
                <div className="text-[10px] font-mono tracking-wider uppercase text-[#c9a84c] select-none font-bold">
                  How direct should Donna be?
                </div>

                <div className="space-y-3.5 p-4 rounded-xl bg-black/20 border border-white/[0.04]">
                  <div className="flex justify-between items-center text-xs font-sans select-none">
                    <span className="text-[#8a8070] font-light">Donna's assertiveness style:</span>
                    <span className="text-[#c9a84c] font-medium">{assertivenessLevel}%</span>
                  </div>

                  <input 
                    type="range"
                    min="0"
                    max="100"
                    className="w-full h-1 bg-[#111] accent-[#c9a84c] rounded-lg border-none cursor-pointer"
                    value={assertivenessLevel}
                    onChange={(e) => setAssertivenessLevel(Number(e.target.value))}
                  />

                  <div className="flex justify-between text-[10px] text-gray-500 font-light select-none">
                    <span>Gentle guidance</span>
                    <span>Brutally direct</span>
                  </div>

                  <p className="text-[11px] text-[#c9a84c] font-sans text-center bg-[#c9a84c]/5 border border-[#c9a84c]/10 py-2 rounded-lg select-none">
                    {getAssertivenessDesc(assertivenessLevel)}
                  </p>
                </div>
              </div>

            </div>

            {/* BUTTONS BAR */}
            <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between select-none">
              <button
                type="button"
                onClick={() => setScreen(1)}
                className="text-xs text-[#8a8070] hover:text-[#ebd083] transition cursor-pointer flex items-center space-x-1"
              >
                <span>← Back</span>
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-[#8a8070] hover:text-[#c9a84c] underline decoration-[#c9a84c]/10 underline-offset-4 cursor-pointer"
              >
                Skip for now
              </button>

              <button
                type="button"
                disabled={!isFormValid()}
                onClick={handleContinueToScreen3}
                className="h-11 px-8 bg-[#c9a84c] hover:bg-[#ebd083] disabled:bg-[#c9a84c]/20 text-[#0c0c0c] disabled:text-[#4a4540] font-sans font-medium text-xs rounded-full flex items-center space-x-1.5 transition-all duration-200 active:scale-[0.97] cursor-pointer shadow-lg disabled:cursor-not-allowed"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: DONNA'S READY */}
        {screen === 3 && (
          <div className="w-full space-y-8 max-w-lg text-center animate-fade-in select-none flex flex-col items-center">
            
            {/* Animated DonnaBlob Orb */}
            <div className="w-36 h-36 flex items-center justify-center relative mb-2">
              <DonnaBlob state="idle" size={140} />
            </div>

            <div className="space-y-4">
              <h2 className="font-serif text-3xl md:text-4xl text-[#f0ebe0] font-normal tracking-tight">
                Donna's ready.
              </h2>

              {/* Personalized Response */}
              {loadingPersonalizedLine ? (
                <div className="flex items-center justify-center space-x-2 py-4 text-xs font-mono text-[#c9a84c] h-12">
                  <span className="w-2 h-2 rounded-full bg-[#c9a84c] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[#c9a84c] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[#c9a84c] animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="pl-1">Synthesizing personalized parameters...</span>
                </div>
              ) : (
                <p className="text-[15px] text-[#ebd083] font-serif font-light italic leading-relaxed max-w-md mx-auto h-12 flex items-center justify-center">
                  "{personalizedLine}"
                </p>
              )}
            </div>

            {/* Config Summary Chips */}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <div className="bg-black/40 border border-white/[0.04] px-4 py-2 rounded-xl text-xs font-mono text-gray-400 flex items-center space-x-1.5">
                <span>🕘</span>
                <span>{startHour}:{startMin} {startAmPm} — {endHour}:{endMin} {endAmPm}</span>
              </div>

              <div className="bg-black/40 border border-white/[0.04] px-4 py-2 rounded-xl text-xs font-mono text-gray-400 flex items-center space-x-1.5">
                <span>🎯 Focus:</span>
                <span>{focusStartHour}:{focusStartMin} {focusStartAmPm} — {focusEndHour}:{focusEndMin} {focusEndAmPm}</span>
              </div>

              <div className="bg-black/40 border border-white/[0.04] px-4 py-2 rounded-xl text-xs font-mono text-gray-400 flex items-center space-x-1.5">
                <span>📍</span>
                <span>{location}</span>
              </div>
            </div>

            {/* Enter Your Office Button */}
            <div className="w-full flex flex-col sm:flex-row items-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => setScreen(2)}
                className="w-full sm:w-1/3 h-12 border border-white/[0.08] hover:bg-white/[0.04] text-[#8a8070] hover:text-[#ebd083] font-sans font-medium text-xs rounded-full flex items-center justify-center transition-all duration-200 active:scale-[0.97] cursor-pointer"
              >
                ← Back
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isSaving}
                className="flex-grow h-12 bg-[#c9a84c] hover:bg-[#ebd083] disabled:opacity-50 text-[#0c0c0c] font-sans font-medium text-xs rounded-full flex items-center justify-center transition-all duration-200 active:scale-[0.97] cursor-pointer shadow-lg select-none disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span>Calibrating secretary servers...</span>
                ) : (
                  <span>Enter your office →</span>
                )}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* FOOTER DESCRIPTOR */}
      <div className="w-full max-w-5xl px-6 pb-6 text-center select-none text-[10px] font-mono text-gray-600 z-20">
        © 2026 Donna Inc. Private Executive Ledger. Securing Workspace Nodes.
      </div>
    </div>
  );
}
