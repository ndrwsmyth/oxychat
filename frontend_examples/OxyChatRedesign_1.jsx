import React, { useState, useEffect, useRef } from 'react';

// Mock data for transcripts
const mockTranscripts = [
  { id: '1', title: 'Q4 Planning Session', date: 'Dec 28, 2025', source: 'zoom' },
  { id: '2', title: 'Design Review', date: 'Dec 27, 2025', source: 'teams' },
  { id: '3', title: 'Client Kickoff', date: 'Dec 26, 2025', source: 'meet' },
  { id: '4', title: 'Sprint Retrospective', date: 'Dec 24, 2025', source: 'zoom' },
];

export default function OxyChat() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentions(true);
      setMentionQuery('');
    } else if (showMentions) {
      const query = value.slice(value.lastIndexOf('@') + 1);
      if (query.includes(' ')) {
        setShowMentions(false);
      } else {
        setMentionQuery(query);
      }
    }
  };

  const handleMentionSelect = (transcript) => {
    const lastAtIndex = inputValue.lastIndexOf('@');
    const newValue = inputValue.slice(0, lastAtIndex) + `@${transcript.title} `;
    setInputValue(newValue);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    const newMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      mentions: []
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I understand your request. Let me analyze the relevant transcripts and provide you with a comprehensive response based on the meeting discussions.'
      }]);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredTranscripts = mockTranscripts.filter(t => 
    t.title.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  return (
    <div className="oxy-container">
      <div className="oxy-ambient" />
      
      <div className="oxy-main">
        <header className="oxy-header">
          <div className="oxy-header-left">
            <div className="oxy-logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M6 12h12" strokeLinecap="round" />
              </svg>
            </div>
            <span className="oxy-logo-text">Oxy</span>
          </div>
          <div className="oxy-header-right">
            <button 
              className="oxy-icon-btn"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M15 3v18" />
              </svg>
            </button>
          </div>
        </header>

        <div className="oxy-chat-area">
          {messages.length === 0 ? (
            <div className="oxy-empty">
              <div className="oxy-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h1 className="oxy-empty-title">Good evening, Andrew</h1>
              <p className="oxy-empty-subtitle">How can I help you today?</p>
              <div className="oxy-suggestions">
                {['Summarize recent meetings', 'Find action items', 'Search transcripts'].map((s, i) => (
                  <button key={i} className="oxy-chip" onClick={() => setInputValue(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="oxy-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`oxy-msg-row ${msg.role === 'user' ? 'oxy-msg-user' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="oxy-avatar">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v12M6 12h12" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                  <div className={`oxy-bubble ${msg.role === 'user' ? 'oxy-bubble-user' : 'oxy-bubble-ai'}`}>
                    <p>{msg.content}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="oxy-msg-row">
                  <div className="oxy-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v12M6 12h12" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="oxy-bubble oxy-bubble-ai">
                    <div className="oxy-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="oxy-input-area">
          <div className="oxy-input-wrap">
            {showMentions && (
              <div className="oxy-mention-pop">
                <div className="oxy-mention-header">Transcripts</div>
                {filteredTranscripts.map(t => (
                  <button key={t.id} className="oxy-mention-item" onClick={() => handleMentionSelect(t)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                    <div className="oxy-mention-content">
                      <span className="oxy-mention-title">{t.title}</span>
                      <span className="oxy-mention-date">{t.date}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="oxy-input-field">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message Oxy..."
                rows={1}
              />
              <div className="oxy-input-actions">
                <span className="oxy-hint">@ to mention</span>
                <button 
                  className="oxy-send"
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  style={{ opacity: inputValue.trim() ? 1 : 0.3 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSidebar && (
        <aside className="oxy-sidebar">
          <div className="oxy-sidebar-header">
            <h2>Library</h2>
            <button className="oxy-icon-btn-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          
          <div className="oxy-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input type="text" placeholder="Search transcripts" />
          </div>

          <div className="oxy-transcript-list">
            {mockTranscripts.map((t, i) => (
              <div key={t.id} className="oxy-transcript" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="oxy-transcript-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </div>
                <div className="oxy-transcript-content">
                  <span className="oxy-transcript-title">{t.title}</span>
                  <span className="oxy-transcript-meta">{t.date}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=Instrument+Serif:ital@0;1&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .oxy-container {
          display: flex;
          height: 100vh;
          width: 100%;
          font-family: "DM Sans", -apple-system, sans-serif;
          background: #FAFAF9;
          position: relative;
          overflow: hidden;
        }
        
        .oxy-ambient {
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(245, 158, 11, 0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(14, 165, 233, 0.03) 0%, transparent 50%);
          pointer-events: none;
        }
        
        .oxy-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 1;
        }
        
        .oxy-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        
        .oxy-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .oxy-logo-mark {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        
        .oxy-logo-text {
          font-size: 18px;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: #1a1a1a;
        }
        
        .oxy-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.06);
          background: rgba(255,255,255,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #666;
          transition: all 0.2s ease;
        }
        
        .oxy-icon-btn:hover {
          background: #fff;
          border-color: rgba(0,0,0,0.1);
        }
        
        .oxy-icon-btn-sm {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: none;
          background: rgba(0,0,0,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #666;
          transition: all 0.2s ease;
        }
        
        .oxy-icon-btn-sm:hover {
          background: rgba(0,0,0,0.08);
        }
        
        .oxy-chat-area {
          flex: 1;
          overflow: auto;
          padding: 0 24px;
        }
        
        .oxy-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          animation: fadeInUp 0.6s ease forwards;
        }
        
        .oxy-empty-icon {
          margin-bottom: 24px;
          color: #d1d5db;
        }
        
        .oxy-empty-title {
          font-family: "Instrument Serif", Georgia, serif;
          font-size: 32px;
          font-weight: 400;
          color: #1a1a1a;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }
        
        .oxy-empty-subtitle {
          font-size: 15px;
          color: #9ca3af;
          margin-bottom: 32px;
        }
        
        .oxy-suggestions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }
        
        .oxy-chip {
          padding: 10px 18px;
          border-radius: 100px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.9);
          font-size: 13px;
          font-family: inherit;
          color: #666;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .oxy-chip:hover {
          background: #fff;
          border-color: rgba(0,0,0,0.15);
          transform: translateY(-1px);
        }
        
        .oxy-messages {
          max-width: 720px;
          margin: 0 auto;
          padding: 24px 0;
        }
        
        .oxy-msg-row {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          animation: fadeInUp 0.4s ease forwards;
        }
        
        .oxy-msg-user {
          justify-content: flex-end;
        }
        
        .oxy-avatar {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }
        
        .oxy-bubble {
          max-width: 80%;
          padding: 14px 18px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.6;
        }
        
        .oxy-bubble p {
          white-space: pre-wrap;
        }
        
        .oxy-bubble-user {
          background: #1a1a1a;
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        
        .oxy-bubble-ai {
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(0,0,0,0.06);
          color: #1a1a1a;
          border-bottom-left-radius: 4px;
        }
        
        .oxy-typing {
          display: flex;
          gap: 4px;
          padding: 4px 0;
        }
        
        .oxy-typing span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #9ca3af;
          animation: pulse 1s ease infinite;
        }
        
        .oxy-typing span:nth-child(2) { animation-delay: 150ms; }
        .oxy-typing span:nth-child(3) { animation-delay: 300ms; }
        
        .oxy-input-area {
          padding: 16px 24px 24px;
        }
        
        .oxy-input-wrap {
          max-width: 720px;
          margin: 0 auto;
          position: relative;
        }
        
        .oxy-mention-pop {
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          margin-bottom: 8px;
          background: #fff;
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          overflow: hidden;
          animation: fadeInUp 0.2s ease forwards;
        }
        
        .oxy-mention-header {
          padding: 12px 16px 8px;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #9ca3af;
        }
        
        .oxy-mention-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background 0.15s ease;
        }
        
        .oxy-mention-item:hover {
          background: rgba(0,0,0,0.03);
        }
        
        .oxy-mention-item svg {
          opacity: 0.5;
        }
        
        .oxy-mention-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .oxy-mention-title {
          font-size: 13px;
          font-weight: 500;
          color: #1a1a1a;
        }
        
        .oxy-mention-date {
          font-size: 11px;
          color: #9ca3af;
        }
        
        .oxy-input-field {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 20px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          transition: all 0.2s ease;
        }
        
        .oxy-input-field:focus-within {
          border-color: rgba(0,0,0,0.15);
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        
        .oxy-input-field textarea {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 14px;
          line-height: 1.5;
          resize: none;
          font-family: inherit;
          color: #1a1a1a;
          max-height: 120px;
        }
        
        .oxy-input-field textarea:focus {
          outline: none;
        }
        
        .oxy-input-field textarea::placeholder {
          color: #9ca3af;
        }
        
        .oxy-input-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .oxy-hint {
          font-size: 11px;
          color: #d1d5db;
        }
        
        .oxy-send {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: none;
          background: #1a1a1a;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .oxy-send:hover:not(:disabled) {
          background: #333;
          transform: scale(1.05);
        }
        
        .oxy-sidebar {
          width: 300px;
          border-left: 1px solid rgba(0,0,0,0.04);
          background: rgba(255,255,255,0.5);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s ease forwards;
        }
        
        .oxy-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 20px 16px;
        }
        
        .oxy-sidebar-header h2 {
          font-size: 13px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #9ca3af;
        }
        
        .oxy-search {
          position: relative;
          padding: 0 16px 16px;
        }
        
        .oxy-search svg {
          position: absolute;
          left: 28px;
          top: 10px;
          color: #9ca3af;
        }
        
        .oxy-search input {
          width: 100%;
          padding: 10px 12px 10px 36px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.06);
          background: rgba(255,255,255,0.8);
          font-size: 13px;
          font-family: inherit;
          color: #1a1a1a;
          transition: all 0.2s ease;
        }
        
        .oxy-search input:focus {
          outline: none;
          border-color: rgba(0,0,0,0.12);
          background: #fff;
        }
        
        .oxy-search input::placeholder {
          color: #9ca3af;
        }
        
        .oxy-transcript-list {
          flex: 1;
          overflow: auto;
          padding: 0 12px;
        }
        
        .oxy-transcript {
          display: flex;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.15s ease;
          margin-bottom: 4px;
          animation: fadeInUp 0.4s ease forwards;
        }
        
        .oxy-transcript:hover {
          background: rgba(0,0,0,0.03);
        }
        
        .oxy-transcript-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(0,0,0,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          flex-shrink: 0;
        }
        
        .oxy-transcript-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        
        .oxy-transcript-title {
          font-size: 13px;
          font-weight: 500;
          color: #1a1a1a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .oxy-transcript-meta {
          font-size: 11px;
          color: #9ca3af;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        ::-webkit-scrollbar {
          width: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
