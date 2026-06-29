import { auth } from '../firebase';
import { savePerson, getPeople } from '../dbService';
import { Person } from '../types';
import { askGeminiJSON } from '../gemini';
import { fetchEmailDetails } from '../googleApi';

// Helper to fetch message IDs from Gmail query
async function fetchMessageIds(accessToken: string, query: string, maxResults: number = 10): Promise<string[]> {
  const url = `https://gmail.googleapis.com/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  try {
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
  } catch (err) {
    console.error(`Failed to fetch message IDs:`, err);
    return [];
  }
}

// Perform deep relationship intelligence analysis on a contact
export async function analyzePerson(
  uid: string,
  person: Person,
  accessToken: string
): Promise<Person> {
  if (!person || !person.id) {
    throw new Error('Invalid person parameter');
  }

  // If in iframe or no access token, run purely using Gemini on existing notes
  const isIframe = window !== window.top;
  let emails: any[] = [];
  let meetings: any[] = [];

  if (accessToken && !isIframe) {
    try {
      // 1. Gmail fetch: Fetch message IDs (up to 10), then fetch details
      const q = `to:${person.email} OR from:${person.email}`;
      const ids = await fetchMessageIds(accessToken, q, 10);
      emails = await Promise.all(
        ids.map(id => fetchEmailDetails(id).catch(() => null))
      );
    } catch (err) {
      console.warn("Gmail fetch failed for analysis:", err);
    }

    try {
      // 2. Calendar fetch: meetings where person.email is attendee or query
      const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const calUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&q=${encodeURIComponent(person.email || person.name)}&singleEvents=true`;
      const calRes = await fetch(calUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (calRes.ok) {
        const calData = await calRes.json();
        meetings = calData.items || [];
      }
    } catch (err) {
      console.warn("Calendar fetch failed for analysis:", err);
    }
  }

  // 3. Prompt includes both email and meeting context
  const prompt = `Perform an elite strategic relationship intelligence analysis in Donna's voice for this contact:
Name: ${person.name}
Role: ${person.role || 'Not specified'} at ${person.company || 'Not specified'}
Relationship Type: ${person.relationship || 'Not specified'}
Last Interaction: ${person.lastInteraction || 'Not specified'}
Strategic notes: ${person.notes || 'None logged yet.'}

GMAIL CORRESPONDENCE HISTORY (LAST 60 DAYS):
${JSON.stringify(emails.filter(Boolean).map(e => ({ subject: e?.subject, date: e?.time, snippet: e?.preview })))}

CALENDAR MEETING HISTORY (LAST 90 DAYS):
${JSON.stringify(meetings.filter(Boolean).map((m: any) => ({ summary: m.summary, start: m.start?.dateTime || m.start?.date, description: m.description })))}

Generate a sophisticated JSON profile analysis containing:
1. "strategicNotes": A sharp, concise, 2-3 sentence strategic advice paragraph in Donna's signature Suits-style, warm but realistic and direct voice. Focus on high-leverage guidance on how to navigate this contact. Avoid saying "Donna says" or including quotes. Just write the advice directly.
2. "thingsToRemember": An array of 3 specific, actionable "things to remember" bullets about their communication pattern, interests, or style.

Return ONLY a raw JSON object matching this schema. No markdown formatting, no code blocks:
{
  "strategicNotes": "string",
  "thingsToRemember": ["string", "string", "string"]
}`;

  // 4. Response JSON parsed correctly
  let responseObj: { strategicNotes: string, thingsToRemember: string[] };
  try {
    responseObj = await askGeminiJSON<{ strategicNotes: string, thingsToRemember: string[] }>(prompt);
  } catch (err) {
    console.error("Gemini analysis failed:", err);
    throw new Error("Donna's strategic filters failed to analyze this contact's threads.");
  }

  if (!responseObj || typeof responseObj.strategicNotes !== 'string' || !Array.isArray(responseObj.thingsToRemember)) {
    throw new Error("Invalid response format received from strategic filters.");
  }

  // 5. Update person object and sync to Firestore
  const updatedPerson: Person = {
    ...person,
    notes: responseObj.strategicNotes,
    thingsToRemember: responseObj.thingsToRemember,
    // Add Firestore-spec variables for dual compatibility
    ...( {
      strategicNotes: responseObj.strategicNotes,
      donnaRemembers: responseObj.thingsToRemember,
      lastAnalyzed: new Date().toISOString()
    } as any )
  };

  if (uid && localStorage.getItem('donna_demo_mode') !== 'true') {
    await savePerson(uid, updatedPerson);
  }

  return updatedPerson;
}
