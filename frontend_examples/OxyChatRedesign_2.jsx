import React, { useState, useEffect, useRef } from 'react';

const mockTranscripts = [
  { id: '1', title: 'Q4 Planning Session', date: 'Dec 28', duration: '47 min', participants: 4 },
  { id: '2', title: 'Design Review', date: 'Dec 27', duration: '32 min', participants: 3 },
  { id: '3', title: 'Client Kickoff', date: 'Dec 26', duration: '58 min', participants: 6 },
  { id: '4', title: 'Sprint Retrospective', date: 'Dec 24', duration: '25 min', participants: 5 },
];

export default function OxyChat() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      if (query.includes(' ') || query.includes('\n')) {
        setShowMentions(false);
      } else {
        setMentionQuery(query);
      }
    }
  };

  const handleMentionSelect = (transcript) => {
    const lastAtIndex = inputValue.lastIndexOf('@');
    setInputValue(inputValue.slice(0, lastAtIndex) + `@${transcript.title} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    }]);
    setInputValue('');
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Based on the Q4 Planning Session, there were three key decisions made:\n\n1. Engineering headcount will increase by 4 senior developers, with recruiting starting in January.\n\n2. The product launch timeline has been moved to February 15th to allow for additional QA cycles.\n\n3. The partnership discussions with Acme Corp will continue, with a decision deadline set for mid-January.',
      }]);
    }, 1800);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') setShowMentions(false);
  };

  const filteredTranscripts = mockTranscripts.filter(t => 
    t.title.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className={`oxy ${isDark ? 'dark' : ''}`}>
      {/* Noise texture overlay */}
      <div className="oxy-noise" />
      
      {/* Gradient orbs */}
      <div className="oxy-orb oxy-orb-1" />
      <div className="oxy-orb oxy-orb-2" />
      
      <div className="oxy-layout">
        {/* Main area */}
        <main className="oxy-main">
          {/* Header */}
          <header className="oxy-header">
            <div className="oxy-brand">
              <div className="oxy-logo">
                <svg viewBox="0 0 32 32" fill="none">
                  <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <circle cx="16" cy="16" r="4" fill="currentColor"/>
                </svg>
              </div>
              <div className="oxy-brand-text">
                <span className="oxy-brand-name">Oxy</span>
                <span className="oxy-brand-tag">Transcript Intelligence</span>
              </div>
            </div>
            
            <div className="oxy-header-actions">
              <button 
                className="oxy-theme-toggle"
                onClick={() => setIsDark(!isDark)}
                aria-label="Toggle theme"
              >
                <div className="oxy-theme-track">
                  <div className={`oxy-theme-thumb ${isDark ? 'dark' : ''}`}>
                    {isDark ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="5"/>
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                      </svg>
                    )}
                  </div>
                </div>
              </button>
              
              <button 
                className={`oxy-sidebar-toggle ${showSidebar ? 'active' : ''}`}
                onClick={() => setShowSidebar(!showSidebar)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <path d="M9 3v18"/>
                </svg>
              </button>
            </div>
          </header>

          {/* Chat container */}
          <div className="oxy-chat">
            {messages.length === 0 ? (
              <div className="oxy-welcome">
                <div className="oxy-welcome-content">
                  <div className="oxy-welcome-badge">Ready to assist</div>
                  <h1 className="oxy-welcome-title">
                    {getTimeGreeting()}, <span className="oxy-welcome-name">Andrew</span>
                  </h1>
                  <p className="oxy-welcome-sub">
                    Ask me anything about your meetings. I can summarize discussions, 
                    find action items, or help you recall specific details.
                  </p>
                  
                  <div className="oxy-prompts">
                    <button className="oxy-prompt" onClick={() => setInputValue('What were the key decisions from last week?')}>
                      <span className="oxy-prompt-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      </span>
                      <span className="oxy-prompt-text">Key decisions from last week</span>
                    </button>
                    <button className="oxy-prompt" onClick={() => setInputValue('Find all action items assigned to me')}>
                      <span className="oxy-prompt-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        </svg>
                      </span>
                      <span className="oxy-prompt-text">My action items</span>
                    </button>
                    <button className="oxy-prompt" onClick={() => setInputValue('Summarize the Q4 planning session')}>
                      <span className="oxy-prompt-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                      </span>
                      <span className="oxy-prompt-text">Summarize Q4 planning</span>
                    </button>
                  </div>
                </div>
                
                <div className="oxy-welcome-hint">
                  <kbd>@</kbd> to reference transcripts
                </div>
              </div>
            ) : (
              <div className="oxy-messages">
                {messages.map((msg, i) => (
                  <div 
                    key={msg.id} 
                    className={`oxy-message ${msg.role}`}
                    style={{ '--delay': `${i * 0.05}s` }}
                  >
                    {msg.role === 'assistant' && (
                      <div className="oxy-message-avatar">
                        <svg viewBox="0 0 32 32" fill="none">
                          <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" stroke="currentColor" strokeWidth="1.5"/>
                          <circle cx="16" cy="16" r="4" fill="currentColor"/>
                        </svg>
                      </div>
                    )}
                    <div className="oxy-message-content">
                      <div className="oxy-message-bubble">
                        {msg.content}
                      </div>
                      <span className="oxy-message-time">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="oxy-message assistant">
                    <div className="oxy-message-avatar">
                      <svg viewBox="0 0 32 32" fill="none">
                        <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" stroke="currentColor" strokeWidth="1.5"/>
                        <circle cx="16" cy="16" r="4" fill="currentColor"/>
                      </svg>
                    </div>
                    <div className="oxy-message-content">
                      <div className="oxy-message-bubble">
                        <div className="oxy-typing-indicator">
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="oxy-composer">
            <div className={`oxy-composer-container ${inputFocused ? 'focused' : ''}`}>
              {showMentions && filteredTranscripts.length > 0 && (
                <div className="oxy-mentions">
                  <div className="oxy-mentions-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span>Transcripts</span>
                  </div>
                  {filteredTranscripts.map((t, i) => (
                    <button 
                      key={t.id} 
                      className="oxy-mention-item"
                      onClick={() => handleMentionSelect(t)}
                      style={{ '--delay': `${i * 30}ms` }}
                    >
                      <div className="oxy-mention-info">
                        <span className="oxy-mention-title">{t.title}</span>
                        <span className="oxy-mention-meta">
                          {t.date} · {t.duration} · {t.participants} participants
                        </span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="oxy-mention-arrow">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="oxy-input-row">
                <div className="oxy-input-wrapper">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="Ask about your meetings..."
                    rows={1}
                  />
                </div>
                
                <button 
                  className={`oxy-send ${inputValue.trim() ? 'active' : ''}`}
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className={`oxy-sidebar ${showSidebar ? 'open' : ''}`}>
          <div className="oxy-sidebar-header">
            <h2>Your Library</h2>
            <span className="oxy-sidebar-count">{mockTranscripts.length}</span>
          </div>
          
          <div className="oxy-sidebar-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Search transcripts..." />
          </div>

          <div className="oxy-transcript-list">
            {mockTranscripts.map((t, i) => (
              <div 
                key={t.id} 
                className="oxy-transcript"
                style={{ '--delay': `${i * 50}ms` }}
              >
                <div className="oxy-transcript-header">
                  <h3>{t.title}</h3>
                  <span className="oxy-transcript-date">{t.date}</span>
                </div>
                <div className="oxy-transcript-meta">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {t.duration}
                  </span>
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {t.participants}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <button className="oxy-upload">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Upload transcript</span>
          </button>
        </aside>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap');
        
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        .oxy {
          --bg: #F7F6F3;
          --bg-elevated: #FFFFFF;
          --bg-subtle: #EFEEE9;
          --text: #1C1917;
          --text-secondary: #78716C;
          --text-tertiary: #A8A29E;
          --accent: #B45309;
          --accent-soft: #FEF3C7;
          --border: rgba(28, 25, 23, 0.08);
          --border-strong: rgba(28, 25, 23, 0.15);
          --shadow: 0 1px 3px rgba(28, 25, 23, 0.04), 0 4px 12px rgba(28, 25, 23, 0.06);
          --shadow-lg: 0 4px 6px rgba(28, 25, 23, 0.02), 0 12px 40px rgba(28, 25, 23, 0.1);
          --radius: 16px;
          --radius-sm: 10px;
          --radius-lg: 24px;
          
          font-family: 'Outfit', -apple-system, sans-serif;
          background: var(--bg);
          color: var(--text);
          height: 100vh;
          overflow: hidden;
          position: relative;
          transition: background 0.4s ease, color 0.4s ease;
        }
        
        .oxy.dark {
          --bg: #171412;
          --bg-elevated: #231F1C;
          --bg-subtle: #2A2522;
          --text: #F5F5F4;
          --text-secondary: #A8A29E;
          --text-tertiary: #78716C;
          --accent: #F59E0B;
          --accent-soft: rgba(245, 158, 11, 0.15);
          --border: rgba(255, 255, 255, 0.08);
          --border-strong: rgba(255, 255, 255, 0.15);
          --shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.3);
          --shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.1), 0 12px 40px rgba(0, 0, 0, 0.4);
        }
        
        /* Noise texture */
        .oxy-noise {
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          opacity: 0.03;
          pointer-events: none;
          z-index: 1000;
        }
        
        .dark .oxy-noise {
          opacity: 0.05;
        }
        
        /* Gradient orbs */
        .oxy-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          opacity: 0.5;
          transition: opacity 0.6s ease;
        }
        
        .oxy-orb-1 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(180, 83, 9, 0.12) 0%, transparent 70%);
          top: -200px;
          right: -100px;
        }
        
        .oxy-orb-2 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(120, 53, 15, 0.08) 0%, transparent 70%);
          bottom: -150px;
          left: -100px;
        }
        
        .dark .oxy-orb-1 {
          background: radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%);
        }
        
        .dark .oxy-orb-2 {
          background: radial-gradient(circle, rgba(180, 83, 9, 0.06) 0%, transparent 70%);
        }
        
        /* Layout */
        .oxy-layout {
          display: flex;
          height: 100%;
          position: relative;
          z-index: 1;
        }
        
        .oxy-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        
        /* Header */
        .oxy-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
          position: relative;
          z-index: 10;
        }
        
        .oxy-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .oxy-logo {
          width: 36px;
          height: 36px;
          color: var(--accent);
          transition: transform 0.3s ease;
        }
        
        .oxy-logo:hover {
          transform: rotate(30deg);
        }
        
        .oxy-logo svg {
          width: 100%;
          height: 100%;
        }
        
        .oxy-brand-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        
        .oxy-brand-name {
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.02em;
        }
        
        .oxy-brand-tag {
          font-size: 11px;
          color: var(--text-tertiary);
          letter-spacing: 0.02em;
        }
        
        .oxy-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .oxy-theme-toggle {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
        }
        
        .oxy-theme-track {
          width: 44px;
          height: 24px;
          background: var(--bg-subtle);
          border-radius: 12px;
          padding: 2px;
          transition: background 0.3s ease;
        }
        
        .oxy-theme-thumb {
          width: 20px;
          height: 20px;
          background: var(--bg-elevated);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .oxy-theme-thumb.dark {
          transform: translateX(20px);
        }
        
        .oxy-sidebar-toggle {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .oxy-sidebar-toggle:hover {
          border-color: var(--border-strong);
          color: var(--text);
        }
        
        .oxy-sidebar-toggle.active {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent);
        }
        
        /* Chat area */
        .oxy-chat {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }
        
        /* Welcome state */
        .oxy-welcome {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
          animation: welcomeFade 0.8s ease forwards;
        }
        
        @keyframes welcomeFade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .oxy-welcome-content {
          max-width: 520px;
        }
        
        .oxy-welcome-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 12px;
          font-weight: 500;
          border-radius: 100px;
          margin-bottom: 20px;
          animation: welcomeFade 0.6s ease 0.1s backwards;
        }
        
        .oxy-welcome-badge::before {
          content: '';
          width: 6px;
          height: 6px;
          background: var(--accent);
          border-radius: 50%;
          animation: pulse 2s ease infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        
        .oxy-welcome-title {
          font-family: 'Newsreader', Georgia, serif;
          font-size: 42px;
          font-weight: 400;
          line-height: 1.2;
          letter-spacing: -0.02em;
          margin-bottom: 12px;
          animation: welcomeFade 0.6s ease 0.15s backwards;
        }
        
        .oxy-welcome-name {
          color: var(--accent);
          font-style: italic;
        }
        
        .oxy-welcome-sub {
          font-size: 16px;
          line-height: 1.6;
          color: var(--text-secondary);
          margin-bottom: 36px;
          animation: welcomeFade 0.6s ease 0.2s backwards;
        }
        
        .oxy-prompts {
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: welcomeFade 0.6s ease 0.25s backwards;
        }
        
        .oxy-prompt {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 14px;
          color: var(--text);
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }
        
        .oxy-prompt:hover {
          border-color: var(--accent);
          background: var(--accent-soft);
          transform: translateX(4px);
        }
        
        .oxy-prompt-icon {
          width: 32px;
          height: 32px;
          background: var(--bg-subtle);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          transition: all 0.2s ease;
        }
        
        .oxy-prompt:hover .oxy-prompt-icon {
          background: var(--accent);
          color: white;
        }
        
        .oxy-prompt-text {
          flex: 1;
        }
        
        .oxy-welcome-hint {
          margin-top: 48px;
          font-size: 13px;
          color: var(--text-tertiary);
          animation: welcomeFade 0.6s ease 0.4s backwards;
        }
        
        .oxy-welcome-hint kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          padding: 0 8px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 6px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          margin-right: 4px;
        }
        
        /* Messages */
        .oxy-messages {
          max-width: 760px;
          margin: 0 auto;
          padding: 24px;
        }
        
        .oxy-message {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          animation: messageFade 0.4s ease calc(var(--delay)) backwards;
        }
        
        @keyframes messageFade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .oxy-message.user {
          flex-direction: row-reverse;
        }
        
        .oxy-message-avatar {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          color: var(--accent);
        }
        
        .oxy-message-avatar svg {
          width: 100%;
          height: 100%;
        }
        
        .oxy-message-content {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-width: 75%;
        }
        
        .oxy-message.user .oxy-message-content {
          align-items: flex-end;
        }
        
        .oxy-message-bubble {
          padding: 14px 18px;
          font-size: 14px;
          line-height: 1.65;
          white-space: pre-wrap;
          border-radius: var(--radius);
        }
        
        .oxy-message.user .oxy-message-bubble {
          background: var(--text);
          color: var(--bg);
          border-bottom-right-radius: 4px;
        }
        
        .oxy-message.assistant .oxy-message-bubble {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-bottom-left-radius: 4px;
        }
        
        .oxy-message-time {
          font-size: 11px;
          color: var(--text-tertiary);
          padding: 0 4px;
        }
        
        /* Typing indicator */
        .oxy-typing-indicator {
          display: flex;
          gap: 4px;
          padding: 4px 0;
        }
        
        .oxy-typing-indicator span {
          width: 6px;
          height: 6px;
          background: var(--text-tertiary);
          border-radius: 50%;
          animation: typing 1.4s ease infinite;
        }
        
        .oxy-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .oxy-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        
        /* Composer */
        .oxy-composer {
          padding: 16px 24px 24px;
          background: linear-gradient(to top, var(--bg) 80%, transparent);
        }
        
        .oxy-composer-container {
          max-width: 760px;
          margin: 0 auto;
          position: relative;
        }
        
        .oxy-composer-container.focused .oxy-input-row {
          border-color: var(--accent);
          box-shadow: var(--shadow-lg), 0 0 0 3px var(--accent-soft);
        }
        
        /* Mentions dropdown */
        .oxy-mentions {
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          margin-bottom: 8px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          animation: mentionSlide 0.2s ease;
        }
        
        @keyframes mentionSlide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .oxy-mentions-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px 8px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-tertiary);
        }
        
        .oxy-mention-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 12px 16px;
          background: none;
          border: none;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
          animation: mentionFade 0.2s ease calc(var(--delay)) backwards;
        }
        
        @keyframes mentionFade {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .oxy-mention-item:hover {
          background: var(--bg-subtle);
        }
        
        .oxy-mention-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .oxy-mention-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
        }
        
        .oxy-mention-meta {
          font-size: 12px;
          color: var(--text-tertiary);
        }
        
        .oxy-mention-arrow {
          color: var(--text-tertiary);
          opacity: 0;
          transform: translateX(-4px);
          transition: all 0.2s ease;
        }
        
        .oxy-mention-item:hover .oxy-mention-arrow {
          opacity: 1;
          transform: translateX(0);
        }
        
        /* Input row */
        .oxy-input-row {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          padding: 8px 8px 8px 20px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow);
          transition: all 0.25s ease;
        }
        
        .oxy-input-wrapper {
          flex: 1;
          min-width: 0;
        }
        
        .oxy-input-wrapper textarea {
          width: 100%;
          background: none;
          border: none;
          font-family: inherit;
          font-size: 15px;
          line-height: 1.5;
          color: var(--text);
          resize: none;
          padding: 10px 0;
          max-height: 150px;
        }
        
        .oxy-input-wrapper textarea:focus {
          outline: none;
        }
        
        .oxy-input-wrapper textarea::placeholder {
          color: var(--text-tertiary);
        }
        
        .oxy-send {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          border: none;
          background: var(--bg-subtle);
          color: var(--text-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          flex-shrink: 0;
        }
        
        .oxy-send.active {
          background: var(--accent);
          color: white;
          transform: scale(1);
        }
        
        .oxy-send.active:hover {
          transform: scale(1.05);
        }
        
        .oxy-send:disabled {
          cursor: default;
        }
        
        /* Sidebar */
        .oxy-sidebar {
          width: 320px;
          background: var(--bg-elevated);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          opacity: 0;
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .oxy-sidebar.open {
          transform: translateX(0);
          opacity: 1;
        }
        
        .oxy-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 20px 16px;
        }
        
        .oxy-sidebar-header h2 {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-tertiary);
        }
        
        .oxy-sidebar-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 11px;
          font-weight: 600;
          border-radius: 10px;
        }
        
        .oxy-sidebar-search {
          position: relative;
          padding: 0 16px 16px;
        }
        
        .oxy-sidebar-search svg {
          position: absolute;
          left: 30px;
          top: 12px;
          color: var(--text-tertiary);
        }
        
        .oxy-sidebar-search input {
          width: 100%;
          padding: 12px 12px 12px 42px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: 13px;
          color: var(--text);
          transition: all 0.2s ease;
        }
        
        .oxy-sidebar-search input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        
        .oxy-sidebar-search input::placeholder {
          color: var(--text-tertiary);
        }
        
        .oxy-transcript-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 12px;
        }
        
        .oxy-transcript {
          padding: 14px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 4px;
          animation: transcriptFade 0.4s ease calc(var(--delay)) backwards;
        }
        
        @keyframes transcriptFade {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .oxy-transcript:hover {
          background: var(--bg-subtle);
        }
        
        .oxy-transcript-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 6px;
        }
        
        .oxy-transcript-header h3 {
          font-size: 13px;
          font-weight: 500;
          line-height: 1.3;
          color: var(--text);
        }
        
        .oxy-transcript-date {
          font-size: 11px;
          color: var(--text-tertiary);
          white-space: nowrap;
        }
        
        .oxy-transcript-meta {
          display: flex;
          gap: 12px;
        }
        
        .oxy-transcript-meta span {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-tertiary);
        }
        
        .oxy-upload {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 12px;
          padding: 14px;
          background: var(--bg);
          border: 1px dashed var(--border-strong);
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .oxy-upload:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-soft);
        }
        
        /* Scrollbar */
        .oxy ::-webkit-scrollbar {
          width: 6px;
        }
        
        .oxy ::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .oxy ::-webkit-scrollbar-thumb {
          background: var(--border-strong);
          border-radius: 3px;
        }
        
        .oxy ::-webkit-scrollbar-thumb:hover {
          background: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}
