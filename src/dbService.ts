import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { Person, Goal, UserContext, CalendarEvent, Task, Habit } from './types';

// Helper to construct references
export const getUserDocRef = (uid: string) => doc(db, 'users', uid);
export const getPreferencesDocRef = (uid: string) => doc(db, 'users', uid, 'preferences', 'settings');
export const getPeopleCollectionRef = (uid: string) => collection(db, 'users', uid, 'people');
export const getGoalsCollectionRef = (uid: string) => collection(db, 'users', uid, 'goals');

// ---------------------------------------------
// User Preferences
// ---------------------------------------------
export async function saveUserPreferences(uid: string, preferences: Partial<UserContext>) {
  const path = `users/${uid}/preferences/settings`;
  try {
    const docRef = getPreferencesDocRef(uid);
    await setDoc(docRef, preferences, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getUserPreferences(uid: string): Promise<Partial<UserContext> | null> {
  const path = `users/${uid}/preferences/settings`;
  try {
    const docRef = getPreferencesDocRef(uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Partial<UserContext>;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

// ---------------------------------------------
// People Intelligence
// ---------------------------------------------
export async function getPeople(uid: string): Promise<Person[]> {
  const path = `users/${uid}/people`;
  try {
    const collRef = getPeopleCollectionRef(uid);
    const snap = await getDocs(collRef);
    const list: Person[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as Person);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function savePerson(uid: string, person: Person) {
  const path = `users/${uid}/people/${person.id}`;
  try {
    const docRef = doc(db, 'users', uid, 'people', person.id);
    await setDoc(docRef, person, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePerson(uid: string, personId: string) {
  const path = `users/${uid}/people/${personId}`;
  try {
    const docRef = doc(db, 'users', uid, 'people', personId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------
// Goals Tracking
// ---------------------------------------------
export async function getGoals(uid: string): Promise<Goal[]> {
  const path = `users/${uid}/goals`;
  try {
    const collRef = getGoalsCollectionRef(uid);
    const snap = await getDocs(collRef);
    const list: Goal[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as Goal);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveGoal(uid: string, goal: Goal) {
  const path = `users/${uid}/goals/${goal.id}`;
  try {
    const docRef = doc(db, 'users', uid, 'goals', goal.id);
    await setDoc(docRef, goal, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteGoal(uid: string, goalId: string) {
  const path = `users/${uid}/goals/${goalId}`;
  try {
    const docRef = doc(db, 'users', uid, 'goals', goalId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------
// Calendar Events
// ---------------------------------------------
export async function getCalendarEvents(uid: string): Promise<CalendarEvent[]> {
  const path = `users/${uid}/events`;
  try {
    const collRef = collection(db, 'users', uid, 'events');
    const snap = await getDocs(collRef);
    const list: CalendarEvent[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as CalendarEvent);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveCalendarEvent(uid: string, event: CalendarEvent) {
  const path = `users/${uid}/events/${event.id}`;
  try {
    const docRef = doc(db, 'users', uid, 'events', event.id);
    await setDoc(docRef, event, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCalendarEvent(uid: string, eventId: string) {
  const path = `users/${uid}/events/${eventId}`;
  try {
    const docRef = doc(db, 'users', uid, 'events', eventId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------
// Tasks Tracking
// ---------------------------------------------
export async function getTasks(uid: string): Promise<Task[]> {
  const path = `users/${uid}/tasks`;
  try {
    const collRef = collection(db, 'users', uid, 'tasks');
    const snap = await getDocs(collRef);
    const list: Task[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as Task);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveTask(uid: string, task: Task) {
  const path = `users/${uid}/tasks/${task.id}`;
  try {
    const docRef = doc(db, 'users', uid, 'tasks', task.id);
    await setDoc(docRef, task, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTask(uid: string, taskId: string) {
  const path = `users/${uid}/tasks/${taskId}`;
  try {
    const docRef = doc(db, 'users', uid, 'tasks', taskId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------
// Habits Tracker
// ---------------------------------------------
export async function getHabits(uid: string): Promise<Habit[]> {
  const path = `users/${uid}/habits`;
  try {
    const collRef = collection(db, 'users', uid, 'habits');
    const snap = await getDocs(collRef);
    const list: Habit[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as Habit);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveHabit(uid: string, habit: Habit) {
  const path = `users/${uid}/habits/${habit.id}`;
  try {
    const docRef = doc(db, 'users', uid, 'habits', habit.id);
    await setDoc(docRef, habit, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteHabit(uid: string, habitId: string) {
  const path = `users/${uid}/habits/${habitId}`;
  try {
    const docRef = doc(db, 'users', uid, 'habits', habitId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
