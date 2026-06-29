import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Sparkles, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { auth, getGoogleProvider } from '../firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updateProfile 
} from 'firebase/auth';

interface LoginViewProps {
  onLogin: (name: string) => void;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setError(null);
    setInfoMessage(null);
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
        // Fallback for if browser or scope doesn't return an access token but they authenticated successfully
        localStorage.setItem('donna_demo_mode', 'false');
        localStorage.setItem('donna_user_name', result.user.displayName || 'Partner');
        localStorage.setItem('donna_user_email', result.user.email || '');
        localStorage.setItem('donna_user_uid', result.user.uid);
        onLogin(result.user.displayName || 'Partner');
      }
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setError(`Sign-in failed: ${err.message || err}. You can still proceed using the 'Continue with offline session' option below.`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoggingIn(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (authMode === 'signup') {
        if (!fullName.trim()) {
          setError("Full name is required for registration.");
          setIsLoggingIn(false);
          return;
        }
        // Register user
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // Set display name
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: fullName.trim() });
        }
        localStorage.setItem('donna_demo_mode', 'false');
        localStorage.setItem('donna_user_name', fullName.trim());
        localStorage.setItem('donna_user_email', result.user.email || '');
        localStorage.setItem('donna_user_uid', result.user.uid);
        onLogin(fullName.trim());
      } else {
        // Sign in user
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        const name = result.user.displayName || email.split('@')[0];
        localStorage.setItem('donna_demo_mode', 'false');
        localStorage.setItem('donna_user_name', name);
        localStorage.setItem('donna_user_email', result.user.email || '');
        localStorage.setItem('donna_user_uid', result.user.uid);
        onLogin(name);
      }
    } catch (err: any) {
      console.error("Email auth failed:", err);
      let errMsg = err.message || err;
      if (err.code === 'auth/wrong-password') {
        errMsg = "Incorrect password. Please try again.";
      } else if (err.code === 'auth/user-not-found') {
        errMsg = "No account is registered with this email.";
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = "An account with this email already exists.";
      } else if (err.code === 'auth/invalid-email') {
        errMsg = "Please enter a valid email address.";
      } else if (err.code === 'auth/weak-password') {
        errMsg = "Password must be at least 6 characters.";
      }
      setError(errMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoggingIn(true);
    setError(null);
    setInfoMessage(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMessage("Reset instructions have been routed to your inbox. Check spam if not received in 2 minutes.");
      setAuthMode('login');
    } catch (err: any) {
      console.error("Password reset error:", err);
      setError(err.message || "Failed to send reset email.");
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
        <div className="w-16 h-16 rounded-full border border-[#c9a84c]/30 flex items-center justify-center mb-5 bg-[#161616] shadow-2xl relative group">
          <div className="absolute inset-0.5 rounded-full border border-dashed border-[#c9a84c]/10 group-hover:rotate-45 transition-transform duration-700" />
          <span className="font-serif text-3xl font-bold tracking-normal text-[#c9a84c] pl-0.5 select-none">D</span>
        </div>

        {/* Brand Display Typography */}
        <h1 className="font-serif text-[38px] md:text-5xl font-bold tracking-tight text-[#f0ebe0] mb-1">
          Donna
        </h1>
        <p className="text-[10px] font-sans tracking-widest text-[#8a8070] uppercase mb-6 font-light">
          Always one step ahead.
        </p>

        {/* Real Firebase Multi-Auth Board */}
        <div className="w-full bg-[rgba(20,18,14,0.65)] backdrop-blur-[40px] p-8 rounded-[24px] border border-[#c9a84c]/15 shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300">
          
          {error && (
            <div className="text-xs text-red-400/95 font-sans leading-relaxed mb-4 p-3 bg-red-950/25 border border-red-500/15 rounded-xl text-left">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="text-xs text-[#ebd083] font-sans leading-relaxed mb-4 p-3 bg-[#ebd083]/10 border border-[#c9a84c]/20 rounded-xl text-left">
              {infoMessage}
            </div>
          )}

          {authMode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
              <div className="flex items-center space-x-2 mb-4">
                <button 
                  type="button" 
                  onClick={() => setAuthMode('login')} 
                  className="p-1 rounded-full hover:bg-white/[0.04] text-[#8a8070] hover:text-[#f0ebe0] transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-xs font-sans tracking-wider uppercase text-[#c9a84c] font-semibold">Forgot Ledger Password</h2>
              </div>
              
              <div>
                <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                  Ledger Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-[#4a4540] pointer-events-none stroke-[1.5]" />
                  <input 
                    type="email"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 pl-10 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none placeholder-neutral-700"
                    placeholder="partner@executive.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-11 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] rounded-full font-sans font-medium text-xs flex items-center justify-center transition-all duration-200 active:scale-[0.97] cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? "Routing Request..." : "Route Reset Instructions"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailAuthSubmit} className="space-y-4 text-left">
              
              {authMode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Your Professional Name
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3 w-4 h-4 text-[#4a4540] pointer-events-none stroke-[1.5]" />
                    <input 
                      type="text"
                      required
                      className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 pl-10 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none placeholder-neutral-700"
                      placeholder="e.g., Harvey Specter"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                  Ledger Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-[#4a4540] pointer-events-none stroke-[1.5]" />
                  <input 
                    type="email"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 pl-10 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none placeholder-neutral-700"
                    placeholder="partner@executive.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-sans font-light text-[#8a8070]">
                    Secure Password
                  </label>
                  {authMode === 'login' && (
                    <button 
                      type="button" 
                      onClick={() => setAuthMode('forgot')}
                      className="text-[10px] font-sans font-light text-[#8a8070] hover:text-[#c9a84c] transition cursor-pointer"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-[#4a4540] pointer-events-none stroke-[1.5]" />
                  <input 
                    type="password"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 pl-10 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none placeholder-neutral-700"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-11 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] rounded-full font-sans font-medium text-xs flex items-center justify-center transition-all duration-200 active:scale-[0.97] cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <span className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-[#0c0c0c] animate-ping" />
                    <span>Verifying Credentials...</span>
                  </span>
                ) : (
                  <span>{authMode === 'login' ? "Access Donna Ledger" : "Authorize Donna Access"}</span>
                )}
              </button>

              <div className="flex justify-center text-[11px] text-[#8a8070] select-none pt-1">
                {authMode === 'login' ? (
                  <p>
                    New to Donna?{' '}
                    <button 
                      type="button" 
                      onClick={() => { setAuthMode('signup'); setError(null); }}
                      className="text-[#c9a84c] hover:underline font-medium cursor-pointer"
                    >
                      Create account
                    </button>
                  </p>
                ) : (
                  <p>
                    Already verified?{' '}
                    <button 
                      type="button" 
                      onClick={() => { setAuthMode('login'); setError(null); }}
                      className="text-[#c9a84c] hover:underline font-medium cursor-pointer"
                    >
                      Log in here
                    </button>
                  </p>
                )}
              </div>

              <div className="relative flex py-2 items-center select-none">
                <div className="flex-grow border-t border-white/[0.04]"></div>
                <span className="flex-shrink mx-3 text-[10px] uppercase tracking-widest font-mono text-[#4a4540]">OR CONNECT WITH</span>
                <div className="flex-grow border-t border-white/[0.04]"></div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="w-full h-11 border border-white/[0.08] hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/8 text-[#ebd083] rounded-full font-sans font-light text-xs flex items-center justify-center space-x-3 transition-all duration-200 active:scale-[0.97] cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-[#c9a84c]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.865 0-7-3.135-7-7s3.135-7 7-7c1.84 0 3.515.715 4.775 1.885l2.45-2.45C17.155 1.485 14.86 1 12.24 1 6.725 1 2.24 5.485 2.24 11s4.485 10 10 10c5.755 0 9.76-4.045 9.76-9.925 0-.595-.065-1.185-.18-1.79H12.24z"/>
                </svg>
                <span>Authorize Google Workspace</span>
              </button>
            </form>
          )}

          {/* Offline demo bypass */}
          <div className="mt-5 flex items-center justify-center">
            <button
              onClick={handleDemoBypass}
              className="text-[10px] font-sans tracking-wide text-[#8a8070] hover:text-[#c9a84c] underline underline-offset-4 decoration-[#c9a84c]/20 transition-all duration-200 cursor-pointer text-center"
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
