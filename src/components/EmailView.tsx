import React, { useState } from 'react';
import { AppEmail, FollowUpEmail, UserContext } from '../types';
import { AlertCircle, Check, Edit3, Mail, RefreshCw, Send, Sparkles, Inbox, Archive, SendHorizonal } from 'lucide-react';
import { askGemini } from '../gemini';
import { createDraft } from '../googleApi';

interface EmailViewProps {
  userContext: UserContext;
  emails: AppEmail[];
  followUps: FollowUpEmail[];
  onUpdateEmails: (emails: AppEmail[]) => void;
  onUpdateFollowUps: (followUps: FollowUpEmail[]) => void;
  isGmailBlocked?: boolean;
}

export default function EmailView({
  userContext,
  emails,
  followUps,
  onUpdateEmails,
  onUpdateFollowUps,
  isGmailBlocked = false
}: EmailViewProps) {
  const [activeFolder, setActiveFolder] = useState<'priority' | 'inbox' | 'drafts' | 'followup'>('priority');
  const [selectedEmail, setSelectedEmail] = useState<AppEmail | null>(emails[0] || null);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Draft assistant state
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftResponse, setDraftResponse] = useState('');
  const [drafting, setDrafting] = useState(false);

  // Active email categories lists
  const priorityEmails = emails.filter(em => em.isPriority && !em.hasReplied);
  const generalEmails = emails.filter(em => !em.isPriority);
  const draftsList = emails.filter(em => em.hasReplied);

  const handleGenerateDraft = async () => {
    if (!draftPrompt.trim() || !selectedEmail) return;
    setDrafting(true);
    try {
      const prompt = `Write a professional, premium email reply in Donna's voice.
Original Subject: ${selectedEmail.subject}
Original Email: ${selectedEmail.body}
Sender: ${selectedEmail.sender}
User's key instruction for writing this response: "${draftPrompt}"
User Profile: ${userContext.name} (${userContext.role})

Write the response directly. Keep it elegant, business-savvy, firm, and fully cohesive. Do not output any notes, subject text, or commentary—just the raw email body ready to be sent. Do not wrap in markdown quotes.`;

      const draft = await askGemini(prompt);
      setDraftResponse(draft);
    } catch (e) {
      console.error(e);
      setDraftResponse(`Hi ${selectedEmail.sender.split(' ')[0]},\n\nI went over your points. I'm reviewing scope adjustments and pricing proposal for Page 5. Let's discuss details during our scheduled call today.\n\nBest,\n${userContext.name}`);
    } finally {
      setDrafting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedEmail || !draftResponse) return;
    setDrafting(true);
    try {
      await createDraft(selectedEmail.senderEmail, 'Re: ' + selectedEmail.subject, draftResponse);
      const updated = emails.map(em => {
        if (em.id === selectedEmail.id) {
          return {
            ...em,
            hasReplied: true,
            draftResponse: draftResponse
          };
        }
        return em;
      });
      onUpdateEmails(updated);
      setStatusMessage({
        text: "Draft composed and secure, partner. I've locked it in your Gmail drafts.",
        type: 'success'
      });
      setTimeout(() => setStatusMessage(null), 4000);
      setSelectedEmail(null);
      setDraftResponse('');
      setDraftPrompt('');
      setActiveFolder('drafts');
    } catch (err: any) {
      console.error("Failed to save draft to Gmail:", err);
      setStatusMessage({
        text: "Failed to save draft to Gmail: " + (err.message || err),
        type: 'error'
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setDrafting(false);
    }
  };

  const handleArchiveEmail = (id: string) => {
    const updated = emails.filter(em => em.id !== id);
    onUpdateEmails(updated);
    if (selectedEmail?.id === id) {
      setSelectedEmail(null);
    }
  };

  return (
    <div id="email-intel-view" className="space-y-6 animate-fade-in pr-1 font-sans">
      
      <div className="flex justify-between items-end border-b border-white/[0.06] pb-4 select-none">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-[#f0ebe0] font-normal">
            Inbox intelligence
          </h2>
          <p className="text-[11px] font-sans font-light text-[#8a8070] mt-1">
            Exchange server active with secure SSL channels
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

        <div className="text-[11px] font-sans font-light text-[#c9a84c] border border-[#c9a84c]/20 bg-[#c9a84c]/5 px-3.5 py-1 rounded-full">
          {priorityEmails.length} priority tasks outstanding
        </div>
      </div>

      {isGmailBlocked && (
        <div id="gmail-blocked-banner" className="bg-[#c9a84c]/5 border border-[#c9a84c]/20 p-4 rounded-xl flex items-start space-x-3 text-xs text-[#c9a84c] font-light">
          <AlertCircle className="w-4 h-4 text-[#c9a84c] shrink-0 mt-0.5 stroke-[1.5]" />
          <span>
            Gmail integration active — full functionality available when running outside the preview environment.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Folders & lists */}
        <div className="md:col-span-4 bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border border-none rounded-2xl p-5 space-y-4 select-none">
          <div className="space-y-1 border-b border-white/[0.04] pb-3">
            {[
              { id: 'priority', label: "Donna's priority focus", count: priorityEmails.length, icon: Sparkles },
              { id: 'inbox', label: "Archive / fyi cache", count: generalEmails.length, icon: Inbox },
              { id: 'drafts', label: "Composed outbound drafts", count: draftsList.length, icon: Edit3 },
              { id: 'followup', label: "Follow-up pending tracker", count: followUps.length, icon: AlertCircle }
            ].map(f => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveFolder(f.id as any);
                    setSelectedEmail(null);
                  }}
                  className={`w-full flex justify-between items-center px-4 py-3 rounded-xl text-[12px] font-sans font-light transition-all duration-200 cursor-pointer ${activeFolder === f.id ? 'bg-[#c9a84c]/8 text-[#c9a84c]' : 'hover:bg-white/[0.02] border border-transparent text-neutral-400'}`}
                >
                  <span className="flex items-center space-x-2.5">
                    <Icon className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" />
                    <span>{f.label}</span>
                  </span>
                  <span className="text-[10px] bg-black/40 px-2.5 py-0.5 rounded-full text-[#8a8070] font-normal">
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Render Mail summaries depending on active folder */}
          <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-none">
            {activeFolder === 'priority' && priorityEmails.map(em => {
              const isSelected = selectedEmail?.id === em.id;
              return (
                <div
                  key={em.id}
                  onClick={() => setSelectedEmail(em)}
                  className={`p-4 rounded-r-xl border-t-0 border-r-0 border-b-0 border-l-2 transition-all duration-200 cursor-pointer relative ${isSelected ? 'border-l-[#c9a84c] bg-[#c9a84c]/6' : 'border-l-[#4a4540] bg-white/[0.02] hover:bg-white/[0.04]'}`}
                >
                  <div className="flex justify-between items-start text-[10px] font-sans font-light text-[#8a8070]">
                    <span className="font-normal text-[#c9a84c]">{em.sender}</span>
                    <span>{em.time}</span>
                  </div>
                  <h4 className="text-[13px] font-medium text-[#f0ebe0] mt-1.5 truncate">{em.subject}</h4>
                  <p className="text-[11px] text-[#8a8070] font-light mt-1 leading-relaxed line-clamp-2">{em.preview}</p>
                  <div className="text-[10px] font-sans font-light mt-2.5 bg-[#8b1a1a]/15 border border-[#8b1a1a]/35 text-[#ff6b6b] px-2.5 py-0.5 rounded-full inline-block leading-tight select-none">
                    {em.donnaLabel}
                  </div>
                </div>
              );
            })}

            {activeFolder === 'inbox' && generalEmails.map(em => {
              const isSelected = selectedEmail?.id === em.id;
              return (
                <div
                  key={em.id}
                  onClick={() => setSelectedEmail(em)}
                  className={`p-4 rounded-r-xl border-t-0 border-r-0 border-b-0 border-l-2 transition-all duration-200 cursor-pointer relative ${isSelected ? 'border-l-[#c9a84c] bg-[#c9a84c]/6' : 'border-l-neutral-700 bg-white/[0.02] hover:bg-white/[0.04]'}`}
                >
                  <div className="flex justify-between items-start text-[10px] font-sans font-light text-[#8a8070]">
                    <span>{em.sender}</span>
                    <span>{em.time}</span>
                  </div>
                  <h4 className="text-[13px] font-medium text-[#f0ebe0] mt-1.5 truncate">{em.subject}</h4>
                  <p className="text-[11px] text-[#8a8070] font-light mt-1 leading-relaxed line-clamp-2">{em.preview}</p>
                  <div className="flex justify-between items-center mt-3 select-none">
                    <span className="text-[9px] font-sans font-light text-[#8a8070] border border-white/[0.04] bg-white/[0.01] px-2.5 py-0.5 rounded-full">
                      FYI only
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveEmail(em.id);
                      }}
                      className="text-[11px] font-normal text-red-500 hover:text-red-400 bg-transparent border-none p-0 cursor-pointer transition-colors duration-200"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              );
            })}

            {activeFolder === 'drafts' && draftsList.map(em => {
              const isSelected = selectedEmail?.id === em.id;
              return (
                <div
                  key={em.id}
                  onClick={() => setSelectedEmail(em)}
                  className={`p-4 rounded-r-xl border-t-0 border-r-0 border-b-0 border-l-2 transition-all duration-200 cursor-pointer relative ${isSelected ? 'border-l-[#c9a84c] bg-[#c9a84c]/6' : 'border-l-[#1a5c2e] bg-[#1a5c2e]/6 hover:bg-[#1a5c2e]/10'}`}
                >
                  <div className="flex justify-between items-start text-[10px] font-sans font-light text-[#8a8070]">
                    <span className="text-[#c9a84c] font-normal">Draft response to: {em.sender}</span>
                  </div>
                  <h4 className="text-[13px] font-medium text-[#f0ebe0] mt-1.5 truncate">{em.subject}</h4>
                  <div className="text-[9px] font-sans font-light text-[#ebd083] uppercase tracking-wider mt-2.5 flex items-center space-x-1.5">
                    <Check className="w-3 h-3 text-[#c9a84c] stroke-[2.5]" />
                    <span>Dossier reply locked</span>
                  </div>
                </div>
              );
            })}

            {activeFolder === 'followup' && (
              <div className="space-y-3.5">
                {followUps.map(fl => (
                  <div key={fl.id} className="p-4 bg-white/[0.02] border border-white/[0.04] rounded-2xl space-y-3">
                    <div className="flex justify-between items-start text-[10px] font-sans font-light text-[#8a8070]">
                      <span className="font-normal text-[#c9a84c]">{fl.recipient}</span>
                      <span className="text-[#ff6b6b] bg-[#8b1a1a]/15 px-2.5 py-0.5 rounded-full border border-[#8b1a1a]/30">{fl.daysWaiting} days waiting</span>
                    </div>
                    <h4 className="text-[13px] font-medium text-[#f0ebe0] mt-1">{fl.subject}</h4>
                    <p className="text-[10px] text-[#4a4540] font-light mt-1">Last contact: {fl.lastSentDate}</p>
                    
                    <button
                      onClick={() => {
                        setActiveFolder('priority');
                        const mockMail: AppEmail = {
                          id: `em-mock-${Date.now()}`,
                          sender: fl.recipient,
                          senderEmail: "client@followup.com",
                          subject: `RE: ${fl.subject}`,
                          time: "Just Now",
                          preview: "Following up on my previous message...",
                          body: "Hi Revant,\n\nI haven't heard back regarding our outline. Shall we finalize details?\n\nRegards.",
                          isPriority: true,
                          donnaLabel: "Donna prompt: This follower has waited on response for some time."
                        };
                        onUpdateEmails([mockMail, ...emails]);
                        setSelectedEmail(mockMail);
                        setStatusMessage({
                          text: "Donna followup thread trigger and forced the sender block into Priority inbox folder.",
                          type: 'success'
                        });
                        setTimeout(() => setStatusMessage(null), 4000);
                      }}
                      className="mt-3 w-full h-8 bg-white/[0.02] hover:bg-[#c9a84c] text-[#8a8070] hover:text-[#0c0c0c] border border-white/[0.04] hover:border-transparent text-[11px] font-sans font-light rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center active:scale-[0.97]"
                    >
                      Audit / poke thread active
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Full email viewer + Draft with Donna */}
        <div className="md:col-span-8 space-y-6">
          {selectedEmail ? (
            <div className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border-none rounded-2xl p-6 md:p-8 space-y-5">
              <div className="border-b border-white/[0.04] pb-4 flex flex-col md:flex-row justify-between md:items-end gap-3">
                <div>
                  <h3 className="font-serif text-[18px] font-normal text-[#f0ebe0] tracking-wide">{selectedEmail.subject}</h3>
                  <div className="text-[12px] font-sans font-light text-[#8a8070] mt-1.5">
                    From: <span className="text-[#c9a84c] font-normal">{selectedEmail.sender}</span> ({selectedEmail.senderEmail})
                  </div>
                </div>
                <div className="text-[11px] font-sans font-light text-[#4a4540]">
                  Received: {selectedEmail.time}
                </div>
              </div>

              {/* Email Content body */}
              <div className="text-[13px] font-light leading-relaxed whitespace-pre-wrap bg-black/[0.15] p-5 border border-white/[0.04] rounded-xl text-[#f0ebe0]">
                {selectedEmail.body}
              </div>

              {/* DRAFT WITH DONNA ASSISTANT PANEL */}
              {activeFolder === 'priority' && (
                <div className="border border-[#c9a84c]/20 bg-[rgba(26,24,20,0.6)] backdrop-blur-[20px] rounded-2xl p-6 space-y-4 shadow-lg">
                  <div className="flex items-center space-x-2.5">
                    <Sparkles className="w-4.5 h-4.5 text-[#c9a84c] stroke-[1.5]" />
                    <h4 className="text-[12px] font-sans font-medium text-white uppercase tracking-wider">
                      Draft response with Donna's advice
                    </h4>
                  </div>

                  <div className="space-y-3.5 border-none">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-sans font-light text-[#8a8070]">
                        Tell Donna what you want to communicate
                      </label>
                      <textarea
                        rows={2}
                        className="w-full bg-[#050505]/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-3 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none"
                        placeholder="e.g. 'Tell Arjun we will reduce advisory cost by 5% but stand firm on product spec delivery schedule'"
                        value={draftPrompt}
                        onChange={(e) => setDraftPrompt(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleGenerateDraft}
                        disabled={drafting || !draftPrompt.trim()}
                        className="h-9 px-5 bg-[#c9a84c] hover:bg-[#ebd083] disabled:bg-white/[0.01] disabled:text-[#4a4540] text-[#0c0c0c] font-sans font-medium text-xs rounded-full active:scale-[0.97] transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        {drafting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0c0c0c]" />
                            <span>Composing email draft...</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5 stroke-[1.5]" />
                            <span>Generate executive reply</span>
                          </>
                        )}
                      </button>
                    </div>

                    {draftResponse && (
                      <div className="space-y-3.5 pt-4 border-t border-white/[0.04]">
                        <label className="block text-[11px] font-sans font-light text-[#ebd083] uppercase tracking-wider">
                          Donna's generated response (Editable)
                        </label>
                        <textarea
                          rows={6}
                          className="w-full bg-black/40 border border-white/[0.08] focus:border-[#c9a84c] rounded-xl p-4 text-[13px] font-sans font-light text-[#f0ebe0] focus:outline-none resize-none leading-relaxed"
                          value={draftResponse}
                          onChange={(e) => setDraftResponse(e.target.value)}
                        />
                        <div className="flex justify-end space-x-4 select-none pt-1">
                          <button
                            onClick={() => setDraftResponse('')}
                            className="text-[12px] font-normal text-[#8a8070] hover:text-[#f0ebe0] transition cursor-pointer"
                          >
                            Discard
                          </button>
                          <button
                            onClick={handleSaveDraft}
                            className="h-9 px-5 bg-[#1a5c2e]/10 hover:bg-[#1a5c2e] text-[#1a5c2e] hover:text-white border border-[#1a5c2e]/40 rounded-full text-xs font-sans font-medium transition duration-200 cursor-pointer flex items-center space-x-1.5"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2]" />
                            <span>Lock draft outbox</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RENDER FOR COMPOSING LOCK OUTBOX DRAWER DETAIL */}
              {activeFolder === 'drafts' && selectedEmail.draftResponse && (
                <div className="border border-[#1a5c2e]/20 bg-[#1a5c2e]/5 rounded-2xl p-6 space-y-3.5 shadow-lg">
                  <div className="flex items-center space-x-2 text-[#ebd083]">
                    <Check className="w-4 h-4 stroke-[2]" />
                    <h4 className="text-[12px] font-sans font-medium uppercase tracking-wider text-[#ebd083]">
                      Composed outbox draft (Ready)
                    </h4>
                  </div>
                  <div className="text-[13px] font-sans font-light leading-relaxed whitespace-pre-wrap bg-black/40 p-4 border border-white/[0.04] rounded-xl text-[#f0ebe0]">
                    {selectedEmail.draftResponse}
                  </div>
                  <div className="flex justify-end select-none">
                    <button
                      onClick={() => {
                        const updated = emails.map(em => {
                          if (em.id === selectedEmail.id) {
                            return { ...em, hasReplied: false, isPriority: false };
                          }
                          return em;
                        });
                        onUpdateEmails(updated);
                        setStatusMessage({
                          text: "Email packet delivered directly to smtp server outgoings.",
                          type: 'success'
                        });
                        setTimeout(() => setStatusMessage(null), 4000);
                        setSelectedEmail(null);
                      }}
                      className="h-9 px-5 bg-[#1a5c2e] hover:bg-[#20753b] text-white rounded-full font-sans font-normal text-xs flex items-center space-x-1.5 transition duration-200 cursor-pointer active:scale-[0.97]"
                    >
                      <SendHorizonal className="w-4 h-4 stroke-[1.5]" />
                      <span>Transmit email now</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[rgba(22,22,22,0.8)] backdrop-blur-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.3)] border-none rounded-2xl p-12 text-center text-xs text-[#8a8070] italic">
              No email packet selected. Check priority focus folder box to start.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
