import React, { useState, useEffect } from 'react';
import { Person, RelationshipType } from '../types';
import { Edit3, Plus, Users, Search, BookOpen, UserMinus, RefreshCw } from 'lucide-react';
import { auth } from '../firebase';
import { getPeople, getUserPreferences } from '../dbService';
import { mineGmailContacts } from '../services/gmailContactMiner';
import { analyzePerson } from '../services/peopleIntelligence';
import { ENV } from '../utils/env';

interface PeopleViewProps {
  people: Person[];
  onUpdatePeople: (people: Person[]) => void;
}

export default function PeopleView({
  people,
  onUpdatePeople
}: PeopleViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [analyzingPersonId, setAnalyzingPersonId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [editingField, setEditingField] = useState<{ id: string, field: 'role' | 'company' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showInfoBanner, setShowInfoBanner] = useState(() => {
    return localStorage.getItem('donna_people_banner_dismissed') !== 'true';
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [isIframe] = useState(() => ENV === 'preview');
  const [showIframeBanner, setShowIframeBanner] = useState(() => {
    return isIframe && localStorage.getItem('donna_iframe_banner_dismissed') !== 'true';
  });

  const handleDismissBanner = () => {
    localStorage.setItem('donna_people_banner_dismissed', 'true');
    setShowInfoBanner(false);
  };

  const runSync = async (force: boolean = false) => {
    if (isSyncing) return;
    const token = localStorage.getItem('donna_access_token');
    const uid = auth.currentUser?.uid;

    if (localStorage.getItem('donna_demo_mode') === 'true' || !uid) {
      if (force) {
        setStatusMessage({
          text: "Gmail sync is disabled in Demo Mode.",
          type: 'success'
        });
        setTimeout(() => setStatusMessage(null), 4000);
      }
      return;
    }

    if (isIframe) {
      if (force) {
        setStatusMessage({
          text: "Gmail sync is simulated in the preview. Donna will auto-sync on full deployment.",
          type: 'success'
        });
        setTimeout(() => setStatusMessage(null), 4000);
      }
      return;
    }

    if (!token) {
      console.warn("No Google access token found for Gmail contact mining.");
      return;
    }

    try {
      setIsSyncing(true);
      setSyncProgress("Donna is initiating background Gmail contact scan...");

      // Check if empty
      const currentPeople = await getPeople(uid);
      const isEmpty = currentPeople.length === 0;

      // Check last sync
      const prefs = await getUserPreferences(uid);
      const lastSyncStr = prefs?.lastGmailSync;
      let shouldSync = isEmpty || force;

      if (lastSyncStr && !shouldSync) {
        const lastSyncDate = new Date(lastSyncStr);
        const diffDays = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays >= 7) {
          shouldSync = true;
        }
      } else if (!lastSyncStr) {
        shouldSync = true;
      }

      if (shouldSync) {
        const result = await mineGmailContacts(token, uid, (msg) => {
          setSyncProgress(msg);
        });

        const freshPeople = await getPeople(uid);
        if (freshPeople && freshPeople.length > 0) {
          onUpdatePeople(freshPeople);
        }

        setStatusMessage({
          text: `Sync complete! Successfully analyzed ${result.foundCount} and logged ${result.addedCount} new stakeholders.`,
          type: 'success'
        });
        setTimeout(() => setStatusMessage(null), 5000);
      }
    } catch (err: any) {
      console.error("Gmail contact sync failed:", err);
      setStatusMessage({
        text: err.message || "Failed to sync contacts from Gmail.",
        type: 'error'
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setIsSyncing(false);
      setSyncProgress("");
    }
  };

  useEffect(() => {
    runSync(false);
  }, []);

  const handleSaveInlineEdit = (id: string, field: 'role' | 'company') => {
    const updated = people.map(p => {
      if (p.id === id) {
        return {
          ...p,
          [field]: editValue.trim()
        };
      }
      return p;
    });
    onUpdatePeople(updated);
    setEditingField(null);
  };

  const handleAnalyzePerson = async (person: Person) => {
    setAnalyzingPersonId(person.id);
    try {
      const token = localStorage.getItem('donna_access_token') || '';
      const uid = auth.currentUser?.uid || '';
      const updated = await analyzePerson(uid, person, token);
      
      const updatedList = people.map(p => p.id === person.id ? updated : p);
      onUpdatePeople(updatedList);

      setStatusMessage({
        text: `Analysis complete for ${person.name}. Strategic notes updated.`,
        type: 'success'
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e: any) {
      console.error("People analysis failed:", e);
      setStatusMessage({
        text: e.message || "Failed to analyze contact. Please check your connection.",
        type: 'error'
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setAnalyzingPersonId(null);
    }
  };

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('Colleague');
  const [lastInteraction, setLastInteraction] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [rememberText, setRememberText] = useState('');

  const handleAddPersonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const items = rememberText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const newPerson: Person = {
      id: `p-${Date.now()}`,
      name,
      role,
      company,
      relationship,
      lastInteraction,
      notes,
      thingsToRemember: items.length > 0 ? items : ["Prefers concise updates."]
    };

    onUpdatePeople([newPerson, ...people]);
    setName('');
    setRole('');
    setCompany('');
    setNotes('');
    setRememberText('');
    setShowAddForm(false);
  };

  const handleDeletePerson = (id: string) => {
    const updated = people.filter(p => p.id !== id);
    onUpdatePeople(updated);
  };

  const filteredPeople = people.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      p.company.toLowerCase().includes(q) ||
      p.relationship.toLowerCase().includes(q)
    );
  });

  const getInitials = (n: string) => {
    if (!n) return '??';
    const clean = n.replace(/["']/g, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0] ? parts[0][0] : '';
      const last = parts[parts.length - 1] ? parts[parts.length - 1][0] : '';
      return (first + last).toUpperCase();
    } else {
      const word = parts[0] || '';
      return word.slice(0, 2).toUpperCase();
    }
  };

  const getBadgeColors = (rel: RelationshipType) => {
    switch (rel) {
      case 'Client': return 'bg-[#c9a84c]/8 text-[#c9a84c] border-[#c9a84c]/20';
      case 'Colleague': return 'bg-white/[0.02] text-neutral-400 border-white/[0.04]';
      case 'Manager': return 'bg-[#e0915a]/8 text-[#e0915a] border-[#e0915a]/20';
      case 'Vendor': return 'bg-white/[0.02] text-neutral-400 border-white/[0.04]';
      default: return 'bg-white/[0.02] text-neutral-400 border-white/[0.04]';
    }
  };

  return (
    <div id="people-intel-landing" className="space-y-6 animate-fade-in pr-1">
      
      {showIframeBanner && (
        <div className="bg-[#c9a84c]/5 border border-[#c9a84c]/30 rounded-xl p-3 flex items-center justify-between gap-3 animate-fade-in select-none">
          <div className="flex items-center space-x-2.5 text-[#ebd083] font-sans text-xs">
            <span className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse shrink-0" />
            <p className="font-light">
              Running in preview — <strong className="font-semibold text-[#f0ebe0]">Gmail sync active on deployment</strong>. Your contacts will load automatically.
            </p>
          </div>
          <button 
            onClick={() => {
              localStorage.setItem('donna_iframe_banner_dismissed', 'true');
              setShowIframeBanner(false);
            }}
            className="text-neutral-500 hover:text-[#f0ebe0] transition-colors duration-200 text-xs font-sans cursor-pointer h-5 w-5 flex items-center justify-center rounded-full hover:bg-white/[0.04]"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-white/[0.06] pb-4 gap-4 select-none">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-[#f0ebe0] font-normal">
            People intelligence
          </h2>
          <p className="text-xs text-[#8a8070] font-light mt-1.5 italic">
            "Donna remembers strategic professional relationships, so you never slip."
          </p>
        </div>

        {statusMessage && (
          <div className={`text-xs px-4 py-2 bg-neutral-900 border font-sans select-none rounded-xl self-center ${
            statusMessage.type === 'success' 
              ? 'bg-[#ebd083]/10 border-[#c9a84c]/20 text-[#ebd083]' 
              : 'bg-red-950/20 border-red-500/10 text-red-400'
          }`}>
            {statusMessage.text}
          </div>
        )}

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="flex items-center bg-[#0c0c0c]/40 border border-white/[0.06] hover:border-white/[0.12] focus-within:border-[#c9a84c]/60 rounded-full px-4 h-9 flex-grow md:flex-grow-0 w-full md:w-64 transition-all duration-200">
            <Search className="w-3.5 h-3.5 text-[#8a8070] shrink-0 mr-2 stroke-[1.5]" />
            <input 
              type="text"
              className="bg-transparent text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none w-full"
              placeholder="Search people profiles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            onClick={() => runSync(true)}
            disabled={isSyncing}
            className="h-9 px-4 border border-[#c9a84c]/40 hover:bg-[#c9a84c]/8 text-[#c9a84c] font-sans font-medium text-xs rounded-full active:scale-[0.97] transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync from Gmail</span>
          </button>

          <button
            onClick={() => setShowAddForm(true)}
            className="h-9 px-5 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] font-sans font-medium text-xs rounded-full active:scale-[0.97] transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            <span>Add person</span>
          </button>
        </div>
      </div>

      {isSyncing && (
        <div className="bg-[#0c0c0c]/40 backdrop-blur-sm border border-[#c9a84c]/15 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 animate-fade-in text-center max-w-xl mx-auto">
          <RefreshCw className="w-6 h-6 text-[#c9a84c] animate-spin stroke-[1.5]" />
          <div className="space-y-1">
            <h4 className="text-xs font-sans font-medium text-[#f0ebe0]">Syncing with Gmail Correspondence</h4>
            <p className="text-[11px] text-[#8a8070] font-light animate-pulse">{syncProgress || "Connecting to Google security server..."}</p>
          </div>
        </div>
      )}

      {showInfoBanner && (
        <div className="bg-[#c9a84c]/5 border border-[#c9a84c]/20 rounded-xl p-4 flex items-start justify-between gap-3 animate-fade-in select-none">
          <div className="flex items-start space-x-3 text-[#ebd083] font-sans">
            <BookOpen className="w-4 h-4 shrink-0 mt-0.5 text-[#c9a84c]" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-[#f0ebe0]">Data privacy assurance</h4>
              <p className="text-[11px] text-[#8a8070] font-light leading-relaxed">
                Donna builds your contact list from email senders and recipients only — name and email address. No phone numbers or personal data is accessed. Deep analysis only runs when you ask for it.
              </p>
            </div>
          </div>
          <button 
            onClick={handleDismissBanner}
            className="text-neutral-500 hover:text-[#f0ebe0] transition-colors duration-200 text-xs font-sans cursor-pointer h-5 w-5 flex items-center justify-center rounded-full hover:bg-white/[0.04]"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPeople.length > 0 ? (
          filteredPeople.map((person) => {
            const isClient = person.relationship === 'Client';
            const isManager = person.relationship === 'Manager';
            const circleColor = 
              isClient ? 'border-[#c9a84c]/30 text-[#c9a84c] bg-[#c9a84c]/8' :
              isManager ? 'border-[#ff9900]/25 text-[#ff9900] bg-[#ff9900]/8' :
              'border-white/[0.06] text-neutral-400 bg-white/[0.02]';

            return (
              <div
                key={person.id}
                className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_16px_rgba(201,168,76,0.12)] hover:translate-y-[-1px] border-none rounded-2xl p-6 transition-all duration-200 ease-in-out relative group space-y-4"
              >
                {/* Delete trigger */}
                <button
                  onClick={() => handleDeletePerson(person.id)}
                  className="absolute right-4 top-4 text-[#4a4540] hover:text-[#ff4d4d] transition-colors duration-200 cursor-pointer p-1 rounded-full hover:bg-white/[0.02]"
                  title="Remove person profile"
                >
                  <UserMinus className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>

                <div className="flex items-center space-x-3.5 border-b border-white/[0.04] pb-4">
                  <div className={`w-11 h-11 rounded-full border flex items-center justify-center font-serif text-[15px] font-normal ${circleColor} shrink-0 pr-0.5`}>
                    {getInitials(person.name)}
                  </div>
                  <div className="space-y-0.5 truncate pr-6">
                    <h3 className="text-[15px] font-medium text-[#f0ebe0] truncate">{person.name}</h3>
                    
                    {/* Role and company section */}
                    <div className="text-[11px] font-sans font-light text-[#8a8070] leading-normal flex items-center gap-1">
                      {editingField?.id === person.id ? (
                        <div className="flex items-center space-x-2 w-full">
                          <input
                            type="text"
                            className="bg-[#0c0c0c]/80 border border-[#c9a84c]/40 text-[11px] font-sans text-[#f0ebe0] rounded-lg px-2 py-0.5 focus:outline-none focus:border-[#c9a84c] w-28 shrink-0"
                            placeholder={editingField.field === 'role' ? 'Role' : 'Company'}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineEdit(person.id, editingField.field);
                              if (e.key === 'Escape') setEditingField(null);
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveInlineEdit(person.id, editingField.field)}
                            className="text-[#c9a84c] hover:text-[#ebd083] p-1 rounded hover:bg-white/[0.04] shrink-0"
                            title="Save changes"
                          >
                            <Edit3 className="w-3 h-3 stroke-[2]" />
                          </button>
                        </div>
                      ) : (
                        (() => {
                          const hasRole = !!person.role;
                          const hasCompany = !!person.company;

                          if (!hasRole && !hasCompany) {
                            return (
                              <button
                                onClick={() => {
                                  setEditingField({ id: person.id, field: 'role' });
                                  setEditValue('');
                                }}
                                className="text-[10px] text-neutral-400/60 hover:text-[#c9a84c] transition-colors duration-150 flex items-center space-x-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3 stroke-[1.5]" />
                                <span>Add role · Add company</span>
                              </button>
                            );
                          }

                          return (
                            <span className="flex items-center space-x-1 truncate max-w-full">
                              <span
                                onClick={() => {
                                  setEditingField({ id: person.id, field: 'role' });
                                  setEditValue(person.role || '');
                                }}
                                className="hover:text-[#c9a84c] cursor-pointer transition-colors duration-150 truncate max-w-[80px]"
                                title="Click to edit role"
                              >
                                {person.role || 'Add role'}
                              </span>
                              <span>·</span>
                              <span
                                onClick={() => {
                                  setEditingField({ id: person.id, field: 'company' });
                                  setEditValue(person.company || '');
                                }}
                                className="font-normal text-neutral-400 hover:text-[#c9a84c] cursor-pointer transition-colors duration-150 truncate max-w-[80px]"
                                title="Click to edit company"
                              >
                                {person.company || 'Add company'}
                              </span>
                              <Edit3 
                                onClick={() => {
                                  setEditingField({ id: person.id, field: 'role' });
                                  setEditValue(person.role || '');
                                }}
                                className="w-2.5 h-2.5 text-[#8a8070]/40 hover:text-[#c9a84c] transition-colors duration-150 cursor-pointer inline shrink-0 ml-1"
                              />
                            </span>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 font-sans">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-sans font-light px-2.5 py-0.5 rounded-full border ${getBadgeColors(person.relationship)}`}>
                      {person.relationship}
                    </span>
                    {(person.source === 'gmail' || person.source === 'gmail_mine') && (
                      <span className="text-[9px] font-sans font-light px-2 py-0.5 rounded-full border border-white/[0.04] bg-white/[0.01] text-[#8a8070]">
                        From Gmail
                      </span>
                    )}
                    <span className="text-[10px] font-sans font-light text-[#4a4540]">
                      Last interaction: {person.lastInteraction}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-sans font-light text-[#4a4540] uppercase tracking-wider">
                      Strategic notes
                    </div>
                    {analyzingPersonId === person.id ? (
                      <p className="text-[12px] text-[#ebd083] font-light leading-relaxed animate-pulse">
                        Donna is analyzing your interaction history...
                      </p>
                    ) : (
                      <p className="text-[12px] text-[#8a8070] font-light leading-relaxed">
                        {person.notes || 'No strategic notes generated yet. Click analyze below.'}
                      </p>
                    )}
                  </div>

                  {person.thingsToRemember && person.thingsToRemember.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[10px] font-sans font-medium text-[#c9a84c] flex items-center space-x-1.5 uppercase tracking-wider">
                        <BookOpen className="w-3.5 h-3.5 text-[#c9a84c] stroke-[1.5]" />
                        <span>Things Donna remembers</span>
                      </div>
                      <ul className="space-y-1.5 pl-1 text-[12px] text-[#8a8070] font-light">
                        {person.thingsToRemember.map((item, id) => (
                          <li key={id} className="flex items-start">
                            <span className="text-[#c9a84c] mr-2">•</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    onClick={() => handleAnalyzePerson(person)}
                    disabled={analyzingPersonId !== null}
                    className="w-full h-8 border border-[#c9a84c]/30 hover:bg-[#c9a84c]/8 text-[#c9a84c] text-[11px] font-sans font-medium rounded-lg active:scale-[0.97] transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 mt-3"
                  >
                    {analyzingPersonId === person.id ? (
                      <span className="flex items-center space-x-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Donna is analyzing...</span>
                      </span>
                    ) : (
                      <span>Let Donna Analyze</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-3 p-12 text-center bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] border border-dashed border-white/[0.04] rounded-2xl text-xs text-[#8a8070]">
            No contacts logged in this selection folder. Add one.
          </div>
        )}
      </div>

      {/* ADD DIALOG / MODAL */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[rgba(20,18,14,0.6)] backdrop-blur-[40px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-[#c9a84c]/15 rounded-2xl p-6 md:p-8 relative space-y-6 animate-fade-in">
            <div className="flex justify-between items-center border-b border-white/[0.06] pb-3 select-none">
              <h3 className="font-serif text-lg text-[#f0ebe0] font-normal flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#c9a84c] stroke-[1.5]" />
                <span>Add stakeholder ledger</span>
              </h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-xs text-[#8a8070] hover:text-[#f0ebe0] transition cursor-pointer font-sans font-light"
              >
                Close (ESC)
              </button>
            </div>

            <form onSubmit={handleAddPersonSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Full Name
                  </label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                    placeholder="e.g., Priya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Firm Relationship Category
                  </label>
                  <select 
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value as any)}
                  >
                    <option value="Client">Client</option>
                    <option value="Colleague">Colleague</option>
                    <option value="Manager">Manager</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Professional Role / Title
                  </label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                    placeholder="e.g., Managing Director"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                    Company / Organization
                  </label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                    placeholder="e.g., Donna Design Lab"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                  Last Interaction Date
                </label>
                <input 
                  type="date"
                  required
                  className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none"
                  value={lastInteraction}
                  onChange={(e) => setLastInteraction(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-sans font-light text-[#8a8070] mb-1.5">
                  Strategic Profile Description
                </label>
                <textarea 
                  rows={2}
                  className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
                  placeholder="Budget discussions are sensitive. Prefers email updates..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-sans font-light text-[#c9a84c] mb-1.5 font-medium">
                  Things to remember (one per line)
                </label>
                <textarea 
                  rows={3}
                  className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
                  placeholder="Prefers numbers over hand-waving&#10;Loves dark premium UI elements"
                  value={rememberText}
                  onChange={(e) => setRememberText(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="h-10 px-5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] text-[#8a8070] hover:text-[#f0ebe0] text-xs font-sans font-light rounded-full transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-6 bg-[#c9a84c] hover:bg-[#ebd083] text-[#0c0c0c] text-xs font-sans font-medium rounded-full active:scale-[0.97] transition-all duration-200 cursor-pointer"
                >
                  Confirm authorized contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
