export class FunctionExecutor {
  async execute(name: string, args: any, accessToken: string): Promise<any> {
    if (!accessToken) {
      throw new Error("No Google access token found. Please sign in again with Google.");
    }

    const isDemo = localStorage.getItem('donna_demo_mode') === 'true' || accessToken === 'demo-token';
    if (isDemo) {
      return this.executeDemo(name, args);
    }

    switch (name) {
      // CALENDAR
      case 'get_todays_events':
        return this.get_todays_events(accessToken);
      case 'get_week_events':
        return this.get_week_events(accessToken);
      case 'create_calendar_event':
        return this.create_calendar_event(accessToken, args);
      case 'update_calendar_event':
        return this.update_calendar_event(accessToken, args);
      case 'delete_calendar_event':
        return this.delete_calendar_event(accessToken, args);
      case 'find_free_slots':
        return this.find_free_slots(accessToken, args);

      // TASKS
      case 'get_all_tasks':
        return this.get_all_tasks(accessToken);
      case 'create_task':
        return this.create_task(accessToken, args);
      case 'complete_task':
        return this.complete_task(accessToken, args);
      case 'update_task':
        return this.update_task(accessToken, args);
      case 'delete_task':
        return this.delete_task(accessToken, args);

      // EMAIL
      case 'get_recent_emails':
        return this.get_recent_emails(accessToken, args);
      case 'get_important_emails':
        return this.get_important_emails(accessToken);
      case 'search_emails':
        return this.search_emails(accessToken, args);
      case 'draft_email':
        return this.draft_email(accessToken, args);
      case 'send_email':
        return this.send_email(accessToken, args);
      case 'reply_to_email':
        return this.reply_to_email(accessToken, args);

      default:
        throw new Error(`Function ${name} is not supported.`);
    }
  }

  // ----------------------------------------------------
  // CALENDAR IMPLEMENTATION
  // ----------------------------------------------------
  private async get_todays_events(accessToken: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}&singleEvents=true&orderBy=startTime`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
    const data = await res.json();
    return (data.items || []).map((e: any) => ({
      id: e.id,
      title: e.summary || '(No Title)',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      attendees: e.attendees?.map((a: any) => a.email) || []
    }));
  }

  private async get_week_events(accessToken: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}&singleEvents=true&orderBy=startTime`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
    const data = await res.json();
    return (data.items || []).map((e: any) => ({
      id: e.id,
      title: e.summary || '(No Title)',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      attendees: e.attendees?.map((a: any) => a.email) || []
    }));
  }

  private async create_calendar_event(
    accessToken: string,
    args: {
      title: string;
      date: string;
      start_time: string;
      duration_minutes: number;
      description?: string;
      attendees?: string[];
    }
  ) {
    const startStr = `${args.date}T${args.start_time}:00`;
    const start = new Date(startStr);
    const end = new Date(start.getTime() + args.duration_minutes * 60 * 1000);

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: args.title,
        description: args.description,
        start: { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        attendees: args.attendees?.map(email => ({ email }))
      })
    });

    if (!res.ok) throw new Error(`Calendar API error: ${res.statusText}`);
    const e = await res.json();
    return {
      id: e.id,
      title: e.summary,
      start: e.start?.dateTime || e.start?.date,
      link: e.htmlLink
    };
  }

  private async update_calendar_event(
    accessToken: string,
    args: {
      event_id: string;
      updates: {
        title?: string;
        date?: string;
        start_time?: string;
        duration_minutes?: number;
        description?: string;
      };
    }
  ) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${args.event_id}`;
    let start_dateTime: string | undefined;
    let end_dateTime: string | undefined;

    if (args.updates.date || args.updates.start_time || args.updates.duration_minutes) {
      const getRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (getRes.ok) {
        const original = await getRes.json();
        const origStart = new Date(original.start?.dateTime || original.start?.date);
        const origEnd = new Date(original.end?.dateTime || original.end?.date);
        const origDuration = (origEnd.getTime() - origStart.getTime()) / (60 * 1000);

        const date = args.updates.date || origStart.toISOString().split('T')[0];
        const time = args.updates.start_time || origStart.toTimeString().split(' ')[0].substring(0, 5);
        const duration = args.updates.duration_minutes || origDuration;

        const newStart = new Date(`${date}T${time}:00`);
        const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);

        start_dateTime = newStart.toISOString();
        end_dateTime = newEnd.toISOString();
      }
    }

    const body: any = {};
    if (args.updates.title !== undefined) body.summary = args.updates.title;
    if (args.updates.description !== undefined) body.description = args.updates.description;
    if (start_dateTime) body.start = { dateTime: start_dateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    if (end_dateTime) body.end = { dateTime: end_dateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Calendar API update error: ${res.statusText}`);
    return await res.json();
  }

  private async delete_calendar_event(accessToken: string, args: { event_id: string }) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${args.event_id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Calendar API delete error: ${res.statusText}`);
    return { deleted: true, event_id: args.event_id };
  }

  private async find_free_slots(accessToken: string, args: { date: string; duration_minutes: number }) {
    const startStr = `${args.date}T00:00:00`;
    const endStr = `${args.date}T23:59:59`;

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(new Date(startStr).toISOString())}&timeMax=${encodeURIComponent(new Date(endStr).toISOString())}&singleEvents=true&orderBy=startTime`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Calendar API free slots error: ${res.statusText}`);
    const data = await res.json();

    const events = (data.items || []).map((e: any) => ({
      start: new Date(e.start?.dateTime || e.start?.date),
      end: new Date(e.end?.dateTime || e.end?.date)
    })).filter((e: any) => !isNaN(e.start.getTime()) && !isNaN(e.end.getTime()));

    const workStart = new Date(`${args.date}T09:00:00`);
    const workEnd = new Date(`${args.date}T18:00:00`);

    const busy: Array<{ start: Date; end: Date }> = [];
    for (const ev of events) {
      const s = ev.start < workStart ? workStart : ev.start;
      const e = ev.end > workEnd ? workEnd : ev.end;
      if (s < e) {
        busy.push({ start: s, end: e });
      }
    }

    busy.sort((a, b) => a.start.getTime() - b.start.getTime());

    const mergedBusy: Array<{ start: Date; end: Date }> = [];
    if (busy.length > 0) {
      let current = busy[0];
      for (let i = 1; i < busy.length; i++) {
        const next = busy[i];
        if (next.start <= current.end) {
          if (next.end > current.end) {
            current.end = next.end;
          }
        } else {
          mergedBusy.push(current);
          current = next;
        }
      }
      mergedBusy.push(current);
    }

    const freeSlots: Array<{ start: string; end: string }> = [];
    let lastEnd = workStart;

    for (const interval of mergedBusy) {
      const gapMs = interval.start.getTime() - lastEnd.getTime();
      if (gapMs >= args.duration_minutes * 60 * 1000) {
        freeSlots.push({
          start: lastEnd.toTimeString().substring(0, 5),
          end: interval.start.toTimeString().substring(0, 5)
        });
      }
      lastEnd = interval.end > lastEnd ? interval.end : lastEnd;
    }

    const lastGapMs = workEnd.getTime() - lastEnd.getTime();
    if (lastGapMs >= args.duration_minutes * 60 * 1000) {
      freeSlots.push({
        start: lastEnd.toTimeString().substring(0, 5),
        end: workEnd.toTimeString().substring(0, 5)
      });
    }

    return freeSlots;
  }

  // ----------------------------------------------------
  // TASKS IMPLEMENTATION
  // ----------------------------------------------------
  private async get_all_tasks(accessToken: string) {
    const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Tasks API error: ${res.statusText}`);
    const data = await res.json();
    return (data.items || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      due: t.due ? t.due.split('T')[0] : undefined,
      notes: t.notes,
      status: t.status
    }));
  }

  private async create_task(
    accessToken: string,
    args: { title: string; due_date?: string; notes?: string; priority?: string }
  ) {
    const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks`;
    const body: any = { title: args.title };
    if (args.due_date) {
      body.due = new Date(args.due_date).toISOString();
    }
    if (args.notes) {
      body.notes = args.notes;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Tasks API create error: ${res.statusText}`);
    return await res.json();
  }

  private async complete_task(accessToken: string, args: { task_id: string }) {
    const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${args.task_id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'completed' })
    });
    if (!res.ok) throw new Error(`Tasks API complete error: ${res.statusText}`);
    return { completed: true, task_id: args.task_id };
  }

  private async update_task(
    accessToken: string,
    args: {
      task_id: string;
      updates: { title?: string; due?: string; notes?: string };
    }
  ) {
    const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${args.task_id}`;
    const body: any = {};
    if (args.updates.title !== undefined) body.title = args.updates.title;
    if (args.updates.notes !== undefined) body.notes = args.updates.notes;
    if (args.updates.due !== undefined) {
      body.due = args.updates.due ? new Date(args.updates.due).toISOString() : null;
    }
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Tasks API update error: ${res.statusText}`);
    return await res.json();
  }

  private async delete_task(accessToken: string, args: { task_id: string }) {
    const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${args.task_id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Tasks API delete error: ${res.statusText}`);
    return { deleted: true, task_id: args.task_id };
  }

  // ----------------------------------------------------
  // EMAIL IMPLEMENTATION
  // ----------------------------------------------------
  private async get_recent_emails(accessToken: string, args?: { limit?: number }) {
    const limit = args?.limit || 10;
    const url = `https://gmail.googleapis.com/v1/users/me/messages?q=in:inbox newer_than:3d&maxResults=${limit}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Gmail API inbox error: ${res.statusText}`);
    const data = await res.json();
    const messages = data.messages || [];

    const summaries = await Promise.all(
      messages.map(async (m: any) => {
        const detailUrl = `https://gmail.googleapis.com/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=subject&metadataHeaders=from&metadataHeaders=date`;
        const dRes = await fetch(detailUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!dRes.ok) return null;
        const dData = await dRes.json();
        const headers = dData.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
        const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
        const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
        return {
          id: dData.id,
          from,
          subject,
          date,
          snippet: dData.snippet
        };
      })
    );
    return summaries.filter(Boolean);
  }

  private async get_important_emails(accessToken: string) {
    const url = `https://gmail.googleapis.com/v1/users/me/messages?q=is:important is:unread&maxResults=10`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Gmail API important error: ${res.statusText}`);
    const data = await res.json();
    const messages = data.messages || [];

    const summaries = await Promise.all(
      messages.map(async (m: any) => {
        const detailUrl = `https://gmail.googleapis.com/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=subject&metadataHeaders=from&metadataHeaders=date`;
        const dRes = await fetch(detailUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!dRes.ok) return null;
        const dData = await dRes.json();
        const headers = dData.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
        const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
        const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
        return {
          id: dData.id,
          from,
          subject,
          date,
          snippet: dData.snippet
        };
      })
    );
    return summaries.filter(Boolean);
  }

  private async search_emails(accessToken: string, args: { query: string }) {
    const url = `https://gmail.googleapis.com/v1/users/me/messages?q=${encodeURIComponent(args.query)}&maxResults=10`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Gmail API search error: ${res.statusText}`);
    const data = await res.json();
    const messages = data.messages || [];

    const summaries = await Promise.all(
      messages.map(async (m: any) => {
        const detailUrl = `https://gmail.googleapis.com/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=subject&metadataHeaders=from&metadataHeaders=date`;
        const dRes = await fetch(detailUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!dRes.ok) return null;
        const dData = await dRes.json();
        const headers = dData.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
        const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
        const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
        return {
          id: dData.id,
          from,
          subject,
          date,
          snippet: dData.snippet
        };
      })
    );
    return summaries.filter(Boolean);
  }

  private async draft_email(
    accessToken: string,
    args: { to: string; subject: string; body: string }
  ) {
    const url = `https://gmail.googleapis.com/v1/users/me/drafts`;
    const emailLines = [
      `To: ${args.to}`,
      `Subject: ${args.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      args.body
    ];

    const emailRaw = emailLines.join('\r\n');
    const encodedEmail = btoa(unescape(encodeURIComponent(emailRaw)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: { raw: encodedEmail }
      })
    });

    if (!res.ok) throw new Error(`Gmail API draft error: ${res.statusText}`);
    const data = await res.json();
    return { draft_id: data.id, to: args.to, subject: args.subject };
  }

  private async send_email(
    accessToken: string,
    args: { to: string; subject: string; body: string }
  ) {
    const url = `https://gmail.googleapis.com/v1/users/me/messages/send`;
    const emailLines = [
      `To: ${args.to}`,
      `Subject: ${args.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      args.body
    ];

    const emailRaw = emailLines.join('\r\n');
    const encodedEmail = btoa(unescape(encodeURIComponent(emailRaw)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: encodedEmail
      })
    });

    if (!res.ok) throw new Error(`Gmail API send error: ${res.statusText}`);
    const data = await res.json();
    return { sent: true, to: args.to, subject: args.subject, message_id: data.id };
  }

  private async reply_to_email(
    accessToken: string,
    args: { message_id: string; thread_id: string; body: string }
  ) {
    const getUrl = `https://gmail.googleapis.com/v1/users/me/messages/${args.message_id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Message-ID`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!getRes.ok) throw new Error(`Failed to fetch parent message: ${getRes.statusText}`);
    const parentMsg = await getRes.json();
    const headers = parentMsg.payload?.headers || [];

    const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
    const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
    const messageIdHeader = headers.find((h: any) => h.name.toLowerCase() === 'message-id')?.value || '';

    const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;

    const emailLines = [
      `To: ${from}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${messageIdHeader}`,
      `References: ${messageIdHeader}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      args.body
    ];

    const emailRaw = emailLines.join('\r\n');
    const encodedEmail = btoa(unescape(encodeURIComponent(emailRaw)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const url = `https://gmail.googleapis.com/v1/users/me/messages/send`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: encodedEmail,
        threadId: args.thread_id
      })
    });
    if (!res.ok) throw new Error(`Gmail reply error: ${res.statusText}`);
    return { sent: true, thread_id: args.thread_id };
  }

  private executeDemo(name: string, args: any): any {
    console.log(`DONNA DEMO: Executing agent tool call '${name}' with args:`, args);
    switch (name) {
      case 'get_todays_events':
      case 'get_week_events': {
        const raw = localStorage.getItem('donna_demo_events') || '[]';
        const evs = JSON.parse(raw);
        return evs.map((e: any) => ({
          id: e.id,
          title: e.title,
          start: `${e.date}T${e.startTime}:00`,
          end: `${e.date}T${e.startTime}:00`, // matching start
          attendees: e.attendees || []
        }));
      }
      case 'create_calendar_event': {
        const id = `demo-evt-${Date.now()}`;
        return {
          id,
          title: args.title,
          start: `${args.date}T${args.start_time}:00`,
          link: '#'
        };
      }
      case 'update_calendar_event': {
        return { status: 'success', event_id: args.event_id };
      }
      case 'delete_calendar_event': {
        return { status: 'success', event_id: args.event_id };
      }
      case 'find_free_slots': {
        return [
          { start: "13:00", end: "14:00" },
          { start: "14:30", end: "15:30" },
          { start: "16:00", end: "17:00" }
        ];
      }
      case 'get_all_tasks': {
        const raw = localStorage.getItem('donna_demo_tasks') || '[]';
        const ts = JSON.parse(raw);
        return ts.map((t: any) => ({
          id: t.id,
          title: t.title,
          due: t.dueDate,
          status: t.completed ? 'completed' : 'needsAction',
          notes: t.notes || ''
        }));
      }
      case 'create_task': {
        const id = `demo-task-${Date.now()}`;
        return {
          id,
          title: args.title,
          status: 'needsAction'
        };
      }
      case 'complete_task': {
        return { status: 'success', task_id: args.task_id };
      }
      case 'update_task': {
        return { status: 'success', task_id: args.task_id };
      }
      case 'delete_task': {
        return { status: 'success', task_id: args.task_id };
      }
      case 'get_recent_emails':
      case 'get_important_emails':
      case 'search_emails': {
        const raw = localStorage.getItem('donna_demo_emails') || '[]';
        const ems = JSON.parse(raw);
        return ems.map((m: any) => ({
          id: m.id,
          sender: m.sender,
          senderEmail: m.senderEmail,
          subject: m.subject,
          time: m.time,
          preview: m.preview,
          body: m.body,
          isPriority: m.isPriority
        }));
      }
      case 'draft_email': {
        return { id: `demo-draft-${Date.now()}`, to: args.to, subject: args.subject, status: 'draft_created' };
      }
      case 'send_email': {
        return { status: 'sent', to: args.to, subject: args.subject };
      }
      case 'reply_to_email': {
        return { status: 'reply_sent', thread_id: args.thread_id };
      }
      default:
        return { status: 'success' };
    }
  }
}
