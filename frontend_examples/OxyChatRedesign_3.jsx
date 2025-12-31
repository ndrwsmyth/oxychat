import React, { useState, useEffect, useRef } from 'react';

const mockTranscripts = [
  { id: '1', title: 'Q4 Planning Session', date: 'Dec 28', duration: '47m', initials: 'Q4' },
  { id: '2', title: 'Design Review', date: 'Dec 27', duration: '32m', initials: 'DR' },
  { id: '3', title: 'Client Kickoff', date: 'Dec 26', duration: '58m', initials: 'CK' },
  { id: '4', title: 'Sprint Retrospective', date: 'Dec 24', duration: '25m', initials: 'SR' },
];

// Waveform SVG component
const Waveform = ({ animated = false, className = '' }) => (
  <svg viewBox="0 0 24 16" fill="currentColor" className={className}>
    <rect x="1" y="6" width="2" height="4" rx="1" style={animated ? {animation: 'wave 1s ease infinite'} : {}}>
      {animated && <animate attributeName="height" values="4;10;4" dur="1s" repeatCount="indefinite"/>}
      {animated && <animate attributeName="y" values="6;3;6" dur="1s" repeatCount="indefinite"/>}
    </rect>
    <rect x="5" y="4" width="2" height="8" rx="1" style={animated ? {animation: 'wave 1s ease infinite 0.1s'} : {}}>
      {animated && <animate attributeName="height" values="8;4;8" dur="1s" repeatCount="indefinite" begin="0.1s"/>}
      {animated && <animate attributeName="y" values="4;6;4" dur="1s" repeatCount="indefinite" begin="0.1s"/>}
    </rect>
    <rect x="9" y="2" width="2" height="12" rx="1" style={animated ? {animation: 'wave 1s ease infinite 0.2s'} : {}}>
      {animated && <animate attributeName="height" values="12;6;12" dur="1s" repeatCount="indefinite" begin="0.2s"/>}
      {animated && <animate attributeName="y" values="2;5;2" dur="1s" repeatCount="indefinite" begin="0.2s"/>}
    </rect>
    <rect x="13" y="3" width="2" height="10" rx="1" style={animated ? {animation: 'wave 1s ease infinite 0.3s'} : {}}>
      {animated && <animate attributeName="height" values="10;5;10" dur="1s" repeatCount="indefinite" begin="0.3s"/>}
      {animated && <animate attributeName="y" values="3;5.5;3" dur="1s" repeatCount="indefinite" begin="0.3s"/>}
    </rect>
    <rect x="17" y="5" width="2" height="6" rx="1" style={animated ? {animation: 'wave 1s ease infinite 0.4s'} : {}}>
      {animated && <animate attributeName="height" values="6;10;6" dur="1s" repeatCount="indefinite" begin="0.4s"/>}
      {animated && <animate attributeName="y" values="5;3;5" dur="1s" repeatCount="indefinite" begin="0.4s"/>}
    </rect>
    <rect x="21" y="6" width="2" height="4" rx="1">
      {animated && <animate attributeName="height" values="4;8;4" dur="1s" repeatCount="indefinite" begin="0.5s"/>}
      {animated && <animate attributeName="y" values="6;4;6" dur="1s" repeatCount="indefinite" begin="0.5s"/>}
    </rect>
  </svg>
);

export default function OxyChat() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setInputValue('');
    setIsTyping(true);
    
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'From the Q4 Planning Session, three key decisions emerged:\n\nFirst, engineering will expand with four senior developers, recruiting to begin in January. Second, the product launch shifts to February 15th for additional QA. Third, Acme Corp partnership discussions continue with a mid-January decision deadline.\n\nWould you like me to pull the exact quotes from the transcript?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 2000);
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
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  return (
    <div className="oxy-root">
      <div className="oxy-layout">
        {/* Navigation rail */}
        <nav className="oxy-rail">
          <div className="oxy-rail-top">
            <div className="oxy-logo">
              <Waveform />
            </div>
          </div>
          
          <div className="oxy-rail-middle">
            <button className="oxy-rail-btn active" title="Chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </button>
            <button className="oxy-rail-btn" title="Search">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
            <button className="oxy-rail-btn" title="Library" onClick={() => setShowSidebar(!showSidebar)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </button>
          </div>
          
          <div className="oxy-rail-bottom">
            <button className="oxy-rail-btn" title="Settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            </button>
          </div>
        </nav>

        {/* Main content */}
        <main className="oxy-main">
          <div className="oxy-content">
            {messages.length === 0 ? (
              <div className="oxy-welcome">
                <div className="oxy-welcome-header">
                  <span className="oxy-welcome-time">Good {getTimeGreeting()}</span>
                  <h1 className="oxy-welcome-title">What would you like to know?</h1>
                </div>
                
                <div className="oxy-welcome-body">
                  <p className="oxy-welcome-desc">
                    I have access to your meeting transcripts. Ask me to summarize discussions, 
                    find decisions, or recall what was said about any topic.
                  </p>
                  
                  <div className="oxy-starters">
                    <button className="oxy-starter" onClick={() => setInputValue('What decisions were made last week?')}>
                      <span className="oxy-starter-label">Decisions</span>
                      <span className="oxy-starter-text">from last week</span>
                    </button>
                    <button className="oxy-starter" onClick={() => setInputValue('What action items are assigned to me?')}>
                      <span className="oxy-starter-label">Action items</span>
                      <span className="oxy-starter-text">assigned to me</span>
                    </button>
                    <button className="oxy-starter" onClick={() => setInputValue('Summarize the Q4 planning session')}>
                      <span className="oxy-starter-label">Summarize</span>
                      <span className="oxy-starter-text">Q4 planning</span>
                    </button>
                  </div>
                </div>
                
                <div className="oxy-welcome-footer">
                  <span>Type <kbd>@</kbd> to reference a specific transcript</span>
                </div>
              </div>
            ) : (
              <div className="oxy-conversation">
                {messages.map((msg, i) => (
                  <div 
                    key={msg.id} 
                    className={`oxy-turn ${msg.role}`}
                    style={{ '--i': i }}
                  >
                    <div className="oxy-turn-meta">
                      {msg.role === 'assistant' ? (
                        <div className="oxy-turn-indicator">
                          <Waveform />
                        </div>
                      ) : (
                        <span className="oxy-turn-you">You</span>
                      )}
                      <span className="oxy-turn-time">{msg.time}</span>
                    </div>
                    <div className="oxy-turn-content">
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="oxy-turn assistant">
                    <div className="oxy-turn-meta">
                      <div className="oxy-turn-indicator">
                        <Waveform animated />
                      </div>
                    </div>
                    <div className="oxy-turn-content oxy-thinking">
                      Analyzing transcripts<span className="oxy-ellipsis"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="oxy-composer">
            {showMentions && filteredTranscripts.length > 0 && (
              <div className="oxy-mentions">
                <div className="oxy-mentions-label">Reference transcript</div>
                {filteredTranscripts.map((t, i) => (
                  <button 
                    key={t.id} 
                    className="oxy-mention"
                    onClick={() => handleMentionSelect(t)}
                    style={{ '--i': i }}
                  >
                    <span className="oxy-mention-initials">{t.initials}</span>
                    <span className="oxy-mention-title">{t.title}</span>
                    <span className="oxy-mention-date">{t.date}</span>
                  </button>
                ))}
              </div>
            )}
            
            <div className={`oxy-input-container ${inputFocused ? 'focused' : ''} ${inputValue.trim() ? 'has-content' : ''}`}>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Ask anything..."
                rows={1}
              />
              <button 
                className="oxy-send"
                onClick={handleSend}
                disabled={!inputValue.trim()}
                aria-label="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className={`oxy-sidebar ${showSidebar ? 'open' : ''}`}>
          <div className="oxy-sidebar-head">
            <h2>Transcripts</h2>
            <button className="oxy-sidebar-action">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          </div>
          
          <div className="oxy-sidebar-search">
            <input type="text" placeholder="Search..." />
          </div>

          <div className="oxy-transcripts">
            {mockTranscripts.map((t, i) => (
              <button 
                key={t.id} 
                className="oxy-transcript"
                style={{ '--i': i }}
              >
                <span className="oxy-transcript-initials">{t.initials}</span>
                <div className="oxy-transcript-info">
                  <span className="oxy-transcript-title">{t.title}</span>
                  <span className="oxy-transcript-meta">{t.date} · {t.duration}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&display=swap');
        
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        .oxy-root {
          --ink: #1a1a1a;
          --ink-secondary: #5c5c5c;
          --ink-tertiary: #8c8c8c;
          --ink-faint: #b8b8b8;
          --paper: #fafafa;
          --paper-warm: #f5f4f2;
          --paper-elevated: #ffffff;
          --teal: #2d4a47;
          --teal-soft: #e8eeec;
          --teal-wash: #f4f7f6;
          --line: rgba(0,0,0,0.08);
          --line-strong: rgba(0,0,0,0.12);
          
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--paper);
          color: var(--ink);
          height: 100vh;
          overflow: hidden;
          font-feature-settings: 'ss01' on, 'ss02' on;
          -webkit-font-smoothing: antialiased;
        }
        
        .oxy-layout {
          display: grid;
          grid-template-columns: 64px 1fr auto;
          height: 100%;
        }
        
        /* Navigation Rail */
        .oxy-rail {
          background: var(--paper-warm);
          border-right: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 0;
        }
        
        .oxy-rail-top {
          padding-bottom: 24px;
          border-bottom: 1px solid var(--line);
          margin-bottom: 16px;
        }
        
        .oxy-logo {
          width: 32px;
          height: 32px;
          color: var(--teal);
        }
        
        .oxy-logo svg {
          width: 100%;
          height: 100%;
        }
        
        .oxy-rail-middle {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        
        .oxy-rail-bottom {
          padding-top: 16px;
          border-top: 1px solid var(--line);
          margin-top: 16px;
        }
        
        .oxy-rail-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: var(--ink-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .oxy-rail-btn:hover {
          background: var(--line);
          color: var(--ink-secondary);
        }
        
        .oxy-rail-btn.active {
          background: var(--teal);
          color: white;
        }
        
        /* Main content */
        .oxy-main {
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: var(--paper);
        }
        
        .oxy-content {
          flex: 1;
          overflow-y: auto;
          padding: 48px;
        }
        
        /* Welcome state */
        .oxy-welcome {
          max-width: 600px;
          animation: fadeUp 0.6s ease;
        }
        
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .oxy-welcome-header {
          margin-bottom: 32px;
        }
        
        .oxy-welcome-time {
          font-size: 13px;
          font-weight: 500;
          color: var(--teal);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          display: block;
          margin-bottom: 12px;
        }
        
        .oxy-welcome-title {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 36px;
          font-weight: 400;
          line-height: 1.2;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        
        .oxy-welcome-body {
          padding: 32px 0;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }
        
        .oxy-welcome-desc {
          font-size: 15px;
          line-height: 1.7;
          color: var(--ink-secondary);
          margin-bottom: 32px;
          max-width: 480px;
        }
        
        .oxy-starters {
          display: flex;
          gap: 12px;
        }
        
        .oxy-starter {
          flex: 1;
          padding: 20px;
          background: var(--paper-elevated);
          border: 1px solid var(--line);
          border-radius: 16px;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: all 0.25s ease;
        }
        
        .oxy-starter:hover {
          border-color: var(--teal);
          background: var(--teal-wash);
        }
        
        .oxy-starter-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 4px;
        }
        
        .oxy-starter-text {
          font-size: 13px;
          color: var(--ink-tertiary);
        }
        
        .oxy-welcome-footer {
          padding-top: 24px;
          font-size: 13px;
          color: var(--ink-tertiary);
        }
        
        .oxy-welcome-footer kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          background: var(--paper-elevated);
          border: 1px solid var(--line-strong);
          border-radius: 6px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink);
          margin: 0 2px;
          box-shadow: 0 1px 0 var(--line-strong);
        }
        
        /* Conversation */
        .oxy-conversation {
          max-width: 680px;
        }
        
        .oxy-turn {
          margin-bottom: 40px;
          animation: turnFade 0.4s ease backwards;
          animation-delay: calc(var(--i) * 0.05s);
        }
        
        @keyframes turnFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .oxy-turn-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        
        .oxy-turn-indicator {
          width: 20px;
          height: 14px;
          color: var(--teal);
        }
        
        .oxy-turn-indicator svg {
          width: 100%;
          height: 100%;
        }
        
        .oxy-turn-you {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink);
        }
        
        .oxy-turn-time {
          font-size: 12px;
          color: var(--ink-faint);
        }
        
        .oxy-turn-content {
          font-size: 15px;
          line-height: 1.75;
          color: var(--ink);
          white-space: pre-wrap;
        }
        
        .oxy-turn.user .oxy-turn-content {
          color: var(--ink-secondary);
        }
        
        .oxy-turn.assistant .oxy-turn-content {
          padding-left: 32px;
          border-left: 2px solid var(--teal-soft);
        }
        
        .oxy-thinking {
          color: var(--ink-tertiary);
          font-style: italic;
        }
        
        .oxy-ellipsis::after {
          content: '';
          animation: ellipsis 1.5s infinite;
        }
        
        @keyframes ellipsis {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }
        
        /* Composer */
        .oxy-composer {
          padding: 24px 48px 32px;
          position: relative;
        }
        
        .oxy-mentions {
          position: absolute;
          bottom: 100%;
          left: 48px;
          right: 48px;
          max-width: 400px;
          background: var(--paper-elevated);
          border: 1px solid var(--line);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.08);
          padding: 8px;
          margin-bottom: 8px;
          animation: mentionUp 0.2s ease;
        }
        
        @keyframes mentionUp {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .oxy-mentions-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-tertiary);
          padding: 8px 12px 12px;
        }
        
        .oxy-mention {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          background: none;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
          animation: mentionFade 0.2s ease backwards;
          animation-delay: calc(var(--i) * 0.03s);
        }
        
        @keyframes mentionFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .oxy-mention:hover {
          background: var(--teal-wash);
        }
        
        .oxy-mention-initials {
          width: 32px;
          height: 32px;
          background: var(--teal-soft);
          color: var(--teal);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        
        .oxy-mention-title {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
        }
        
        .oxy-mention-date {
          font-size: 12px;
          color: var(--ink-tertiary);
        }
        
        .oxy-input-container {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          max-width: 680px;
          padding: 4px 4px 4px 20px;
          background: var(--paper-elevated);
          border: 1px solid var(--line);
          border-radius: 20px;
          transition: all 0.25s ease;
        }
        
        .oxy-input-container.focused {
          border-color: var(--teal);
          box-shadow: 0 0 0 3px var(--teal-soft);
        }
        
        .oxy-input-container textarea {
          flex: 1;
          border: none;
          background: none;
          font-family: inherit;
          font-size: 15px;
          line-height: 1.5;
          color: var(--ink);
          resize: none;
          padding: 12px 0;
          max-height: 160px;
        }
        
        .oxy-input-container textarea:focus {
          outline: none;
        }
        
        .oxy-input-container textarea::placeholder {
          color: var(--ink-faint);
        }
        
        .oxy-send {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          border: none;
          background: var(--paper-warm);
          color: var(--ink-faint);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        
        .oxy-input-container.has-content .oxy-send {
          background: var(--teal);
          color: white;
        }
        
        .oxy-input-container.has-content .oxy-send:hover {
          transform: translateX(2px);
        }
        
        .oxy-send:disabled {
          cursor: default;
        }
        
        /* Sidebar */
        .oxy-sidebar {
          width: 280px;
          background: var(--paper-elevated);
          border-left: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .oxy-sidebar.open {
          transform: translateX(0);
        }
        
        .oxy-sidebar-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid var(--line);
        }
        
        .oxy-sidebar-head h2 {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }
        
        .oxy-sidebar-action {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: none;
          color: var(--ink-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .oxy-sidebar-action:hover {
          border-color: var(--teal);
          color: var(--teal);
        }
        
        .oxy-sidebar-search {
          padding: 16px 20px;
        }
        
        .oxy-sidebar-search input {
          width: 100%;
          padding: 10px 14px;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 10px;
          font-family: inherit;
          font-size: 13px;
          color: var(--ink);
          transition: all 0.2s ease;
        }
        
        .oxy-sidebar-search input:focus {
          outline: none;
          border-color: var(--teal);
        }
        
        .oxy-sidebar-search input::placeholder {
          color: var(--ink-faint);
        }
        
        .oxy-transcripts {
          flex: 1;
          overflow-y: auto;
          padding: 0 12px;
        }
        
        .oxy-transcript {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px;
          background: none;
          border: none;
          border-radius: 12px;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
          animation: transcriptFade 0.3s ease backwards;
          animation-delay: calc(var(--i) * 0.05s);
        }
        
        @keyframes transcriptFade {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .oxy-transcript:hover {
          background: var(--teal-wash);
        }
        
        .oxy-transcript-initials {
          width: 36px;
          height: 36px;
          background: var(--teal-soft);
          color: var(--teal);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          flex-shrink: 0;
        }
        
        .oxy-transcript-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .oxy-transcript-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .oxy-transcript-meta {
          font-size: 12px;
          color: var(--ink-tertiary);
        }
        
        /* Scrollbar */
        .oxy-root ::-webkit-scrollbar {
          width: 6px;
        }
        
        .oxy-root ::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .oxy-root ::-webkit-scrollbar-thumb {
          background: var(--line-strong);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
