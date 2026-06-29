import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { auth, getGoogleProvider } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

interface LoginViewProps {
  onLogin: (name: string) => void;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const provider = getGoogleProvider();
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
        console.log('DONNA: Access token stored successfully');
        onLogin(result.user.displayName || 'Partner');
      } else {
        console.error('DONNA: credential.accessToken was null. The OAuth scopes may not have been granted.');
        setError("Authorization succeeded, but no Access Token was returned by Google. Please try again.");
      }
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setError(`Sign-in failed: ${err.message || err}. You can still proceed using the 'Continue with offline session' option below.`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoBypass = () => {
    localStorage.setItem('donna_demo_mode', 'true');
    localStorage.setItem('donna_access_token', 'demo-token');
    localStorage.setItem('donna_user_name', 'Revant Kumar');
    localStorage.setItem('donna_user_email', 'revanthanilkumar@gmail.com');
    localStorage.setItem('donna_user_photo', '');
    localStorage.setItem('donna_user_uid', 'demo-uid');
    onLogin('Revant Kumar');
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#f0ebe0] font-sans flex flex-col justify-between p-8 relative overflow-hidden select-none">
      {/* Premium Ambient Background Glow */}
      <div className="absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#8a6f30]/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[#c9a84c]/5 blur-[160px] pointer-events-none" />

      {/* Header Accent - Minimal spacer */}
      <div className="h-4 z-10" />

      {/* Centerpiece Welcome Card */}
      <div className="w-full max-w-md mx-auto my-auto z-10 flex flex-col items-center text-center">
        {/* Elite Monogram Icon */}
        <div className="w-16 h-16 rounded-full border border-[#c9a84c]/30 flex items-center justify-center mb-6 bg-[#161616] shadow-2xl relative group">
          <div className="absolute inset-0.5 rounded-full border border-dashed border-[#c9a84c]/10 group-hover:rotate-45 transition-transform duration-700" />
          <span className="font-serif text-3xl font-bold tracking-normal text-[#c9a84c] pl-0.5 select-none">D</span>
        </div>

        {/* Brand Display Typography */}
        <h1 className="font-serif text-5xl md:text-6xl font-bold tracking-normal text-[#f0ebe0] mb-2">
          Donna
        </h1>
        <p className="text-xs font-sans tracking-wide text-[#4a4540] mb-8 font-light">
          Always one step ahead.
        </p>

        {/* Real Firebase Google Sign-In */}
        <div className="w-full bg-[rgba(20,18,14,0.6)] backdrop-blur-[40px] p-10 rounded-[20px] border border-[#c9a84c]/10 shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-200 hover:translate-y-[-1px] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)]">
          <div className="text-sm text-[#8a8070] mb-6 font-light leading-relaxed">
            Connect your secure executive ledger. Donna requires Google Calendar, Tasks, and Gmail permissions to synchronize and protect your day.
          </div>

          {error && (
            <div className="text-xs text-red-400/90 font-sans leading-relaxed mb-4 p-3.5 bg-red-950/20 border border-red-500/10 rounded-xl">
              {error}
            </div>
          )}
          
          <button 
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={isLoggingIn}
            className="w-full h-11 border border-[#c9a84c]/40 hover:bg-[#c9a84c]/8 text-[#c9a84c] rounded-full font-sans font-medium text-xs flex items-center justify-center space-x-3 transition-all duration-200 active:scale-[0.97] shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? (
              <span className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#c9a84c] animate-ping" />
                <span>Authorizing Security Keys...</span>
              </span>
            ) : (
              <>
                <svg className="w-4 h-4 text-[#c9a84c]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.865 0-7-3.135-7-7s3.135-7 7-7c1.84 0 3.515.715 4.775 1.885l2.45-2.45C17.155 1.485 14.86 1 12.24 1 6.725 1 2.24 5.485 2.24 11s4.485 10 10 10c5.755 0 9.76-4.045 9.76-9.925 0-.595-.065-1.185-.18-1.79H12.24z"/>
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          {/* Offline demo bypass */}
          <div className="mt-4 flex items-center justify-center">
            <button
              onClick={handleDemoBypass}
              className="text-[11px] font-sans tracking-wide text-[#8a8070] hover:text-[#c9a84c] underline underline-offset-4 decoration-[#c9a84c]/20 transition-all duration-200 cursor-pointer text-center"
            >
              Continue with premium offline session (Demo Bypass)
            </button>
          </div>
        </div>
      </div>

      {/* Footer descriptor list - in Donna's voice */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full pt-6 border-t border-white/[0.04] text-left z-10">
        <div className="p-5 rounded-2xl bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:translate-y-[-1px] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] transition-all duration-200">
          <div className="flex items-center space-x-2 text-[#c9a84c] mb-2">
            <Sparkles className="w-4 h-4 stroke-[1.5]" />
            <h3 className="text-xs font-sans font-medium tracking-normal">Morning briefings</h3>
          </div>
          <p className="text-xs text-[#4a4540] font-light leading-relaxed">
            Active daily assessments that highlight calendar conflicts, filter administrative fluff, and give direct strategic guidance before your desk turns busy.
          </p>
        </div>
        
        <div className="p-5 rounded-2xl bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:translate-y-[-1px] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] transition-all duration-200">
          <div className="flex items-center space-x-2 text-[#c9a84c] mb-2">
            <ShieldCheck className="w-4 h-4 stroke-[1.5]" />
            <h3 className="text-xs font-sans font-medium tracking-normal">People & event intel</h3>
          </div>
          <p className="text-xs text-[#4a4540] font-light leading-relaxed">
            Donna remembers the subtle relationship dynamics, executive profiles, and past commitments of every client and contact. You're prepared before you sit.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:translate-y-[-1px] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] transition-all duration-200">
          <div className="flex items-center space-x-2 text-[#c9a84c] mb-2">
            <KeyRound className="w-4 h-4 stroke-[1.5]" />
            <h3 className="text-xs font-sans font-medium tracking-normal">No robotic hedging</h3>
          </div>
          <p className="text-xs text-[#4a4540] font-light leading-relaxed">
            Direct opinions, smart pushes on overfilled schedules, and robust logic blocks. Built for senior stakeholders who value direct partner answers above placeholders.
          </p>
        </div>
      </div>
    </div>
  );
}
