import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, UserContext, DonnaMemoryFact, Task, CalendarEvent, AppEmail, Person, PriorityLevel } from '../types';
import { 
  Mic, Send, Sparkles, AlertCircle, Calendar, Check, Trash2, 
  Volume2, VolumeX, Menu, X, FileText, Mail, ListTodo, Plus 
} from 'lucide-react';
import { genAI, DONNA_SYSTEM_PROMPT, ALL_DONNA_FUNCTIONS, getDonnaPersonalityPrompt, getDetectedModel, setFallbackModel } from '../gemini';
import DonnaBlob from './voice/DonnaBlob';
import { FunctionExecutor } from '../services/functionExecutor';
import { voiceService } from '../services/voiceService';
import { auth } from '../firebase';
import { buildDonnaContext } from '../utils/buildDonnaContext';

interface ChatViewProps {
  userContext: UserContext;
  donnaMemory: DonnaMemoryFact[];
  chatHistory: ChatMessage[];
  onUpdateChat: (messages: ChatMessage[]) => void;
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  events: CalendarEvent[];
  onUpdateEvents: (events: CalendarEvent[]) => void;
  emails: AppEmail[];
  people: Person[];
  prefilledChatInput?: string;
  onClearPrefilledChatInput?: () => void;
}

export default function ChatView({
  userContext,
  donnaMemory,
  chatHistory,
  onUpdateChat,
  tasks,
  onUpdateTasks,
  events,
  onUpdateEvents,
  emails,
  people,
  prefilledChatInput,
  onClearPrefilledChatInput
}: ChatViewProps) {
  // Navigation & View Toggles
  const [isVoiceMode, setIsVoiceMode] = useState(true);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = sessionStorage.getItem('donna_conversation_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse conversation history from sessionStorage", e);
      }
    }
    return chatHistory;
  });
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // Voice Interaction State
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [blobState, setBlobState] = useState<'idle' | 'listening' | 'speaking' | 'thinking'>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechCharIndex, setSpeechCharIndex] = useState<number>(0);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  // Action / Feedback Feedback State
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; message: string; type: string }>>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    name: string;
    args: any;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Web API Refs
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat and transcript
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [messages, transcript, speechCharIndex, isThinking]);

  // Keep parent and sessionStorage in sync
  useEffect(() => {
    sessionStorage.setItem('donna_conversation_history', JSON.stringify(messages));
    onUpdateChat(messages);
  }, [messages]);

  // Sync initial prefills
  useEffect(() => {
    if (prefilledChatInput) {
      setIsVoiceMode(false); // Switch to chat mode for typed prefills
      handleDonnaResponse(prefilledChatInput);
      if (onClearPrefilledChatInput) {
        onClearPrefilledChatInput();
      }
    }
  }, [prefilledChatInput]);

  // Check speech support on mount
  useEffect(() => {
    const supported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    setSpeechSupported(supported);
  }, []);

  // Auto-switch to Chat mode if speech isn't supported
  useEffect(() => {
    if (!speechSupported) {
      setIsVoiceMode(false);
    }
  }, [speechSupported]);

  // Time helper
  const getTimeOfDay = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'morning';
    if (hours < 17) return 'afternoon';
    return 'evening';
  };

  // Donna speaks first on Chat page open
  const triggerDonnaWelcome = async () => {
    const hasGreeted = sessionStorage.getItem('donna_greeted_this_session') === 'true';
    if (hasGreeted) return;

    sessionStorage.setItem('donna_greeted_this_session', 'true');
    setBlobState('thinking');
    setIsThinking(true);

    try {
      const firstName = userContext?.name ? userContext.name.split(' ')[0] : 'Partner';
      const timeOfDay = getTimeOfDay();
      const todayEvents = events.filter(e => e.date === new Date().toISOString().split('T')[0]);
      const activeTasks = tasks.filter(t => !t.completed);

      const uid = auth.currentUser?.uid || localStorage.getItem('donna_user_uid') || 'demo-uid';
      const donnaContext = await buildDonnaContext(uid, { 
        events: todayEvents, 
        tasks: activeTasks,
        emails: emails,
        emailCount: emails.filter(e => !e.hasReplied).length 
      });

      const prompt = `Generate a personalized, warm, and highly professional executive greeting as Donna.
${donnaContext}

Your instructions:
- Start with 'Hey ${firstName},' (NOT 'Good morning' or 'Good afternoon').
- Highlight or reference 1 specific event or task if available.
- Keep the greeting extremely concise: exactly 2 to 3 sentences maximum.
- Speak in Donna's authentic Suits voice — direct, opinionated, warm but razor-sharp.
- End with a clean open invitation: 'What do you need?', 'What are we working on?', or 'Talk to me.'
- Make it unique and natural. Avoid repeating the same template patterns.`;

      let modelToUse = getDetectedModel();
      let response;
      try {
        const model = genAI.getGenerativeModel({
          model: modelToUse,
          systemInstruction: DONNA_SYSTEM_PROMPT + `\n` + donnaContext,
        });
        response = await model.generateContent(prompt);
      } catch (err: any) {
        const errMsg = err.message || String(err);
        if ((modelToUse === 'gemini-3.5-flash' || modelToUse === 'gemini-2.5-flash') && (
          errMsg.includes('PERMISSION_DENIED') || 
          errMsg.includes('403') || 
          errMsg.includes('not found') || 
          errMsg.includes('not support') || 
          errMsg.includes('permission')
        )) {
          setFallbackModel();
          modelToUse = getDetectedModel();
          const model = genAI.getGenerativeModel({
            model: modelToUse,
            systemInstruction: DONNA_SYSTEM_PROMPT + `\n` + donnaContext,
          });
          response = await model.generateContent(prompt);
        } else {
          throw err;
        }
      }
      const greetingText = response.response.text();

      const donnaMsg: ChatMessage = {
        id: `donna-welcome-${Date.now()}`,
        role: 'model',
        content: greetingText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      };

      setMessages(prev => [...prev, donnaMsg]);
      speakText(greetingText);
    } catch (e) {
      console.error("Failed to generate custom Donna welcome:", e);
      const firstName = userContext?.name ? userContext.name.split(' ')[0] : 'Partner';
      const todayEvents = events.filter(e => e.date === new Date().toISOString().split('T')[0]);
      let greetingText = `Hey ${firstName}, I've got your schedule locked in and looking clean. `;
      if (todayEvents.length > 0) {
        greetingText += `We have "${todayEvents[0].title}" coming up, so let's keep details tight. `;
      } else {
        greetingText += `No direct meetings blocking your calendar today, giving us room to push. `;
      }
      greetingText += `What are we working on?`;

      const donnaMsg: ChatMessage = {
        id: `donna-welcome-${Date.now()}`,
        role: 'model',
        content: greetingText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      };

      setMessages(prev => [...prev, donnaMsg]);
      speakText(greetingText);
    } finally {
      setIsThinking(false);
    }
  };

  useEffect(() => {
    const hasGreeted = sessionStorage.getItem('donna_greeted_this_session') === 'true';
    if (hasGreeted) return;

    const timer = setTimeout(() => {
      triggerDonnaWelcome();
    }, 1500);

    return () => clearTimeout(timer);
  }, [userContext, events, tasks]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (!speechSupported) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setBlobState('listening');
      setIsRecording(true);
      setTranscript('');
      startAudioAnalysis();
    };

    rec.onresult = (event: any) => {
      const current = Array.from(event.results)
        .map((res: any) => res[0].transcript)
        .join('');
      setTranscript(current);
    };

    rec.onend = () => {
      setIsRecording(false);
      stopAudioAnalysis();
      
      // Submit non-empty transcription
      setTranscript(prev => {
        if (prev.trim()) {
          // Speak / Send to Donna
          setTimeout(() => {
            handleDonnaResponse(prev);
          }, 400);
        } else {
          setBlobState('idle');
        }
        return prev;
      });
    };

    rec.onerror = (e: any) => {
      console.error("Speech recognition error:", e);
      setIsRecording(false);
      setBlobState('idle');
      stopAudioAnalysis();
    };

    recognitionRef.current = rec;

    // Cleanup speech on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopAudioAnalysis();
      voiceService.stopSpeaking();
    };
  }, [speechSupported]);

  // Web Audio Mic Level Analysis
  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
          total += dataArray[i];
        }
        const avg = total / bufferLength;
        // Normalize to approx 0-1
        setAudioLevel(Math.min(1, avg / 100));
        animationRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn("Could not access microphone for visualization:", err);
    }
  };

  const stopAudioAnalysis = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setAudioLevel(0);
  };

  // Spoken text helper for word-by-word streaming effect
  const getSpokenText = (text: string, charIndex: number) => {
    if (charIndex >= text.length) return text;
    const remaining = text.substring(charIndex);
    const nextSpace = remaining.indexOf(' ');
    const endLimit = nextSpace !== -1 ? charIndex + nextSpace : text.length;
    return text.substring(0, endLimit);
  };

  // Donna voice output
  const speakText = async (text: string) => {
    voiceService.stopSpeaking();
    if (isMuted) return;

    // Filter markdown out of speech for clean audio
    const cleanText = text
      .replace(/[*#_`~\[\]()]/g, '')
      .replace(/https?:\/\/\S+/g, 'link');

    setBlobState('speaking');
    setSpeechCharIndex(0);

    try {
      await voiceService.speak(
        cleanText,
        (word, accumulated, charIndex) => {
          if (charIndex !== undefined) {
            setSpeechCharIndex(charIndex);
          }
        },
        () => {
          setBlobState('idle');
          setSpeechCharIndex(text.length);
        }
      );
    } catch (e) {
      console.error("voiceService.speak failed:", e);
      setBlobState('idle');
      setSpeechCharIndex(text.length);
    }
  };

  // Toggle Dictation listening
  const handleMicTap = () => {
    if (!speechSupported) {
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      voiceService.stopSpeaking();
      recognitionRef.current?.start();
    }
  };

  // Core conversational state sides effects mapper (updates client view states instantly)
  const handleStateSideEffects = (funcName: string, args: any, responseData: any) => {
    if (responseData?.error || responseData?.status === 'cancelled') return;

    if (funcName === 'create_calendar_event') {
      const newEv: CalendarEvent = {
        id: responseData.id || `evt-${Date.now()}`,
        title: args.title,
        date: args.date,
        startTime: args.start_time,
        duration: args.duration_minutes,
        attendees: args.attendees || [],
        description: args.description || ''
      };
      onUpdateEvents([newEv, ...events]);
    } else if (funcName === 'update_calendar_event') {
      const updated = events.map(ev => {
        if (ev.id === args.event_id) {
          return {
            ...ev,
            title: args.updates.title !== undefined ? args.updates.title : ev.title,
            date: args.updates.date !== undefined ? args.updates.date : ev.date,
            startTime: args.updates.start_time !== undefined ? args.updates.start_time : ev.startTime,
            duration: args.updates.duration_minutes !== undefined ? args.updates.duration_minutes : ev.duration,
            description: args.updates.description !== undefined ? args.updates.description : ev.description
          };
        }
        return ev;
      });
      onUpdateEvents(updated);
    } else if (funcName === 'delete_calendar_event') {
      onUpdateEvents(events.filter(ev => ev.id !== args.event_id));
    } else if (funcName === 'create_task') {
      const newTask: Task = {
        id: responseData.id || `task-${Date.now()}`,
        title: args.title,
        dueDate: args.due_date || '',
        priority: (args.priority === 'URGENT' ? 'URGENT' : args.priority === 'LOW' ? 'NORMAL' : 'HIGH') as PriorityLevel,
        completed: false,
        timeEstimate: '30m',
        donnaNote: args.notes || 'Created via Donna conversational sync'
      };
      onUpdateTasks([newTask, ...tasks]);
    } else if (funcName === 'complete_task') {
      onUpdateTasks(tasks.map(t => t.id === args.task_id ? { ...t, completed: true } : t));
    } else if (funcName === 'update_task') {
      onUpdateTasks(tasks.map(t => {
        if (t.id === args.task_id) {
          return {
            ...t,
            title: args.updates.title !== undefined ? args.updates.title : t.title,
            dueDate: args.updates.due !== undefined ? args.updates.due : t.dueDate,
            donnaNote: args.updates.notes !== undefined ? args.updates.notes : t.donnaNote
          };
        }
        return t;
      }));
    } else if (funcName === 'delete_task') {
      onUpdateTasks(tasks.filter(t => t.id !== args.task_id));
    }
  };

  // Toast feedback trigger
  const triggerSuccessToast = (funcName: string, args: any) => {
    let title = "Action Executed";
    let message = "";
    
    if (funcName === 'create_calendar_event') {
      title = "Calendar Event Scheduled";
      message = `"${args.title}" on ${args.date} at ${args.start_time}`;
    } else if (funcName === 'update_calendar_event') {
      title = "Calendar Event Updated";
      message = `Successfully updated event ID: ${args.event_id}`;
    } else if (funcName === 'delete_calendar_event') {
      title = "Calendar Event Deleted";
      message = `Removed event from Google Calendar`;
    } else if (funcName === 'create_task') {
      title = "Google Task Created";
      message = `"${args.title}" added to default list`;
    } else if (funcName === 'complete_task') {
      title = "Task Completed";
      message = `Marked task as completed in Google Tasks`;
    } else if (funcName === 'update_task') {
      title = "Google Task Updated";
      message = `Updated task details`;
    } else if (funcName === 'delete_task') {
      title = "Task Deleted";
      message = `Removed task from Google Tasks`;
    } else if (funcName === 'draft_email') {
      title = "Email Draft Created";
      message = `Draft saved for "${args.to}"`;
    } else if (funcName === 'send_email') {
      title = "Email Sent Successfully";
      message = `To ${args.to}: "${args.subject}"`;
    } else if (funcName === 'reply_to_email') {
      title = "Reply Sent Successfully";
      message = `Thread reply dispatched`;
    } else {
      return;
    }

    const newToast = {
      id: `toast-${Date.now()}`,
      title,
      message,
      type: funcName
    };

    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, 4500);
  };

  // Process User Queries with Gemini Function Calling & Real API Executions
  const handleDonnaResponse = async (userInput: string) => {
    if (!userInput.trim()) return;

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setBlobState('thinking');
    setIsThinking(true);

    const accessToken = localStorage.getItem('donna_access_token') || '';

    try {
      // 1. Build context with today's date/time, and loaded local values
      const uid = auth.currentUser?.uid || localStorage.getItem('donna_user_uid') || 'demo-uid';
      const donnaContext = await buildDonnaContext(uid, { 
        events, 
        tasks, 
        emails, 
        emailCount: emails.filter(e => !e.hasReplied).length 
      });
      const contextualPrompt = `
${DONNA_SYSTEM_PROMPT}

${donnaContext}

If you decide to invoke any read/write functions (tools), do so. Once the tool returns, interpret the result and present the final confirmation naturally in Donna's voice. Never describe the underlying technical parameters.
`;

      // 2. Format alternating chat history for Gemini
      const rawHistory = messages
        .filter(m => m.role === 'user' || m.role === 'model')
        .map(m => ({
          role: m.role === 'user' ? ('user' as const) : ('model' as const),
          parts: [{ text: m.content || '' }]
        }));

      const validHistory: any[] = [];
      let expected = 'user';
      for (const h of rawHistory) {
        if (h.role === expected) {
          validHistory.push(h);
          expected = expected === 'user' ? 'model' : 'user';
        }
      }
      const chatHistoryForGemini = validHistory.length > 0 && validHistory[0].role === 'user' ? validHistory : [];

      // 3. Request model
      let modelToUse = getDetectedModel();
      let chat;
      let result;
      try {
        const model = genAI.getGenerativeModel({
          model: modelToUse,
          systemInstruction: contextualPrompt,
          tools: [{ functionDeclarations: ALL_DONNA_FUNCTIONS }]
        });
        chat = model.startChat({
          history: chatHistoryForGemini,
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.75,
          }
        });
        result = await chat.sendMessage(userInput);
      } catch (err: any) {
        const errMsg = err.message || String(err);
        if ((modelToUse === 'gemini-3.5-flash' || modelToUse === 'gemini-2.5-flash') && (
          errMsg.includes('PERMISSION_DENIED') || 
          errMsg.includes('403') || 
          errMsg.includes('not found') || 
          errMsg.includes('not support') || 
          errMsg.includes('permission')
        )) {
          setFallbackModel();
          modelToUse = getDetectedModel();
          const model = genAI.getGenerativeModel({
            model: modelToUse,
            systemInstruction: contextualPrompt,
            tools: [{ functionDeclarations: ALL_DONNA_FUNCTIONS }]
          });
          chat = model.startChat({
            history: chatHistoryForGemini,
            generationConfig: {
              maxOutputTokens: 1000,
              temperature: 0.75,
            }
          });
          result = await chat.sendMessage(userInput);
        } else {
          throw err;
        }
      }

      let functionCalls = result.response.functionCalls();

      const executor = new FunctionExecutor();

      // Loop to handle chained tool calls
      while (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        const { name, args } = call;

        // Determine if destructive pre-execution authorization is needed
        const isDestructive = name === 'delete_calendar_event' || name === 'delete_task' || name === 'send_email';

        let approved = true;
        if (isDestructive) {
          setBlobState('thinking');
          approved = await new Promise<boolean>((resolve) => {
            setConfirmDialog({
              name,
              args,
              onConfirm: () => resolve(true),
              onCancel: () => resolve(false)
            });
          });
          setConfirmDialog(null);
        }

        let toolResponse: any;
        if (approved) {
          try {
            // Execute real API write/read
            toolResponse = await executor.execute(name, args, accessToken);
            triggerSuccessToast(name, args);
            handleStateSideEffects(name, args, toolResponse);
          } catch (execErr: any) {
            console.error(`Execution error for tool ${name}:`, execErr);
            toolResponse = { error: execErr.message || String(execErr) };
          }
        } else {
          toolResponse = { status: 'cancelled', message: 'User declined to authorize this action.' };
        }

        // Return tool results back to Gemini
        result = await chat.sendMessage([{
          functionResponse: {
            name,
            response: { result: toolResponse }
          }
        }]);

        // Look for subsequent chained calls
        functionCalls = result.response.functionCalls();
      }

      // Finish with final natural speech response
      const donnaText = result.response.text();
      const donnaMsg: ChatMessage = {
        id: `donna-${Date.now()}`,
        role: 'model',
        content: donnaText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      };

      setMessages(prev => [...prev, donnaMsg]);

      // Speak text
      speakText(donnaText);

    } catch (error: any) {
      console.error("Donna error during model sequence:", error);
      setBlobState('idle');
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `I hit a bump syncing with your accounts. Let's make sure our Google tokens are active and try once more. Details: ${error.message || String(error)}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    voiceService.stopSpeaking();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-0 bg-[rgba(16,15,13,0.85)] backdrop-blur-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.6)] border border-[#c9a84c]/10 rounded-2xl h-[calc(100vh-140px)] relative overflow-hidden animate-fade-in select-none">
      
      {/* SUCCESS TOASTS OVERLAY */}
      <div className="absolute top-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id}
            className="pointer-events-auto bg-[#0f0e0c] border-l-4 border-green-500 shadow-2xl p-4 rounded-r-xl max-w-sm flex items-start space-x-3 animate-slide-in"
          >
            <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-serif font-semibold text-white tracking-wide uppercase">{t.title}</h5>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed font-sans">{t.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* DESTRUCTIVE ACTION CONFIRMATION DIALOG */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-[#12110f] border-2 border-[#c9a84c]/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)] space-y-4">
            <div className="flex items-center space-x-3 text-[#c9a84c]">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-serif font-medium">Donna Authorization Required</h3>
            </div>
            
            <p className="text-[13px] text-[#f0ebe0] font-sans leading-relaxed">
              Donna has requested permission to perform a destructive operation on your connected Google account:
            </p>

            <div className="bg-black/40 border border-white/[0.04] p-3.5 rounded-xl space-y-1.5 font-mono text-xs text-gray-300">
              <div className="text-[#c9a84c] font-bold">Action: <span className="text-white">{confirmDialog.name}</span></div>
              {confirmDialog.name === 'send_email' && (
                <>
                  <div className="truncate">To: <span className="text-white">{confirmDialog.args.to}</span></div>
                  <div className="truncate">Subject: <span className="text-white">{confirmDialog.args.subject}</span></div>
                  <div className="border-t border-white/[0.04] mt-1.5 pt-1.5 text-gray-400 italic font-sans max-h-32 overflow-y-auto">
                    "{confirmDialog.args.body}"
                  </div>
                </>
              )}
              {confirmDialog.name === 'delete_calendar_event' && (
                <div>Event ID: <span className="text-white">{confirmDialog.args.event_id}</span></div>
              )}
              {confirmDialog.name === 'delete_task' && (
                <div>Task ID: <span className="text-white">{confirmDialog.args.task_id}</span></div>
              )}
            </div>

            <p className="text-[11px] text-[#8a8070] italic">
              This action will permanently modify your live Google Workspace data.
            </p>

            <div className="flex items-center space-x-3 justify-end pt-2">
              <button
                onClick={() => confirmDialog.onCancel()}
                className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/[0.04] text-[#f0ebe0] text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDialog.onConfirm()}
                className="px-5 py-2 rounded-full bg-[#c9a84c] hover:bg-[#e0be5a] text-[#0c0c0c] text-xs font-medium transition cursor-pointer flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Yes, proceed</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP COMMON BAR */}
      <div className="absolute top-0 left-0 right-0 h-16 border-b border-white/[0.04] bg-[#0c0c0c]/70 flex items-center justify-between px-6 z-30 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full border border-[#c9a84c]/30 flex items-center justify-center bg-[#c9a84c]/5">
              <span className="font-serif text-[15px] font-normal text-[#c9a84c] pl-0.5">D</span>
            </div>
            <div>
              <div className="text-[13px] font-serif font-medium text-white">Donna</div>
              <div className="text-[10px] text-gray-500 font-sans tracking-wide">Your personal secretary</div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-4">
          {/* Mute output button */}
          <button
            onClick={() => {
              setIsMuted(!isMuted);
              if (!isMuted) voiceService.stopSpeaking();
            }}
            className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-400 hover:text-[#c9a84c] hover:border-[#c9a84c]/30 transition"
            title={isMuted ? "Unmute Voice Answers" : "Mute Voice Answers"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Mode Pill Toggle */}
          <div className="bg-black/60 border border-white/[0.06] p-1 rounded-full flex items-center space-x-1">
            <button
              onClick={() => {
                setIsVoiceMode(true);
                voiceService.stopSpeaking();
                setBlobState('idle');
              }}
              className={`px-4 py-1.5 rounded-full text-[11px] font-sans font-medium transition-all ${isVoiceMode ? 'bg-[#c9a84c] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              🎙 Voice
            </button>
            <button
              onClick={() => {
                setIsVoiceMode(false);
                setIsRecording(false);
                stopAudioAnalysis();
                setBlobState('idle');
              }}
              className={`px-4 py-1.5 rounded-full text-[11px] font-sans font-medium transition-all ${!isVoiceMode ? 'bg-[#c9a84c] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              💬 Chat
            </button>
          </div>
        </div>
      </div>

      {/* VIEWPORT CONTROLLER */}
      {isVoiceMode ? (
        // ──────────────────────────────────────────────────────────
        // VOICE MODE: Full-Screen Ambient Voice Hub
        // ──────────────────────────────────────────────────────────
        <div 
          className="col-span-12 flex flex-col justify-between items-center h-full pt-20 pb-10 bg-radial-vignette relative"
          style={{
            background: 'radial-gradient(circle, rgba(32,29,24,0.9) 0%, rgba(12,11,10,1) 100%)'
          }}
        >
          {/* Main Visual Centerpiece */}
          <div className="flex-grow flex flex-col items-center justify-center space-y-6">
            <div className="relative flex items-center justify-center">
              <DonnaBlob state={blobState} audioLevel={audioLevel} />
              
              {/* Outer pulsing ring in active listening */}
              {isRecording && (
                <div className="absolute inset-0 border-2 border-[#c9a84c]/20 rounded-full animate-ping pointer-events-none scale-110" />
              )}
            </div>

            <div className="text-center space-y-1 select-none">
              <div className="text-sm font-serif italic text-gray-400">
                {!speechSupported ? "Voice works in Chrome — use Chat mode here" :
                 blobState === 'listening' ? "Go ahead, I'm listening..." :
                 blobState === 'thinking' ? "Coordinating live integrations..." :
                 blobState === 'speaking' ? "Donna is responding..." :
                 "Tap to sync with Donna"}
              </div>
              <div className="text-[10px] uppercase font-mono text-[#c9a84c]/60 tracking-widest">
                {isMuted ? "Voice Responses Muted" : "Premium Voice Feedback Active"}
              </div>
            </div>
          </div>

          {/* Transcript / Subtitles display */}
          <div 
            ref={transcriptScrollRef}
            className="w-full max-w-2xl px-6 py-4 bg-[#0a0a09]/50 border border-white/[0.04] backdrop-blur-md rounded-2xl flex flex-col h-[180px] overflow-y-auto mb-6 scrollbar-thin scrollbar-thumb-white/[0.05]"
          >
            <div className="text-[10px] font-sans text-[#c9a84c] uppercase tracking-widest mb-2 border-b border-white/[0.03] pb-1 select-none">
              Live Transcript
            </div>
            <div className="flex flex-col space-y-2 text-left flex-grow">
              {messages.slice(-6).map((msg, index) => {
                const isDonna = msg.role === 'model';
                const isCurrentlySpeaking = isDonna && index === messages.length - 1 && blobState === 'speaking';
                const displayContent = isCurrentlySpeaking ? getSpokenText(msg.content, speechCharIndex) : msg.content;
                return (
                  <div key={msg.id || index} className="flex flex-col space-y-0.5">
                    <span className="text-[10px] text-[#c9a84c] uppercase font-mono tracking-wider font-semibold">
                      {isDonna ? 'Donna' : 'You'}
                    </span>
                    <p className="text-[13px] text-[#f0ebe0] font-sans font-light leading-relaxed whitespace-pre-wrap">
                      {displayContent}
                    </p>
                  </div>
                );
              })}
              
              {/* If user is actively dictating (interim transcript) */}
              {isRecording && transcript && (
                <div className="flex flex-col space-y-0.5">
                  <span className="text-[10px] text-[#c9a84c] uppercase font-mono tracking-wider font-semibold">You</span>
                  <p className="text-[13px] text-[#f0ebe0]/70 font-sans italic font-light leading-relaxed">
                    {transcript}
                  </p>
                </div>
              )}

              {/* If Donna is thinking */}
              {isThinking && (
                <div className="flex flex-col space-y-0.5 animate-pulse">
                  <span className="text-[10px] text-[#c9a84c] uppercase font-mono tracking-wider font-semibold">Donna</span>
                  <div className="flex items-center space-x-1.5 py-1">
                    <div className="w-1.5 h-1.5 bg-[#c9a84c] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-[#c9a84c] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-[#c9a84c] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trigger controls */}
          <div className="flex flex-col items-center space-y-3">
            <button
              onClick={handleMicTap}
              disabled={!speechSupported}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-[0_4px_30px_rgba(201,168,76,0.15)] ${!speechSupported ? 'bg-[#c9a84c] text-black opacity-40 cursor-not-allowed' : isRecording ? 'bg-[#ebd083] text-black scale-105 cursor-pointer' : 'bg-[#c9a84c] text-black hover:bg-[#e0be5a] cursor-pointer'}`}
            >
              <Mic className={`w-8 h-8 ${isRecording ? 'animate-pulse' : ''}`} />
            </button>
            <div className="text-[11px] font-sans text-gray-400 tracking-wide font-medium flex flex-col items-center">
              <span>{isRecording ? "Tap to finish dictating" : "Tap to speak with Donna"}</span>
              {!speechSupported && (
                <span className="text-[10px] text-gray-500 font-normal mt-1">Voice works in Chrome — use Chat mode here</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        // ──────────────────────────────────────────────────────────
        // CHAT MODE: Split archives sidebar & message thread
        // ──────────────────────────────────────────────────────────
        <div className="col-span-12 h-full pt-16 relative">
          
          {/* Main classic message screen */}
          <div className="w-full flex flex-col justify-between h-full bg-[#100f0d]">
            
            {/* Scrollable messages container */}
            <div className="flex-grow overflow-y-auto p-6 space-y-5 scrollbar-thin scroll-smooth">
              
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center h-full max-w-md mx-auto space-y-4 pt-12">
                  <div className="w-16 h-16 rounded-full border border-[#c9a84c]/20 flex items-center justify-center bg-[#c9a84c]/5">
                    <Sparkles className="w-6 h-6 text-[#c9a84c]" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-serif text-white">Ask Donna anything</h4>
                    <p className="text-xs text-gray-400 font-sans leading-relaxed">
                      "Schedule a 30m debrief tomorrow with Priya Sharma", "Draft an executive summary to my investors", or "What tasks do I have left?"
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg, index) => {
                const isDonna = msg.role === 'model';
                const isCurrentlySpeaking = isDonna && index === messages.length - 1 && blobState === 'speaking';
                const displayContent = isCurrentlySpeaking ? getSpokenText(msg.content, speechCharIndex) : msg.content;
                return (
                  <div 
                    key={msg.id || index}
                    className={`flex space-x-3.5 max-w-full md:max-w-3xl ${isDonna ? 'justify-start mr-auto' : 'justify-end ml-auto'}`}
                  >
                    {isDonna && (
                      <div className="w-8 h-8 rounded-full border border-[#c9a84c]/20 flex items-center justify-center bg-[#c9a84c]/5 shrink-0 mt-0.5">
                        <span className="font-serif text-xs font-normal text-[#c9a84c] pl-0.5">D</span>
                      </div>
                    )}

                    <div className="space-y-1 max-w-[85%]">
                      <div 
                        className={`rounded-2xl px-5 py-3.5 text-[13px] leading-[1.6] font-sans whitespace-pre-wrap ${isDonna ? 'bg-[#c9a84c]/5 border border-[#c9a84c]/10 text-white' : 'bg-white/[0.03] border border-white/[0.04] text-white'}`}
                      >
                        {displayContent}
                      </div>
                      <div className={`text-[10px] font-sans text-gray-500 ${isDonna ? 'text-left pl-1' : 'text-right pr-1'}`}>
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Real-time typing indicators */}
              {isThinking && (
                <div className="flex space-x-3.5 justify-start max-w-sm">
                  <div className="w-8 h-8 rounded-full border border-[#c9a84c]/20 flex items-center justify-center bg-[#c9a84c]/5 shrink-0">
                    <span className="font-serif text-xs text-[#c9a84c] pl-0.5">D</span>
                  </div>
                  <div className="bg-[#c9a84c]/5 border border-[#c9a84c]/10 rounded-2xl py-3.5 px-5 flex items-center space-x-1.5 h-[42px]">
                    <div className="w-1.5 h-1.5 bg-[#c9a84c] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-[#c9a84c] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-[#c9a84c] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Bottom Rounded Chat Entry Panel */}
            <div className="p-4 px-6 bg-[#090807]/50 border-t border-white/[0.04]">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleDonnaResponse(inputValue);
                }}
                className="flex items-center space-x-3 bg-black/40 border border-white/[0.06] focus-within:border-[#c9a84c]/60 rounded-full px-5 py-2"
              >
                <input 
                  id="chat-query-input"
                  type="text"
                  className="bg-transparent border-none text-[13px] font-sans text-white placeholder-gray-500 focus:outline-none w-full py-1.5"
                  placeholder="Direct Donna: 'Send email to Priya', 'Delete task id: 5', 'What is scheduled next week?'..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />

                <div className="flex items-center space-x-2 shrink-0">
                  <button 
                    type="button"
                    onClick={handleClearChat}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition"
                    title="Clear Chat History"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={handleMicTap}
                    className="p-1.5 text-gray-500 hover:text-[#c9a84c] transition"
                    title="Dictate message"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <button 
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-[#c9a84c] hover:bg-[#e0be5a] disabled:bg-white/[0.02] disabled:text-gray-600 text-black transition shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
