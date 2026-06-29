export async function getAccessToken(): Promise<string | null> {
  return localStorage.getItem('donna_access_token');
}

export async function verifyTokenScopes(token: string): Promise<{
  valid: boolean;
  scopes: string[];
  hasCalendar: boolean;
  hasGmail: boolean;
  hasTasks: boolean;
}> {
  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    if (!res.ok) {
      return { valid: false, scopes: [], hasCalendar: false, hasGmail: false, hasTasks: false };
    }
    const data = await res.json();
    const scopesStr = data.scope || "";
    const scopesList = scopesStr.split(" ").map((s: string) => s.trim()).filter(Boolean);
    
    // Check for required scopes
    const hasCalendar = scopesList.some((s: string) => s.includes('auth/calendar'));
    const hasGmail = scopesList.some((s: string) => s.includes('auth/gmail') || s.includes('mail.google.com'));
    const hasTasks = scopesList.some((s: string) => s.includes('auth/tasks'));
    
    return {
      valid: true,
      scopes: scopesList,
      hasCalendar,
      hasGmail,
      hasTasks
    };
  } catch (err) {
    console.warn("Failed to fetch tokeninfo:", err);
    return { valid: false, scopes: [], hasCalendar: false, hasGmail: false, hasTasks: false };
  }
}

export function handleApiError(status: number, service: string) {
  if (status === 401 || status === 403) {
    localStorage.removeItem('donna_access_token');
    throw new Error('reconnect_needed');
  }
}

// ---------------------------------------------
// Google Calendar API
// ---------------------------------------------
export async function fetchCalendarEvents(timeMin: string, timeMax: string) {
  const accessToken = localStorage.getItem('donna_access_token');
  console.log('DONNA API DEBUG - Access token exists:', 
    !!accessToken, 
    'First 20 chars:', 
    accessToken?.substring(0, 20)
  );

  if (!accessToken) {
    console.warn('DONNA: No access token found. User needs to sign in again with Google OAuth to grant Calendar/Tasks/Gmail permissions.');
    throw new Error('reconnect_needed');
  }

  const token = accessToken;

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      handleApiError(res.status, 'Google Calendar');
      return [];
    }

    const data = await res.json();
    return data.items || [];
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('NetworkError') || errMsg.includes('Failed to fetch') || errMsg.includes('CORS') || errMsg.toLowerCase().includes('network error')) {
      console.warn('Calendar fetch blocked in preview — will work when deployed or run locally:', errMsg);
    } else {
      console.warn('Error fetching calendar events:', error);
    }
    throw error;
  }
}

export async function createCalendarEvent(summary: string, description: string, startDateTime: string, endDateTime: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token found");

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    })
  });

  if (!res.ok) {
    handleApiError(res.status, 'Google Calendar');
    throw new Error(`Failed to create calendar event: ${res.statusText}`);
  }

  return await res.json();
}

export async function updateCalendarEvent(eventId: string, summary: string, description: string, startDateTime: string, endDateTime: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token found");

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    })
  });

  if (!res.ok) {
    handleApiError(res.status, 'Google Calendar');
    throw new Error(`Failed to update calendar event: ${res.statusText}`);
  }

  return await res.json();
}

export async function deleteCalendarEvent(eventId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token found");

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    if (res.status === 404) {
      console.warn(`Calendar event ${eventId} not found on server, assuming deleted.`);
      return;
    }
    handleApiError(res.status, 'Google Calendar');
    throw new Error(`Failed to delete calendar event: ${res.statusText}`);
  }
}

// ---------------------------------------------
// Google Tasks API
// ---------------------------------------------
export async function fetchTasks() {
  const accessToken = localStorage.getItem('donna_access_token');
  console.log('DONNA API DEBUG - Access token exists:', 
    !!accessToken, 
    'First 20 chars:', 
    accessToken?.substring(0, 20)
  );

  if (!accessToken) {
    console.warn('DONNA: No access token found. User needs to sign in again with Google OAuth to grant Calendar/Tasks/Gmail permissions.');
    throw new Error('reconnect_needed');
  }

  const token = accessToken;

  try {
    const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      handleApiError(res.status, 'Google Tasks');
      return [];
    }

    const data = await res.json();
    return data.items || [];
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('NetworkError') || errMsg.includes('Failed to fetch') || errMsg.includes('CORS') || errMsg.toLowerCase().includes('network error')) {
      console.warn('Tasks fetch blocked in preview — will work when deployed or run locally:', errMsg);
    } else {
      console.warn('Error fetching tasks:', error);
    }
    throw error;
  }
}

export async function createTask(title: string, dueDate?: string, notes?: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token found");

  const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks`;
  const body: any = { title };
  if (dueDate) {
    // Google Tasks requires ISO 8601 date-time format (e.g. 2026-06-23T00:00:00.000Z)
    body.due = new Date(dueDate).toISOString();
  }
  if (notes) {
    body.notes = notes;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    handleApiError(res.status, 'Google Tasks');
    throw new Error(`Failed to create task: ${res.statusText}`);
  }

  return await res.json();
}

export async function completeTask(taskId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token found");

  const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${taskId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'completed'
    })
  });

  if (!res.ok) {
    handleApiError(res.status, 'Google Tasks');
    throw new Error(`Failed to complete task: ${res.statusText}`);
  }

  return await res.json();
}

export async function updateTaskDue(taskId: string, dueDate: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token found");

  const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${taskId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      due: new Date(dueDate).toISOString()
    })
  });

  if (!res.ok) {
    handleApiError(res.status, 'Google Tasks');
    throw new Error(`Failed to update task: ${res.statusText}`);
  }

  return await res.json();
}

// ---------------------------------------------
// Gmail API
// ---------------------------------------------
export async function fetchEmails(q: string = 'in:inbox', maxResults: number = 15) {
  const accessToken = localStorage.getItem('donna_access_token');
  console.log('DONNA API DEBUG - Access token exists:', 
    !!accessToken, 
    'First 20 chars:', 
    accessToken?.substring(0, 20)
  );

  if (!accessToken) {
    console.warn('DONNA: No access token found. User needs to sign in again with Google OAuth to grant Calendar/Tasks/Gmail permissions.');
    throw new Error('reconnect_needed');
  }

  const token = accessToken;

  try {
    const url = `https://gmail.googleapis.com/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      handleApiError(res.status, 'Gmail');
      return [];
    }

    const data = await res.json();
    const messages = data.messages || [];
    
    // Fetch individual email details in parallel
    const details = await Promise.all(
      messages.map(async (msg: { id: string }) => {
        return fetchEmailDetails(msg.id);
      })
    );

    return details.filter(Boolean);
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('NetworkError') || errMsg.includes('Failed to fetch') || errMsg.includes('CORS') || errMsg.toLowerCase().includes('network error')) {
      console.warn('Gmail fetch blocked in preview — will work when deployed or run locally:', errMsg);
    } else {
      console.warn('Error fetching emails:', error);
    }
    throw error;
  }
}

export async function fetchUnreadEmailCount() {
  const token = await getAccessToken();
  if (!token) return 0;

  try {
    const url = `https://gmail.googleapis.com/v1/users/me/messages?q=is:unread in:inbox&maxResults=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      handleApiError(res.status, 'Gmail');
      return 0;
    }

    const data = await res.json();
    return data.messages ? data.messages.length : 0;
  } catch (error) {
    console.error('Error fetching unread email count:', error);
    return 0;
  }
}

export async function fetchEmailDetails(messageId: string) {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const url = `https://gmail.googleapis.com/v1/users/me/messages/${messageId}?format=full`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      handleApiError(res.status, 'Gmail');
      return null;
    }

    const data = await res.json();
    const headers = data.payload?.headers || [];
    const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
    const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
    const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';

    // Simple parser for sender name and email
    let sender = fromHeader;
    let senderEmail = fromHeader;
    const match = fromHeader.match(/^(.*?)\s*<(.*?)>$/);
    if (match) {
      sender = match[1].replace(/['"]/g, '').trim();
      senderEmail = match[2].trim();
    }

    // Try to get email body snippet or full body
    let body = data.snippet || '';
    if (data.payload?.parts) {
      const textPart = data.payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        try {
          // Decode base64url safely
          const decoded = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          body = decoded;
        } catch (e) {
          console.error('Failed to decode body:', e);
        }
      }
    } else if (data.payload?.body?.data) {
      try {
        const decoded = atob(data.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        body = decoded;
      } catch (e) {
        console.error('Failed to decode body:', e);
      }
    }

    return {
      id: data.id,
      sender,
      senderEmail,
      subject,
      time: dateHeader ? new Date(dateHeader).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Unknown',
      preview: data.snippet || '',
      body: body || data.snippet || '',
      isPriority: headers.some((h: any) => h.name.toLowerCase() === 'x-important' || subject.toLowerCase().includes('urgent') || subject.toLowerCase().includes('important')),
      donnaLabel: 'Analyzing...' // Will be dynamically generated by Gemini
    };
  } catch (error) {
    console.error('Error fetching email details:', error);
    return null;
  }
}

export async function createDraft(to: string, subject: string, body: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token found");

  const url = `https://gmail.googleapis.com/v1/users/me/drafts`;
  
  // Construct raw email format
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body
  ];
  
  const emailRaw = emailLines.join('\r\n');
  const encodedEmail = btoa(unescape(encodeURIComponent(emailRaw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        raw: encodedEmail
      }
    })
  });

  if (!res.ok) {
    handleApiError(res.status, 'Gmail');
    throw new Error(`Failed to create draft: ${res.statusText}`);
  }

  return await res.json();
}

export async function markEmailAsRead(messageId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token found");

  const url = `https://gmail.googleapis.com/v1/users/me/messages/${messageId}/batchModify`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ids: [messageId],
      removeLabelIds: ['UNREAD']
    })
  });

  if (!res.ok) {
    handleApiError(res.status, 'Gmail');
    throw new Error(`Failed to mark email as read: ${res.statusText}`);
  }

  return true;
}

export async function fetchSentEmailsOlderThan48hWithoutReply() {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    // Retrieve sent messages
    const url = `https://gmail.googleapis.com/v1/users/me/messages?q=in:sent&maxResults=20`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      handleApiError(res.status, 'Gmail');
      return [];
    }

    const data = await res.json();
    const messages = data.messages || [];
    
    const details = await Promise.all(
      messages.map(async (msg: { id: string }) => {
        const detailUrl = `https://gmail.googleapis.com/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=subject&metadataHeaders=date&metadataHeaders=to`;
        const dRes = await fetch(detailUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!dRes.ok) return null;
        const dData = await dRes.json();
        
        const dateHeader = dData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
        const toHeader = dData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'to')?.value || '';
        const subjectHeader = dData.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
        
        if (!dateHeader) return null;

        const date = new Date(dateHeader);
        const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
        
        if (diffHours >= 48) {
          // Check if thread has any reply from another person
          const threadUrl = `https://gmail.googleapis.com/v1/users/me/threads/${dData.threadId}`;
          const tRes = await fetch(threadUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!tRes.ok) return null;
          const tData = await tRes.json();
          const messagesInThread = tData.messages || [];
          
          // If there is only one message, or all messages in the thread are sent by "me" (i.e. no external reply)
          const hasExternalReply = messagesInThread.some((m: any) => {
            const from = m.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
            // If sender is NOT the user
            const isMe = from.toLowerCase().includes(localStorage.getItem('donna_user_email')?.toLowerCase() || '___');
            return !isMe;
          });

          if (!hasExternalReply) {
            return {
              id: dData.id,
              recipient: toHeader,
              subject: subjectHeader,
              daysWaiting: Math.floor(diffHours / 24),
              lastSentDate: date.toLocaleDateString()
            };
          }
        }
        return null;
      })
    );

    return details.filter(Boolean);
  } catch (error) {
    console.error('Error tracking sent emails:', error);
    return [];
  }
}
