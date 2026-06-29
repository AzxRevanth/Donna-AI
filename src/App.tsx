import React, { useState, useEffect } from 'react';
import { 
  loadStoredData, 
  saveStoredData,
  INITIAL_USER_CONTEXT,
  INITIAL_TASKS,
  INITIAL_EVENTS,
  INITIAL_PEOPLE,
  INITIAL_GOALS,
  INITIAL_HABITS,
  INITIAL_EMAILS,
  INITIAL_DONNA_MEMORY,
  INITIAL_CHAT,
  DEMO_USER_CONTEXT,
  DEMO_TASKS,
  DEMO_EVENTS,
  DEMO_PEOPLE,
  DEMO_GOALS,
  DEMO_EMAILS,
  DEMO_DONNA_MEMORY,
  DEMO_CHAT
} from './data';
import { Task, CalendarEvent, Person, Goal, Habit, AppEmail, UserContext, DonnaMemoryFact, ChatMessage } from './types';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { fetchCalendarEvents, fetchTasks, fetchEmails, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './googleApi';
import { getPeople, getGoals, getUserPreferences, saveGoal, savePerson, saveUserPreferences, deletePerson, deleteGoal } from './dbService';
import { mineGmailContacts } from './services/gmailContactMiner';
import { ENV } from './utils/env';

// Importing Views
import LoginView from './components/LoginView';
import OnboardingView from './components/OnboardingView';
import WarRoomView from './components/WarRoomView';
import ChatView from './components/ChatView';
import TasksView from './components/TasksView';
import CalendarView from './components/CalendarView';
import EmailView from './components/EmailView';
import PeopleView from './components/PeopleView';
import GoalsView from './components/GoalsView';
import SettingsView from './components/SettingsView';
import { voiceService } from './services/voiceService';

// Icon library
import { 
  Sparkles, Shield, MessageSquare, CheckSquare, Calendar, Mail, 
  Users, TrendingUp, Sliders, LogOut, Heart, Clock, Menu, X, AlertCircle, Mic,
  ChevronLeft, ChevronRight
} from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [reconnectNeeded, setReconnectNeeded] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<string>(() => loadStoredData('current_view', 'war-room'));
  const [prefilledChatInput, setPrefilledChatInput] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => loadStoredData('sidebar_collapsed', false));

  const handleNavigate = (view: string, initialPrompt?: string) => {
    if (view === 'chat' && initialPrompt) {
      setPrefilledChatInput(initialPrompt);
    }
    setCurrentView(view);
    setMobileMenuOpen(false);
  };
  
  // Responsive sidebar toggles
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cross-view state links
  const [sidebarPrepEvent, setSidebarPrepEvent] = useState<CalendarEvent | null>(null);

  // Master State Synchronizations
  const [userContext, setUserContext] = useState<UserContext>(() => loadStoredData('user_context', INITIAL_USER_CONTEXT));
  const [isOnboarding, setIsOnboarding] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<Task[]>(() => loadStoredData('tasks', INITIAL_TASKS));
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadStoredData('events', INITIAL_EVENTS));
  const [people, setPeople] = useState<Person[]>(() => loadStoredData('people', INITIAL_PEOPLE));
  const [goals, setGoals] = useState<Goal[]>(() => loadStoredData('goals', INITIAL_GOALS));
  const [habits, setHabits] = useState<Habit[]>(() => loadStoredData('habits', INITIAL_HABITS));
  const [emails, setEmails] = useState<AppEmail[]>(() => loadStoredData('emails', INITIAL_EMAILS));
  const [donnaMemory, setDonnaMemory] = useState<DonnaMemoryFact[]>(() => loadStoredData('donna_memory', INITIAL_DONNA_MEMORY));
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => loadStoredData('chat_history', INITIAL_CHAT));

  // Current physical date-time logic
  const [currentTime, setCurrentTime] = useState(new Date());

  const [showEnvBanner, setShowEnvBanner] = useState(() => {
    return ENV === 'preview' && sessionStorage.getItem('donna_env_banner_dismissed') !== 'true';
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    voiceService.initialize().catch(err => {
      console.warn('Failed to initialize voice service on app mount:', err);
    });
    return () => clearInterval(timer);
  }, []);

  const getTopGreeting = () => {
    const hr = currentTime.getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Sync state writes to Local Storage immediately!
  useEffect(() => { 
    saveStoredData('current_view', currentView); 
    voiceService.stopSpeaking();
  }, [currentView]);
  useEffect(() => { saveStoredData('sidebar_collapsed', sidebarCollapsed); }, [sidebarCollapsed]);
  useEffect(() => { saveStoredData('user_context', userContext); }, [userContext]);
  useEffect(() => { saveStoredData('tasks', tasks); }, [tasks]);
  useEffect(() => { saveStoredData('events', events); }, [events]);
  useEffect(() => { saveStoredData('people', people); }, [people]);
  useEffect(() => { saveStoredData('goals', goals); }, [goals]);
  useEffect(() => { saveStoredData('habits', habits); }, [habits]);
  useEffect(() => { saveStoredData('emails', emails); }, [emails]);
  useEffect(() => { saveStoredData('donna_memory', donnaMemory); }, [donnaMemory]);
  useEffect(() => { saveStoredData('chat_history', chatHistory); }, [chatHistory]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
      if (user) {
        setIsAuthenticated(true);
        // Sync user context
        setUserContext(prev => ({
          ...prev,
          name: user.displayName || 'Partner',
          role: 'Partner',
        }));
      } else if (isDemo) {
        setIsAuthenticated(true);
        setUserContext(prev => ({
          ...prev,
          name: localStorage.getItem('donna_user_name') || 'Partner',
          role: 'Partner',
        }));
      } else {
        setIsAuthenticated(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isGmailBlocked, setIsGmailBlocked] = useState<boolean>(false);

  const syncAllGoogleData = async () => {
    if (!auth.currentUser || localStorage.getItem('donna_demo_mode') === 'true') return;
    setIsSyncing(true);
    
    const uid = auth.currentUser.uid;
    const token = localStorage.getItem('donna_access_token');

    const isGmailConnected = userContext.connectedServices 
      ? !!userContext.connectedServices.gmail 
      : !!token;

    const isCalendarConnected = userContext.connectedServices 
      ? !!userContext.connectedServices.calendar 
      : !!token;

    const isTasksConnected = userContext.connectedServices 
      ? !!userContext.connectedServices.tasks 
      : !!token;

    const isPeopleConnected = userContext.connectedServices 
      ? !!userContext.connectedServices.people 
      : !!token;

    // 1. Fetch Calendar
    if (isCalendarConnected && token) {
      const todayStr = new Date();
      todayStr.setHours(0, 0, 0, 0);
      const nextWeekStr = new Date();
      nextWeekStr.setDate(nextWeekStr.getDate() + 7);
      nextWeekStr.setHours(23, 59, 59, 999);
      
      try {
        const googleEvents = await fetchCalendarEvents(todayStr.toISOString(), nextWeekStr.toISOString());
        if (googleEvents && googleEvents.length > 0) {
          const mappedEvents: CalendarEvent[] = googleEvents.map((item: any) => {
            const start = item.start?.dateTime || item.start?.date || '';
            const end = item.end?.dateTime || item.end?.date || '';
            const startDate = start ? new Date(start) : new Date();
            const endDate = end ? new Date(end) : new Date();
            const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
            const startTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            
            return {
              id: item.id,
              title: item.summary || '(No Title)',
              date: start.split('T')[0] || new Date().toISOString().split('T')[0],
              startTime: startTime,
              duration: duration || 30,
              attendees: item.attendees?.map((a: any) => a.displayName || a.email || '') || [],
              description: item.description || '',
              location: item.location || '',
              reminderMinutes: 15,
              recurrence: 'NONE',
              hasConflict: false
            };
          });

          // Compute conflicts
          for (let i = 0; i < mappedEvents.length; i++) {
            const evA = mappedEvents[i];
            const startA = new Date(`${evA.date}T${evA.startTime}`);
            const endA = new Date(startA.getTime() + evA.duration * 60000);
            
            for (let j = 0; j < mappedEvents.length; j++) {
              if (i === j) continue;
              const evB = mappedEvents[j];
              if (evA.date !== evB.date) continue;
              
              const startB = new Date(`${evB.date}T${evB.startTime}`);
              const endB = new Date(startB.getTime() + evB.duration * 60000);
              
              if (startA < endB && endA > startB) {
                evA.hasConflict = true;
                break;
              }
            }
          }
          setEvents(mappedEvents);
        } else {
          const localEvents = loadStoredData('events', INITIAL_EVENTS);
          if (localEvents && localEvents.length > 0) {
            setEvents(localEvents);
          }
        }
      } catch (error: any) {
        console.warn("Failed to fetch Google Calendar, falling back to local calendar:", error);
        const localEvents = loadStoredData('events', INITIAL_EVENTS);
        setEvents(localEvents);
      }
    } else {
      const localEvents = loadStoredData('events', INITIAL_EVENTS);
      setEvents(localEvents);
    }

    // 2. Fetch Tasks
    if (isTasksConnected && token) {
      try {
        const googleTasks = await fetchTasks();
        if (googleTasks && googleTasks.length > 0) {
          const storedTasksMetadata = JSON.parse(localStorage.getItem('donna_tasks_metadata') || '{}');
          const mappedTasks: Task[] = googleTasks.map((item: any) => {
            const id = item.id;
            const meta = storedTasksMetadata[id] || {};
            return {
              id,
              title: item.title || '(Untitled Task)',
              dueDate: item.due ? item.due.split('T')[0] : new Date().toISOString().split('T')[0],
              completed: item.status === 'completed',
              priority: meta.priority || 'NORMAL',
              notes: item.notes || '',
              timeEstimate: meta.timeEstimate || '1.0h',
              donnaNote: meta.donnaNote || 'Pending Donna\'s priority calibration.',
              subtasks: meta.subtasks || [],
              reminderTime: meta.reminderTime || ''
            };
          });
          setTasks(mappedTasks);
        } else {
          const localTasks = loadStoredData('tasks', INITIAL_TASKS);
          if (localTasks && localTasks.length > 0) {
            setTasks(localTasks);
          }
        }
      } catch (error: any) {
        console.warn("Failed to fetch Google Tasks, falling back to local tasks:", error);
        const localTasks = loadStoredData('tasks', INITIAL_TASKS);
        setTasks(localTasks);
      }
    } else {
      const localTasks = loadStoredData('tasks', INITIAL_TASKS);
      setTasks(localTasks);
    }

    // 3. Fetch Emails
    if (isGmailConnected && token) {
      try {
        const googleEmails = await fetchEmails('in:inbox', 15);
        if (googleEmails && googleEmails.length > 0) {
          const storedEmailsMetadata = JSON.parse(localStorage.getItem('donna_emails_metadata') || '{}');
          const mappedEmails: AppEmail[] = googleEmails.map((item: any) => {
            const id = item.id;
            const meta = storedEmailsMetadata[id] || {};
            return {
              id,
              sender: item.sender || 'Unknown',
              senderEmail: item.senderEmail || '',
              subject: item.subject || '(No Subject)',
              time: item.time || '',
              preview: item.preview || '',
              body: item.body || '',
              isPriority: item.isPriority || false,
              donnaLabel: meta.donnaLabel || 'Inbox'
            };
          });
          setEmails(mappedEmails);
        }
      } catch (error: any) {
        console.warn("Failed to fetch Gmail inbox:", error);
      }
    } else {
      setEmails([]);
    }

    // 4. Extract and sync contacts from Gmail
    if (isPeopleConnected && token && !isGmailBlocked) {
      try {
        await syncPeopleFromGmail(token);
      } catch (err) {
        console.error("Failed background Gmail contacts sync:", err);
      }
    } else {
      const fsPeople = await getPeople(uid);
      setPeople(fsPeople);
    }

    setIsSyncing(false);
  };

  const syncPeopleFromGmail = async (token: string) => {
    if (!auth.currentUser || localStorage.getItem('donna_demo_mode') === 'true') return;
    try {
      const uid = auth.currentUser.uid;
      // Get current Firestore people
      const fsPeople = await getPeople(uid);
      
      // Update local state with whatever Firestore has immediately
      if (fsPeople && fsPeople.length > 0) {
        setPeople(fsPeople);
      }

      const isIframe = window !== window.top;
      if (isIframe) {
        console.warn("Gmail sync is simulated in preview iframe");
        return;
      }

      console.log("Donna is extracting contacts from Gmail headers in the background...");
      await mineGmailContacts(token, uid);

      const updatedPeople = await getPeople(uid);
      if (updatedPeople && updatedPeople.length > 0) {
        setPeople(updatedPeople);
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      if (errMsg.includes('NetworkError') || 
          errMsg.includes('Failed to fetch') || 
          errMsg.includes('CORS') ||
          errMsg.toLowerCase().includes('network error')) {
        console.warn('Gmail contact sync blocked in preview — will work when deployed or run locally');
        setIsGmailBlocked(true);
      } else {
        console.error("Error syncing contacts from Gmail:", err);
      }
    }
  };

  const handleUpdateEvents = async (newEvents: CalendarEvent[]) => {
    // 1. Update the local state first for instant UI response
    setEvents(newEvents);

    const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
    const token = localStorage.getItem('donna_access_token');
    if (isDemo || !token) {
      return;
    }

    // 2. Diff local state change against Google Calendar API
    const added = newEvents.filter(ne => !events.some(oe => oe.id === ne.id));
    const deleted = events.filter(oe => !newEvents.some(ne => ne.id === oe.id));
    const modified = newEvents.filter(ne => {
      const matched = events.find(oe => oe.id === ne.id);
      if (!matched) return false;
      return matched.title !== ne.title ||
             matched.date !== ne.date ||
             matched.startTime !== ne.startTime ||
             matched.duration !== ne.duration ||
             matched.description !== ne.description;
    });

    // Additions sync
    for (const event of added) {
      try {
        const startDT = new Date(`${event.date}T${event.startTime}:00`).toISOString();
        const endDT = new Date(new Date(`${event.date}T${event.startTime}:00`).getTime() + event.duration * 60 * 1000).toISOString();
        const created = await createCalendarEvent(event.title, event.description || '', startDT, endDT);
        if (created && created.id) {
          // Update the locally stored ID to the Google API's official ID
          setEvents(prev => prev.map(e => e.id === event.id ? { ...e, id: created.id } : e));
        }
      } catch (err) {
        console.error("Error syncing added event to Google Calendar:", err);
      }
    }

    // Modifications sync
    for (const event of modified) {
      try {
        if (!event.id.startsWith('evt-') && !event.id.startsWith('evt-focus-')) {
          const startDT = new Date(`${event.date}T${event.startTime}:00`).toISOString();
          const endDT = new Date(new Date(`${event.date}T${event.startTime}:00`).getTime() + event.duration * 60 * 1000).toISOString();
          await updateCalendarEvent(event.id, event.title, event.description || '', startDT, endDT);
        }
      } catch (err) {
        console.error("Error syncing modified event to Google Calendar:", err);
      }
    }

    // Deletions sync
    for (const event of deleted) {
      try {
        if (!event.id.startsWith('evt-') && !event.id.startsWith('evt-focus-')) {
          await deleteCalendarEvent(event.id);
        }
      } catch (err) {
        console.error("Error syncing deleted event from Google Calendar:", err);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      syncAllGoogleData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const fetchFirestoreData = async () => {
      if (localStorage.getItem('donna_demo_mode') === 'true') return;
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      
      try {
        // Fetch preferences
        const prefs = await getUserPreferences(uid);
        if (prefs) {
          setUserContext(prev => ({ ...prev, ...prefs }));
        }
        
        // Fetch goals
        const fsGoals = await getGoals(uid);
        if (fsGoals && fsGoals.length > 0) {
          setGoals(fsGoals);
        } else {
          // If Firestore is empty, seed it with initial goals!
          for (const g of INITIAL_GOALS) {
            await saveGoal(uid, g);
          }
          setGoals(INITIAL_GOALS);
        }
        
        // Fetch people
        const fsPeople = await getPeople(uid);
        if (fsPeople && fsPeople.length > 0) {
          setPeople(fsPeople);
        } else {
          // If Firestore is empty, seed it with initial people!
          for (const p of INITIAL_PEOPLE) {
            await savePerson(uid, p);
          }
          setPeople(INITIAL_PEOPLE);
        }
      } catch (err) {
        console.error("Error loading Firestore data:", err);
      }
    };
    
    if (isAuthenticated) {
      fetchFirestoreData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && localStorage.getItem('donna_demo_mode') === 'true') {
      const demoUserContext = loadStoredData('user_context', DEMO_USER_CONTEXT);
      const demoTasks = loadStoredData('tasks', DEMO_TASKS);
      const demoEvents = loadStoredData('events', DEMO_EVENTS);
      const demoPeople = loadStoredData('people', DEMO_PEOPLE);
      const demoGoals = loadStoredData('goals', DEMO_GOALS);
      const demoEmails = loadStoredData('emails', DEMO_EMAILS);
      const demoDonnaMemory = loadStoredData('donna_memory', DEMO_DONNA_MEMORY);
      const demoChat = loadStoredData('chat_history', DEMO_CHAT);

      setUserContext(demoUserContext);
      setTasks(demoTasks);
      setEvents(demoEvents);
      setPeople(demoPeople);
      setGoals(demoGoals);
      setEmails(demoEmails);
      setDonnaMemory(demoDonnaMemory);
      setChatHistory(demoChat);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isAuthenticated) {
        setIsOnboarding(null);
        return;
      }

      if (localStorage.getItem('donna_demo_mode') === 'true') {
        setIsOnboarding(false);
        return;
      }

      const uid = auth.currentUser?.uid;
      if (!uid) {
        setIsOnboarding(false);
        return;
      }

      try {
        const prefs = await getUserPreferences(uid);
        if (prefs && prefs.onboardingComplete === true) {
          setIsOnboarding(false);
        } else {
          setIsOnboarding(true);
        }
      } catch (err) {
        console.error("Error checking onboarding status:", err);
        setIsOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [isAuthenticated]);

  const handleOnboardingComplete = (data: any) => {
    const updated = { ...userContext, ...data };
    setUserContext(updated);
    setIsOnboarding(false);
    setCurrentView('war-room');
    
    // Save preferences to Firestore on onboarding complete
    const uid = auth.currentUser?.uid;
    const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
    if (uid && !isDemo) {
      saveUserPreferences(uid, updated);
    }
  };

  const handleUpdateTasks = async (newTasks: Task[]) => {
    setTasks(newTasks);

    const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
    if (isDemo) return;

    // Google Sync if connected
    const token = localStorage.getItem('donna_access_token');
    const isTasksConnected = userContext.connectedServices 
      ? !!userContext.connectedServices.tasks 
      : !!token;

    if (isTasksConnected && token) {
      // Save metadata to make sure priority & Donna reasoning is persisted for Google tasks
      const metadata: any = {};
      newTasks.forEach(t => {
        metadata[t.id] = {
          priority: t.priority,
          timeEstimate: t.timeEstimate,
          donnaNote: t.donnaNote,
          subtasks: t.subtasks,
          reminderTime: t.reminderTime
        };
      });
      localStorage.setItem('donna_tasks_metadata', JSON.stringify(metadata));
    }
  };

  const handleUpdateGoals = async (newGoals: Goal[]) => {
    setGoals(newGoals);
    
    const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
    if (isDemo) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const added = newGoals.filter(ng => !goals.some(og => og.id === ng.id));
    const deleted = goals.filter(og => !newGoals.some(ng => ng.id === og.id));
    const modified = newGoals.filter(ng => {
      const matched = goals.find(og => og.id === ng.id);
      if (!matched) return false;
      return matched.title !== ng.title ||
             matched.category !== ng.category ||
             matched.weeklyTarget !== ng.weeklyTarget ||
             matched.currentStreak !== ng.currentStreak ||
             matched.weeklyCompletion !== ng.weeklyCompletion ||
             matched.targetNum !== ng.targetNum;
    });

    for (const goal of added) {
      await saveGoal(uid, goal);
    }
    for (const goal of modified) {
      await saveGoal(uid, goal);
    }
    for (const goal of deleted) {
      await deleteGoal(uid, goal.id);
    }
  };

  const handleUpdateHabits = async (newHabits: Habit[]) => {
    setHabits(newHabits);
  };

  const handleUpdateUserContext = async (newContext: UserContext) => {
    setUserContext(newContext);
    const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
    if (isDemo) return;

    const uid = auth.currentUser?.uid;
    if (uid) {
      await saveUserPreferences(uid, newContext);
    }
  };

  const handleUpdatePeople = async (newPeople: Person[]) => {
    setPeople(newPeople);

    const isDemo = localStorage.getItem('donna_demo_mode') === 'true';
    if (isDemo) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const added = newPeople.filter(np => !people.some(op => op.id === np.id));
    const deleted = people.filter(op => !newPeople.some(np => np.id === op.id));
    const modified = newPeople.filter(np => {
      const matched = people.find(op => op.id === np.id);
      if (!matched) return false;
      return matched.name !== np.name ||
             matched.email !== np.email ||
             matched.company !== np.company ||
             matched.role !== np.role ||
             matched.relationship !== np.relationship ||
             matched.lastInteraction !== np.lastInteraction ||
             matched.notes !== np.notes ||
             JSON.stringify(matched.thingsToRemember) !== JSON.stringify(np.thingsToRemember) ||
             matched.source !== np.source;
    });

    for (const person of added) {
      await savePerson(uid, person);
    }
    for (const person of modified) {
      await savePerson(uid, person);
    }
    for (const person of deleted) {
      await deletePerson(uid, person.id);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setCurrentView('war-room');
    // Clear chat history, briefs, and stored greetings on login so she greets fresh
    localStorage.removeItem('donna_chat_history');
    localStorage.removeItem('donna_demo_chat_history');
    localStorage.removeItem('donna_brief_date');
    localStorage.removeItem('donna_brief_text');
    localStorage.removeItem('donna_ranked_at');
    localStorage.removeItem('donna_ranked_tasks');
    localStorage.removeItem('donna_ranked_task_ids');
    localStorage.removeItem('donna_tasks_metadata');
    sessionStorage.removeItem('donna_greeting');
    sessionStorage.removeItem('donna_conversation_history');
    // Force a fresh reload so that React state loads strictly from clean localStorage keys
    window.location.reload();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error", e);
    }
    setIsAuthenticated(false);
    setMobileMenuOpen(false);
    localStorage.removeItem('donna_demo_mode');
    localStorage.removeItem('donna_access_token');
    localStorage.removeItem('donna_user_name');
    localStorage.removeItem('donna_user_email');
    localStorage.removeItem('donna_user_photo');
    localStorage.removeItem('donna_user_uid');
    
    // Wipe shared legacy keys
    localStorage.removeItem('donna_chat_history');
    localStorage.removeItem('donna_demo_chat_history');
    localStorage.removeItem('donna_brief_date');
    localStorage.removeItem('donna_brief_text');
    localStorage.removeItem('donna_ranked_at');
    localStorage.removeItem('donna_ranked_tasks');
    localStorage.removeItem('donna_ranked_task_ids');
    localStorage.removeItem('donna_tasks_metadata');
    
    sessionStorage.clear();
    // Force a clean reload to wipe out memory of any private user data
    window.location.reload();
  };

  const handleNavigateWithPrep = (view: string, ev: CalendarEvent) => {
    setSidebarPrepEvent(ev);
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  const menuItems = [
    { id: 'war-room', label: 'Office', icon: Shield },
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: true },
    { id: 'tasks', label: 'Priority Stack', icon: CheckSquare },
    { id: 'calendar', label: 'Executive Calendar', icon: Calendar },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'people', label: 'People Intel', icon: Users },
    { id: 'goals', label: 'Goals', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  // If checking authentication state, show centered animated gold D logo
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border border-[#c9a84c]/30 flex items-center justify-center bg-[#161616] shadow-2xl relative">
          <div className="absolute inset-0.5 rounded-full border border-dashed border-[#c9a84c]/30 animate-spin" />
          <span className="font-serif text-3xl font-bold tracking-normal text-[#c9a84c] pl-0.5 select-none">D</span>
        </div>
      </div>
    );
  }

  // If not signed in, show visual credentials page!
  if (!isAuthenticated) {
    return <LoginView onLogin={handleLoginSuccess} />;
  }

  // If signed in, but we are checking onboarding state, show loading spinner
  if (isOnboarding === null && isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border border-[#c9a84c]/30 flex items-center justify-center bg-[#161616] shadow-2xl relative">
          <div className="absolute inset-0.5 rounded-full border border-dashed border-[#c9a84c]/30 animate-spin" />
          <span className="font-serif text-3xl font-bold tracking-normal text-[#c9a84c] pl-0.5 select-none">D</span>
        </div>
      </div>
    );
  }

  // If signed in and needs onboarding, render Onboarding flow full-screen
  if (isOnboarding === true && isAuthenticated) {
    return <OnboardingView onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#f0ebe0] font-sans antialiased flex flex-col md:flex-row">
      
      {/* MOBILE HEADER RIBBON */}
      <div className="md:hidden bg-[#111111] border-b border-[#2a2a2a] p-4 flex items-center justify-between z-40 select-none">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded border border-[#c9a84c] flex items-center justify-center bg-[#1a1810]">
            <span className="font-serif text-xs font-bold text-[#c9a84c] pl-0.5">D</span>
          </div>
          <span className="font-serif font-bold tracking-wide text-sm text-[#f0ebe0]">Donna</span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[10px] font-mono text-[#c9a84c]">
            {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </span>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="p-1 text-neutral-400 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* PERSISTENT EXECUTIVE NAVIGATION SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 ${sidebarCollapsed ? 'md:w-[76px]' : 'md:w-[260px]'} w-[260px] bg-[#0c0c0c]/95 backdrop-blur-[40px] shadow-[1px_0_0_0_rgba(255,255,255,0.04)] flex flex-col justify-between z-30 transition-all duration-300 transform md:translate-x-0 md:static md:h-screen shrink-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="space-y-6">
          
          {/* Main Crest Logo - Match Bold Typography Theme */}
          <div className={`p-6 pb-2 select-none flex items-center justify-between ${sidebarCollapsed ? 'px-4' : 'px-6'}`}>
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse-slow"></span>
              {!sidebarCollapsed && (
                <h1 className="font-serif text-[22px] font-bold text-[#c9a84c] tracking-normal">Donna</h1>
              )}
            </div>
            
            {/* Collapse Toggle Button (Visible on Desktop) */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/[0.04] text-[#4a4540] hover:text-[#c9a84c] transition active:scale-95 cursor-pointer border-none"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 stroke-[1.5]" />
              ) : (
                <ChevronLeft className="w-4 h-4 stroke-[1.5]" />
              )}
            </button>
          </div>

          {/* Nav List */}
          <nav className="space-y-1 px-3 select-none">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleNavigate(item.id);
                    if (item.id !== 'calendar') {
                      setSidebarPrepEvent(null); // Clear drawer links
                    }
                  }}
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-5'} h-10 rounded-lg text-[13px] font-sans tracking-normal transition-all duration-200 active:scale-[0.97] cursor-pointer relative ${isActive ? 'bg-[#c9a84c]/8 text-[#c9a84c] font-medium' : 'hover:bg-white/[0.04] text-[#4a4540] hover:text-[#8a8070]'}`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className={`flex items-center ${sidebarCollapsed ? 'space-x-0' : 'space-x-3'}`}>
                    <Icon className="w-4 h-4 shrink-0 stroke-[1.5]" />
                    {!sidebarCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                  </span>

                  {!sidebarCollapsed && item.badge && item.id === 'chat' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse-slow" />
                  )}
                  {sidebarCollapsed && item.badge && item.id === 'chat' && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse-slow" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* LOGOUT & USER PROFILE SPOT */}
        <div className={`p-4 border-t border-white/[0.04] flex ${sidebarCollapsed ? 'flex-col items-center space-y-3' : 'items-center justify-between'} select-none transition-all duration-300`}>
          <div 
            className="w-8 h-8 rounded-full overflow-hidden border border-[#c9a84c]/20 flex items-center justify-center text-xs font-semibold cursor-help active:scale-[0.97] transition-all duration-200 shrink-0 bg-[#c9a84c]/10 text-[#c9a84c]"
            title={`${userContext.name} - Partner`}
          >
            {auth.currentUser?.photoURL ? (
              <img src={auth.currentUser.photoURL} alt="User Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              userContext.name.split(' ').map(n => n[0]).join('')
            )}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-[#4a4540] hover:text-red-400/80 active:scale-[0.97] transition-all duration-200 cursor-pointer shrink-0"
            title="Logout"
          >
            <LogOut className="w-4 h-4 stroke-[1.5] shrink-0" />
          </button>
        </div>
      </aside>

      {/* MAIN SHELL BODY & HEADER CONTROL PANEL */}
      <main className="flex-grow flex flex-col min-w-0 h-screen overflow-y-auto">
        
        {reconnectNeeded && (
          <div className="bg-[#ebd083]/10 border-b border-[#c9a84c]/20 px-8 py-3 flex items-center justify-between text-xs text-[#ebd083] font-sans">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-[#c9a84c] shrink-0" />
              <span>Donna needs to reconnect to your Google services.</span>
            </div>
            <button 
              onClick={handleLogout}
              className="underline font-medium text-[#c9a84c] hover:text-[#e0be5a] transition cursor-pointer"
            >
              Reconnect →
            </button>
          </div>
        )}
        
        {/* TOP COGNITIVE HEADER PANEL */}
        <header className="h-20 border-b border-white/[0.04] bg-[#0c0c0c]/70 backdrop-blur-[40px] select-none flex items-center">
          <div className="max-w-7xl w-full mx-auto px-8 md:px-12 flex items-center justify-between">
            <h2 className="font-serif text-[20px] italic text-[#f0ebe0] tracking-wide select-none">
              {getTopGreeting()}, {userContext.name.split(' ')[0]}.
            </h2>
            <div className="flex items-center space-x-8 md:space-x-10">
              <span className="text-xs font-sans font-light text-[#4a4540] hidden sm:block tracking-wide">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
              
              <div className="flex items-center space-x-2 text-xs font-sans font-light text-[#4a4540] tracking-wide">
                <Clock className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" />
                <span>{currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}</span>
              </div>
            </div>
          </div>
        </header>

        {/* PRIMARY COMPONENT ROUTER VIEWPORTS */}
        <div className="p-6 md:p-8 max-w-7xl w-full mx-auto pb-16 flex-grow">
          {currentView === 'war-room' && (
            <div key="war-room" className="animate-fade-in w-full h-full">
              <WarRoomView 
                userContext={userContext}
                tasks={tasks}
                onUpdateTasks={handleUpdateTasks}
                events={events}
                onUpdateEvents={handleUpdateEvents}
                emails={emails}
                goals={goals}
                people={people}
                onNavigate={handleNavigate}
                onTriggerMeetingPrep={(ev) => handleNavigateWithPrep('calendar', ev)}
                onQuickAddFocusBlock={() => {
                  const focusEvent: CalendarEvent = {
                    id: `evt-focus-${Date.now()}`,
                    title: "🛡️ Donna Protected Deep Focus Time",
                    date: new Date().toISOString().split('T')[0],
                    startTime: '10:00',
                    duration: 120,
                    attendees: [],
                    description: "Reserved block protected from any calendar requests."
                  };
                  handleUpdateEvents([...events, focusEvent]);
                }}
              />
            </div>
          )}

          {currentView === 'chat' && (
            <div key="chat" className="animate-fade-in w-full h-full">
              <ChatView 
                userContext={userContext}
                donnaMemory={donnaMemory}
                chatHistory={chatHistory}
                onUpdateChat={setChatHistory}
                tasks={tasks}
                onUpdateTasks={handleUpdateTasks}
                events={events}
                onUpdateEvents={handleUpdateEvents}
                emails={emails}
                people={people}
                prefilledChatInput={prefilledChatInput}
                onClearPrefilledChatInput={() => setPrefilledChatInput('')}
              />
            </div>
          )}

          {currentView === 'tasks' && (
            <div key="tasks" className="animate-fade-in w-full h-full">
              <TasksView 
                userContext={userContext}
                tasks={tasks}
                onUpdateTasks={handleUpdateTasks}
                onNavigate={handleNavigate}
              />
            </div>
          )}

          {currentView === 'calendar' && (
            <div key="calendar" className="animate-fade-in w-full h-full">
              <CalendarView 
                userContext={userContext}
                events={events}
                people={people}
                onUpdateEvents={handleUpdateEvents}
                onNavigate={setCurrentView}
                selectedPrepEvent={sidebarPrepEvent}
                onClearSelectedPrep={() => setSidebarPrepEvent(null)}
              />
            </div>
          )}

          {currentView === 'email' && (
            <div key="email" className="animate-fade-in w-full h-full">
              <EmailView 
                userContext={userContext}
                emails={emails}
                followUps={[{ id: 'fl-1', recipient: 'Arjun Mehta', subject: 'Rate alignment outline proposal', daysWaiting: 3, lastSentDate: 'Last Friday' }]}
                onUpdateEmails={setEmails}
                onUpdateFollowUps={() => {}}
                isGmailBlocked={isGmailBlocked}
              />
            </div>
          )}

          {currentView === 'people' && (
            <div key="people" className="animate-fade-in w-full h-full">
              <PeopleView 
                people={people}
                onUpdatePeople={handleUpdatePeople}
              />
            </div>
          )}

          {currentView === 'goals' && (
            <div key="goals" className="animate-fade-in w-full h-full">
              <GoalsView 
                userContext={userContext}
                goals={goals}
                habits={habits}
                onUpdateGoals={handleUpdateGoals}
                onUpdateHabits={handleUpdateHabits}
                onUpdateUserContext={handleUpdateUserContext}
              />
            </div>
          )}

          {currentView === 'settings' && (
            <div key="settings" className="animate-fade-in w-full h-full">
              <SettingsView 
                userContext={userContext}
                donnaMemory={donnaMemory}
                onUpdateUserContext={handleUpdateUserContext}
                onUpdateDonnaMemory={setDonnaMemory}
              />
            </div>
          )}
        </div>

        {/* Environment banner for iframe preview */}
        {showEnvBanner && (
          <div className="mx-8 md:mx-12 mb-6 p-3 bg-[#c9a84c]/5 border border-[#c9a84c]/30 rounded-xl flex items-center justify-between gap-4 animate-fade-in select-none">
            <div className="flex items-center space-x-2 text-[#ebd083] font-sans text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse shrink-0" />
              <span>Preview mode — voice input and Google API sync activate when running locally or deployed.</span>
            </div>
            <button 
              onClick={() => {
                sessionStorage.setItem('donna_env_banner_dismissed', 'true');
                setShowEnvBanner(false);
              }}
              className="text-[#8a8070] hover:text-[#f0ebe0] transition text-xs font-sans cursor-pointer h-5 w-5 flex items-center justify-center rounded-full hover:bg-white/[0.04]"
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        )}

      </main>

    </div>
  );
}
