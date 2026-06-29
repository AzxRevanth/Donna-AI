# Donna — AI Personal Secretary

## What is Donna?

Donna is an elite, highly sophisticated, and hyper-personalized AI executive personal secretary designed to manage your schedule, correspondences, habits, and relationship intelligence with absolute precision. Emulating the sharp, direct, and opinionated personality of high-end corporate specialists (inspired by characters like Harvey Specter and Donna Paulsen from *Suits*), she acts not as a simple digital tool, but as a proactive partner in defending your time and maximizing your executive leverage.

Unlike standard productivity dashboards, Donna operates natively as an agentic assistant. By integrating directly with Google Calendar, Gmail, and Google Tasks APIs alongside a persistent Firebase Firestore database, she actively combs through your workspace headers to extract insights, flag critical timeline conflicts, prioritize your actual to-dos, and draft correspondence perfectly matching your contextual parameters. Donna protects your calendar, schedules focus hours, keeps tabs on key stakeholders, and ensures your daily actions remain aligned with your overarching North Star strategic objectives.

Designed with a sleek, premium, high-contrast dark visual identity reminiscent of elite legal software, Donna is built to look as sophisticated as she behaves. She features dual conversational modes (interactive high-fidelity voice or polished text interface), real-time ambient audio visualizations, contextually injected smart prompts, and continuous strategic review mechanisms. Donna handles the administrative noise of your professional life so you can remain entirely focused on execution.

---

## Features

### 🌟 1. Onboarding & Preferred Context
- **Personalized Setup Questionnaire**: A smooth 3-screen interactive calibration flow that details your professional role, operating hours, target metrics, key stakeholders, assertiveness tolerance, and personal boundaries.
- **Dynamic Greeting**: Instantly pulls and greets you using your preferred name and context, establishing Donna’s tailored voice from your first second in the workspace.
- **Dynamic Profile Registration**: Persists completing attributes directly to safe Firestore security collections, setting strict baseline parameters for scheduled morning briefings and focus slots.

### 🏢 2. Office (War Room Dashboard)
- **Voice Orb (Speech Synthesis)**: A interactive, morphing amber focus orb displaying slow breathing animations that speaks your daily brief aloud with fluid transitions and automatic fallback logging.
- **Morning Briefing Ledger**: Gathers real-time events, emails, and prioritized tasks to generate a single cohesive summary card in Donna's signature warm-but-realistic style, complete with high-leverage recommendations.
- **Priority Stack Ranker**: Automatically indexes and orders your Google Tasks into 3 supreme strategic actions of the day, fully detailed with Donna's tactical advice and custom estimated time.
- **Interactive Unified Timeline**: Dynamically overlays real calendar events alongside a sweeping gold tracker line indicating your exact physical time position. High-contrast warnings call out adjacent conflicts and propose immediate corrective bookings.
- **Active Warning Cards**: Analyzes pending emails, conflicting schedules, and overdue deliverables to render dismissible quick-action banners allowing Donna to handle them with a single click.

### 💬 3. Agentic Chat Page
- **Dual Communication Modes**: Fluid, single-tap switching between high-end voice-only microphone interactions and traditional detailed keyboard chat layouts at 300ms transitions.
- **Ambient Voice Recognition**: Features built-in speech-to-text parsers with animated audio spectrum mapping, allowing you to converse with Donna naturally while she triggers real-time responses.
- **Full Agentic Function Calling**: Empowers Donna to perform deep operations across your workspace through 15+ complex API routes, allowing her to automatically compile briefs, update task columns, query events, draft email replies, and schedule follow-ups entirely on your verbal commands.
- **Secret Archives Sidebar**: A slide-out panel that tracks your historical transcripts, allowing you to quickly reference previous decisions and resume contextual memory threads.

### 👥 4. People Intelligence (Relationship Hub)
- **Gmail Contact Mining**: A background relationship analyzer that scrapes your sent/received headers over the last 60 days to extract, rank, and store your top 50 highly relevant contacts.
- **Automatic Persona Auditing**: Automatically triggers Gemini LLM reviews on your top 5 highest-frequency contacts, drafting deep profiles covering their strategic importance and communication rules.
- **Deterministic Avatars**: Uses cryptographic name hashes to render consistent, deterministic initials colors across unique contact cards.
- **Meeting Brief Integration**: Automatically scans upcoming calendar invitees against your CRM to inject strategic contact notes directly into your event briefing screens.

### 🎯 5. Goals & Habits Ledger
- **North Star Objective Editor**: An inline-editable focus tracker that maps your overarching professional targets straight from onboarding to your active dashboard workspace.
- **Strategic Milestones Grid**: Creates custom categorized progress rings (Work, Health, Learning, Personal) with streak mechanics to track consistent execution.
- **Sunday Strategic Reviews**: A dedicated performance auditing engine where Donna runs a thorough review of your weekly metrics to deliver feedback on where you are slacking.

### 📧 6. Email Hub & Draft Engine
- **Strategic Categorization**: Reads your inbox in real-time to assign concise priority tags and status updates written in Donna’s professional voice.
- **Draft-with-Donna Sidebar**: Converts simple conversational intent into elegant, polished professional email drafts ready to save directly to your Google drafts or send instantly.
- **Follow-up Warning Flags**: Auto-detects outgoing communications older than 48 hours without a reply, prompting you to prompt Donna to draft follow-up nudges.

### ⚙️ 7. Settings & Memory Parameters
- **Active Memory Ledger**: A custom array allowing you to explicitly teach Donna custom facts about your routine, which are permanently injected into her conversational context.
- **Calibration Panel**: Fine-tune your work-hours start, focus slots, timezone indicators, and active assertiveness metrics to adjust how aggressive Donna acts.
- **Connected Integrations Status**: Real-time validation checks mapping authorization scopes to Google APIs, enabling quick reconnections.

---

## Tech Stack

- **Frontend Framework**: React 18+ with Vite and TypeScript (Strict ESM typing)
- **UI & Animations**: Tailwind CSS with Framer Motion (`motion/react`)
- **Icons**: Lucide React Icons
- **Primary AI Models**:
  - Text & Agentic Loops: `gemini-2.0-flash`
  - Voice Mode Socket: `models/gemini-2.0-flash-live-001` (Fallback to Web Speech Synthesis API with custom rate/pitch metrics)
- **Auth Engine**: Firebase Authentication (Google OAuth Client Identity)
- **Database Engine**: Firebase Firestore (Persistent collection structures)
- **External Workspace Integrations**:
  - Google Calendar API v3
  - Google Gmail API v1
  - Google Tasks API v1
- **Package Manager**: NPM

---

## Environment Setup

### Prerequisites
- Node.js (v18.0 or higher recommended)
- NPM (v9.0 or higher)
- Google account with developer console access
- Firebase account with a provisioned project
- Google AI Studio account for Gemini API Key

### Step 1 — Clone and Install
```bash
# Clone the repository and navigate to root
cd donna-applet

# Install base and workspace dependencies
npm install
```

### Step 2 — Firebase Setup
1. Open the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Google Provider** in the **Authentication** section under the Sign-in method tab.
3. Enable **Firestore Database** in your Firebase project and select "Start in Test Mode".
4. Create a Web App in your Firebase project settings to retrieve your `firebaseConfig` keys.
5. Setup your Security Rules inside `firestore.rules` and deploy them:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Step 3 — Google Cloud Console Setup
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/) (using the same project generated by Firebase).
2. Go to **APIs & Services > Library** and search for and enable these exact APIs:
   - **Google Calendar API**
   - **Gmail API**
   - **Google Tasks API**
3. Open **OAuth Consent Screen** settings:
   - Configure User Type as External (or Internal if under Google Workspace domain).
   - Add your personal developer Gmail as a test user.
   - Add these exact scopes:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/gmail.compose`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/tasks`
4. Select **Credentials > Create Credentials > OAuth client ID**:
   - Application Type: Web Application.
   - Authorized JavaScript Origins:
     - `http://localhost:3000`
     - `http://localhost:5173`
     - `https://your-vercel-domain.vercel.app`
   - Authorized Redirect URIs:
     - Same matching origins list.

### Step 4 — Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Select **Get API key** and generate a standard API key under your matching Cloud Project.
3. Save the key to your environmental configuration variables.

### Step 5 — Environment Variables
Create a `.env` file in the root directory:
```env
VITE_GEMINI_API_KEY=AIzaSyYourGeminiAPIKey
VITE_FIREBASE_API_KEY=AIzaSyYourFirebaseAPIKey
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=1:your_app_id
```
*(Ensure `.env` is listed inside your `.gitignore` to prevent committing sensitive keys).*

### Step 6 — Run Locally
```bash
# Start development server on port 3000
npm run dev

# Open your browser and navigate to:
http://localhost:3000
```
*Note: Chrome or Edge is required for full speech recognition mechanics. Safari does not support SpeechRecognition APIs.*

### Step 7 — Deploy to Vercel
1. Push your sanitized code repository to your private GitHub profile.
2. Sign-in to [Vercel](https://vercel.com/) and import your repository.
3. Copy all `VITE_*` environment variables directly into Vercel Project Environment Settings.
4. Click **Deploy**.
5. Copy the generated deployment URL and append it to your Google Cloud Console OAuth Authorized Origins and Firebase Authorized Domains lists.

---

## First Time Using Donna

1. **Authentication Gate**: Load the app in your browser and click **Sign in with Google**. Authenticate and approve all Google Workspace permissions.
2. **Onboarding Questionnaire**: Complete the multi-screen calibration questionnaire detailing your schedule constraints, priority focus, and assertiveness settings.
3. **Office Welcome**: Upon landing in the Office (War Room), the amber Voice Orb will speak a greeting and read your dynamic briefing aloud.
4. **Google Workspace Sync**: Donna will retrieve tasks and calendar coordinates immediately, populating lists automatically.
5. **People Discovery**: Under the People Intel tab, Donna automatically scans your sent/received email headers in the background to build your top relationship matrix.
6. **Interaction**: Ask Donna to complete tasks, draft emails, check upcoming invitees, or handle calendar conflicts verbally inside the Chat page.

---

## Using Donna Locally vs Deployed

| Feature | AI Studio Preview | Local (localhost) | Deployed |
| :--- | :--- | :--- | :--- |
| **Voice Input (Speech)** | ❌ Blocked (iframe sandbox) | ✓ | ✓ |
| **Voice Output (Speech)** | ✓ | ✓ | ✓ |
| **Gemini AI Operations** | ✓ | ✓ | ✓ |
| **Firebase Firestore** | ✓ | ✓ | ✓ |
| **Firebase Auth Gate** | ⚠ Popup may be blocked | ✓ | ✓ |
| **Google Calendar Sync** | ❌ CORS Blocked in iframe | ✓ | ✓ |
| **Gmail Inbox Scopes** | ❌ CORS Blocked in iframe | ✓ | ✓ |
| **Google Tasks Scopes** | ❌ CORS Blocked in iframe | ✓ | ✓ |
| **People Intelligence Sync** | ❌ CORS Blocked in iframe | ✓ | ✓ |

---

## Known Limitations

- **Browser Specific Speech**: The `SpeechRecognition` API is highly optimized for Google Chrome and Chromium-based browsers. Users running Firefox or Safari will see a graceful banner auto-switching the layout to pure chat keyboard mechanics.
- **OAuth Expirations**: Standard Google OAuth tokens expire after 1 hour of inactivity. If a CORS warning or 401 error is detected, Donna will render a clean reconnect banner prompting a quick sign-out and sign-back-in sequence to refresh credentials.
- **Iframe CORS Sandboxing**: Google APIs explicitly block cross-origin requests originating within nested iframe environments. Donna detects this state, showing a beautiful dismissible warning card and allowing complete simulation capabilities, while fully running once loaded on localhost or a deployed domain.

---

## Troubleshooting

### Q: "Google API Sync is not populating coordinates" or "Access Token Expired"
- **A**: Google tokens expire after 1 hour. Click on the sign-out icon in the lower-left corner of the sidebar, then authenticate and re-approve all permissions.

### Q: "SpeechRecognition is disabled or button does nothing"
- **A**: Ensure you are using Google Chrome or Microsoft Edge. Verify that the browser is granted microphone access inside your operating system's settings.

### Q: "Firestore database not loading" or "Missing Permissions"
- **A**: Verify that your Firebase Console has Firestore Database initialized in the correct region and that the deployed security rules authorize read/write capabilities matching `userId`.

---

## Architecture Overview

Donna uses a self-contained, React client-side SPA architecture that accesses cloud systems directly to secure your keys. All heavy Google API requests (Gmail, Tasks, Calendar) are authorized and fetched on the client side using secure access tokens stored in your browser’s `localStorage`.

```
                    ┌──────────────────────────────────────────┐
                    │               User Browser               │
                    └─────────────────────┬────────────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
      ┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐
      │     Firebase Auth    ││  Google Workspace    ││      Gemini LLM      │
      │  & Firestore Storage ││ (Calendar, Gmail,   ││  (Agentic Reasoning │
      │   (User Profile,     ││      Tasks APIs)     ││  & Strategic Notes)  │
      │  Memory, Settings)   ││                      ││                      │
      └──────────────────────┘└──────────────────────┘└──────────────────────┘
```

The system stores your custom settings, coached memories, and relationship profiles in Firebase Firestore, allowing Donna to remain lightweight, blazing fast, and highly secure. When you ask Donna to perform an action, the Gemini LLM identifies the operational intent, parses the required variables, runs the appropriate Google API sequence, and returns a natural audio-synthesized verbal confirmation.

[End of DONNA_README.md]
