import { auth } from '../firebase';
import { getPeople, savePerson, saveUserPreferences } from '../dbService';
import { Person } from '../types';
import { parseEmailHeader } from './people';
import { analyzePerson } from './peopleIntelligence';

interface ContactScore {
  email: string;
  name: string;
  sentCount: number;
  receivedCount: number;
  replyCount: number;
  recentActivity: Date;
  subjectLines: string[];
  importanceScore: number;
}

// Noise filter for email addresses
function isNoise(email: string): boolean {
  const noisePrefixes = [
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'notifications', 'notification', 'alerts', 'alert',
    'support', 'help', 'info', 'contact', 'admin',
    'mailer', 'bounce', 'postmaster', 'newsletter',
    'billing', 'invoice', 'receipts', 'orders',
    'security', 'accounts', 'verify', 'confirm',
    'updates', 'team', 'hello', 'hi', 'welcome'
  ];
  const local = email.split('@')[0].toLowerCase();
  const isNumeric = /^\d+$/.test(local);
  const isNoiseName = noisePrefixes.some(p => local.includes(p));
  return isNumeric || isNoiseName;
}

// Fetch message IDs based on a Gmail search query
async function fetchMessageIds(accessToken: string, query: string, maxResults: number = 200): Promise<string[]> {
  const url = `https://gmail.googleapis.com/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    console.error(`Gmail list messages response error for query "${query}": ${res.status}`);
    return [];
  }
  const data = await res.json();
  const messages = data.messages || [];
  return messages.map((m: any) => m.id).filter(Boolean);
}

// Fetch metadata headers for a specific message ID
async function fetchMessageMetadata(id: string, accessToken: string): Promise<any> {
  const url = `https://gmail.googleapis.com/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date&metadataHeaders=Subject`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Error fetching metadata for message ${id}:`, err);
    return null;
  }
}

// The main Gmail contact mining function
export async function mineGmailContacts(
  accessToken: string,
  uid: string,
  onProgress?: (msg: string) => void
): Promise<{ foundCount: number; addedCount: number }> {
  const isIframe = window !== window.top;
  if (isIframe) {
    onProgress?.("Gmail sync available when running in your browser. Your contacts will load automatically on deployment.");
    return { foundCount: 0, addedCount: 0 };
  }

  if (!accessToken) {
    throw new Error("No Google access token provided for contact mining.");
  }

  const userEmail = auth.currentUser?.email?.toLowerCase() || localStorage.getItem('donna_user_email')?.toLowerCase() || '';
  if (!userEmail) {
    throw new Error("User email not found. Cannot filter user out of mined contacts.");
  }

  onProgress?.("Donna is listing recent Gmail threads...");

  // 1 & 2. Fetch sent and received message IDs
  const sentIds = await fetchMessageIds(accessToken, 'in:sent newer_than:60d', 200);
  const receivedIds = await fetchMessageIds(accessToken, 'in:inbox is:read newer_than:60d', 200);
  const allIds = Array.from(new Set([...sentIds, ...receivedIds]));

  if (allIds.length === 0) {
    onProgress?.("No recent correspondence found in your inbox or sent folders.");
    return { foundCount: 0, addedCount: 0 };
  }

  onProgress?.(`Donna found ${allIds.length} recent messages to scan. Reading headers...`);

  // 3. Fetch metadata in batches of 15 with 300ms delay
  const fetchedMessages: any[] = [];
  const batchSize = 15;
  for (let i = 0; i < allIds.length; i += batchSize) {
    const batch = allIds.slice(i, i + batchSize);
    onProgress?.(`Donna is reading messages ${i + 1} to ${Math.min(i + batchSize, allIds.length)} of ${allIds.length}...`);
    
    const results = await Promise.all(
      batch.map(id => fetchMessageMetadata(id, accessToken))
    );
    fetchedMessages.push(...results.filter(Boolean));

    if (i + batchSize < allIds.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  onProgress?.("Analyzing email headers & relationships...");

  // 4 & 5. Accumulate contact metadata and scores
  const scoresMap = new Map<string, ContactScore>();

  for (const msg of fetchedMessages) {
    if (!msg || !msg.payload || !msg.payload.headers) continue;
    const headers = msg.payload.headers as Array<{ name: string; value: string }>;
    const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    const toHeader = headers.find(h => h.name.toLowerCase() === 'to')?.value || '';
    const ccHeader = headers.find(h => h.name.toLowerCase() === 'cc')?.value || '';
    const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

    const date = dateHeader ? new Date(dateHeader) : new Date();

    const fromParsed = parseEmailHeader(fromHeader);
    const toParsed = parseEmailHeader(toHeader);
    const ccParsed = parseEmailHeader(ccHeader);

    const isSentByMe = fromParsed.some(p => p.email.toLowerCase() === userEmail);

    if (isSentByMe) {
      const recipients = [...toParsed, ...ccParsed];
      const isReply = subjectHeader.toLowerCase().startsWith('re:');
      
      for (const r of recipients) {
        const email = r.email.toLowerCase();
        if (email === userEmail || !email) continue;
        
        let entry = scoresMap.get(email);
        if (!entry) {
          entry = {
            email,
            name: r.name || email.split('@')[0],
            sentCount: 0,
            receivedCount: 0,
            replyCount: 0,
            recentActivity: date,
            subjectLines: [],
            importanceScore: 0
          };
          scoresMap.set(email, entry);
        }
        
        entry.sentCount++;
        if (isReply) {
          entry.replyCount++;
        }
        if (date > entry.recentActivity) {
          entry.recentActivity = date;
        }
        if (subjectHeader && !entry.subjectLines.includes(subjectHeader)) {
          entry.subjectLines.push(subjectHeader);
          if (entry.subjectLines.length > 5) {
            entry.subjectLines.shift();
          }
        }
        if (r.name && (!entry.name || entry.name === email.split('@')[0])) {
          entry.name = r.name;
        }
      }
    } else {
      for (const f of fromParsed) {
        const email = f.email.toLowerCase();
        if (email === userEmail || !email) continue;
        
        let entry = scoresMap.get(email);
        if (!entry) {
          entry = {
            email,
            name: f.name || email.split('@')[0],
            sentCount: 0,
            receivedCount: 0,
            replyCount: 0,
            recentActivity: date,
            subjectLines: [],
            importanceScore: 0
          };
          scoresMap.set(email, entry);
        }
        
        entry.receivedCount++;
        if (date > entry.recentActivity) {
          entry.recentActivity = date;
        }
        if (subjectHeader && !entry.subjectLines.includes(subjectHeader)) {
          entry.subjectLines.push(subjectHeader);
          if (entry.subjectLines.length > 5) {
            entry.subjectLines.shift();
          }
        }
        if (f.name && (!entry.name || entry.name === email.split('@')[0])) {
          entry.name = f.name;
        }
      }
    }
  }

  // Calculate scores and filter noise
  const nowMs = Date.now();
  const filteredContacts: ContactScore[] = [];

  for (const [email, entry] of scoresMap.entries()) {
    if (isNoise(email)) continue;

    const diffTime = Math.abs(nowMs - entry.recentActivity.getTime());
    const daysSinceActivity = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let score = (entry.sentCount * 3)
              + (entry.replyCount * 2)
              + (entry.receivedCount * 1);

    if (daysSinceActivity < 7) {
      score += 10;
    }
    if (daysSinceActivity < 30) {
      score += 5;
    }
    if (daysSinceActivity > 50) {
      score -= 5;
    }

    entry.importanceScore = score;
    filteredContacts.push(entry);
  }

  // 7. Get top 50 contacts
  const topContacts = filteredContacts
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, 50);

  onProgress?.(`Donna is saving newly discovered stakeholders to security storage...`);

  // 8. Merge and save to Firestore
  const existingPeople = await getPeople(uid);
  let addedCount = 0;
  const newlyAddedPeople: Person[] = [];

  for (const contact of topContacts) {
    const existing = existingPeople.find(p => p.email?.toLowerCase() === contact.email.toLowerCase());

    if (existing) {
      // Update existing if we have better info
      const updatedPerson: Person = {
        ...existing,
        name: (contact.name && contact.name !== contact.email.split('@')[0]) ? contact.name : existing.name,
        lastInteraction: contact.recentActivity.toISOString().split('T')[0],
        // Set Firestore dual compatibility properties
        ...({
          lastInteractionISO: contact.recentActivity.toISOString(),
          importanceScore: contact.importanceScore,
          emailFrequency: contact.sentCount + contact.receivedCount,
          recentSubjects: contact.subjectLines,
          updatedAt: new Date().toISOString()
        } as any)
      };
      await savePerson(uid, updatedPerson);
    } else {
      // Create new Person
      const newPerson: Person = {
        id: `p-gmail-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: contact.name,
        role: '',
        company: '',
        relationship: 'Colleague',
        lastInteraction: contact.recentActivity.toISOString().split('T')[0],
        notes: '',
        thingsToRemember: ["Contact auto-detected from recent email correspondence."],
        email: contact.email,
        source: 'gmail',
        // Set Firestore dual compatibility properties
        ...({
          googleId: `gmail_${contact.email}`,
          photo: null,
          relationshipType: 'Colleague',
          lastInteractionSource: 'email',
          strategicNotes: '',
          donnaRemembers: ["Contact auto-detected from recent email correspondence."],
          manualNotes: '',
          autoGenerated: false,
          lastAnalyzed: null,
          importanceScore: contact.importanceScore,
          emailFrequency: contact.sentCount + contact.receivedCount,
          recentSubjects: contact.subjectLines,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any)
      };

      await savePerson(uid, newPerson);
      newlyAddedPeople.push(newPerson);
      addedCount++;
    }
  }

  // Save last sync date
  await saveUserPreferences(uid, {
    lastGmailSync: new Date().toISOString()
  });

  // 9. Auto-analyze top 5 most important NEW contacts
  const topNewContactsForAnalysis = newlyAddedPeople
    .filter(p => {
      const freq = (p as any).emailFrequency || 0;
      return freq >= 3;
    })
    .slice(0, 5);

  if (topNewContactsForAnalysis.length > 0) {
    onProgress?.(`Donna is running automatic deep background analysis on ${topNewContactsForAnalysis.length} key stakeholders...`);
    for (let j = 0; j < topNewContactsForAnalysis.length; j++) {
      const p = topNewContactsForAnalysis[j];
      onProgress?.(`Donna is preparing profile context for ${p.name} (${j + 1}/${topNewContactsForAnalysis.length})...`);
      try {
        await analyzePerson(uid, p, accessToken);
      } catch (err) {
        console.warn(`Automatic background analysis failed for ${p.name}:`, err);
      }
      if (j < topNewContactsForAnalysis.length - 1) {
        // 3 second delay to avoid rate limits
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  onProgress?.("Sync complete! Your People Intelligence ledger has been updated.");
  return { foundCount: topContacts.length, addedCount };
}
