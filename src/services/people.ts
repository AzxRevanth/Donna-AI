import { auth } from '../firebase';

export interface ExtractedContact {
  email: string;        // only identifier, always present
  name: string;         // from email headers
  googleId: string;     // use email as the ID: `gmail_${email}`
  role: '';             // empty — user fills this in
  company: '';          // empty — user fills this in  
  photo: null;          // no photos — we don't have them
  source: 'gmail';      // always 'gmail' for these contacts
}

function chunk<T>(array: T[], size: number): T[][] {
  const results = [];
  for (let i = 0; i < array.length; i += size) {
    results.push(array.slice(i, i + size));
  }
  return results;
}

async function fetchMessageMetadata(id: string, accessToken: string) {
  const url = `https://gmail.googleapis.com/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc`;
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

export function parseEmailHeader(raw: string): Array<{name: string, email: string}> {
  const results: Array<{name: string, email: string}> = [];
  // Split by comma but not commas inside quotes
  const parts = raw.match(/(?:[^,"]+|"[^"]*")+/g) || [];
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Format: "Name <email>"
    const withName = trimmed.match(
      /^"?([^"<]+)"?\s*<([^>]+)>$/
    );
    if (withName) {
      results.push({
        name: withName[1].trim().replace(/^"|"$/g, ''),
        email: withName[2].trim().toLowerCase()
      });
      continue;
    }
    // Format: just email address
    const emailOnly = trimmed.match(/^[\w.+-]+@[\w-]+\.[.\w-]+$/);
    if (emailOnly) {
      results.push({
        name: trimmed.split('@')[0], // use local part as name
        email: trimmed.toLowerCase()
      });
    }
  }
  return results;
}

function isAutomatedEmail(email: string): boolean {
  const automated = [
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'notifications', 'notification', 'alerts', 'alert',
    'support', 'help', 'info', 'contact', 'admin',
    'mailer', 'bounce', 'postmaster', 'newsletter'
  ];
  const local = email.split('@')[0].toLowerCase();
  return automated.some(a => local.includes(a));
}

function getScore(name: string, isFrom: boolean): number {
  let score = name.length;
  if (isFrom) score += 100; // From headers are highly preferred
  if (name.includes('@')) score -= 200; // email fallbacks are heavily penalized
  return score;
}

export async function extractContactsFromGmail(accessToken: string): Promise<ExtractedContact[]> {
  if (!accessToken) {
    console.warn("Donna extractContactsFromGmail: No access token provided.");
    return [];
  }

  // Step 1: Fetch recent message IDs
  const query = encodeURIComponent('in:inbox OR in:sent newer_than:90d');
  const listUrl = `https://gmail.googleapis.com/v1/users/me/messages?maxResults=100&q=${query}`;
  
  let messageIds: string[] = [];
  try {
    const res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      console.error(`Gmail list messages response error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const messages = data.messages || [];
    messageIds = messages.map((m: any) => m.id).filter(Boolean);
  } catch (err) {
    console.error("Error listing Gmail messages for contacts:", err);
    return [];
  }

  if (messageIds.length === 0) {
    return [];
  }

  // Step 2: Fetch headers only for each message in batches of 10 with 200ms delay
  const batches = chunk(messageIds, 10);
  const allHeaders: any[] = [];
  
  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(id => fetchMessageMetadata(id, accessToken))
    );
    allHeaders.push(...results.filter(Boolean));
    await new Promise(r => setTimeout(r, 200));
  }

  // Step 3 & 4: Parse name + email and deduplicate
  const contactMap = new Map<string, ExtractedContact>();

  const addOrUpdateContact = (name: string, email: string, isFromHeader: boolean) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    const existing = contactMap.get(cleanEmail);
    if (!existing) {
      contactMap.set(cleanEmail, {
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        googleId: `gmail_${cleanEmail}`,
        role: '',
        company: '',
        photo: null,
        source: 'gmail',
        _score: getScore(name || cleanEmail.split('@')[0], isFromHeader)
      } as any);
    } else {
      const currentScore = (existing as any)._score || 0;
      const newScore = getScore(name || existing.name, isFromHeader);
      if (newScore > currentScore) {
        existing.name = name || existing.name;
        (existing as any)._score = newScore;
      }
    }
  };

  for (const msg of allHeaders) {
    if (msg && msg.payload && msg.payload.headers) {
      const headers = msg.payload.headers;
      for (const h of headers) {
        const nameLower = h.name.toLowerCase();
        if (nameLower === 'from' || nameLower === 'to' || nameLower === 'cc') {
          const parsed = parseEmailHeader(h.value || '');
          for (const item of parsed) {
            addOrUpdateContact(item.name, item.email, nameLower === 'from');
          }
        }
      }
    }
  }

  // Step 5: Filter out user's own email and automated/numeric addresses
  const userEmail = auth.currentUser?.email?.toLowerCase();
  
  for (const [email, contact] of contactMap.entries()) {
    if (userEmail && email === userEmail) {
      contactMap.delete(email);
      continue;
    }
    
    if (isAutomatedEmail(email)) {
      contactMap.delete(email);
      continue;
    }
    
    const local = email.split('@')[0];
    if (/^\d+$/.test(local)) {
      contactMap.delete(email);
      continue;
    }

    // Clean up temporary scoring field
    delete (contact as any)._score;
  }

  // Step 6: Return the final contact list
  return Array.from(contactMap.values());
}
