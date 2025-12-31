import React, { useState, useEffect, useRef, useCallback } from 'react';

const transcripts = [
  { id: '1', title: 'Q4 Planning Session', when: '3 days ago' },
  { id: '2', title: 'Design Review', when: '4 days ago' },
  { id: '3', title: 'Client Kickoff', when: '5 days ago' },
  { id: '4', title: 'Sprint Retrospective', when: '1 week ago' },
];

export default function Oxy() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [focusedInput, setFocusedInput] = useState(false);
  
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleInput = (e) => {
    const val = e.target.value;
    setInput(val);
    
    const atIdx = val.lastIndexOf('@');
    if (atIdx !== -1) {
      const after = val.slice(atIdx + 1);
      if (!after.includes(' ') && !after.includes('\n')) {
        setShowMentions(true);
        setMentionFilter(after.toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (t) => {
    const atIdx = input.lastIndexOf('@');
    setInput(input.slice(0, atIdx) + '@' + t.title + ' ');
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const send = useCallback(() => {
    if (!input.trim() || isThinking) return;
    
    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: input.trim(),
      time: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);
    
    // Simulate response
    setTimeout(() => {
      setIsThinking(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant', 
        text: `From the Q4 Planning Session, three decisions emerged:\n\nEngineering will add four senior developers starting January. The product launch moves to February 15th. Partnership discussions with Acme Corp continue through mid-January.\n\nShall I find the specific moments where these were discussed?`,
        time: new Date()
      }]);
    }, 2200);
  }, [input, isThinking]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  const filteredTranscripts = transcripts.filter(t => 
    t.title.toLowerCase().includes(mentionFilter)
  );

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  };

  const formatTime = (d) => {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  };

  return (
    <div className="oxy" ref={containerRef}>
      {/* Ambient light gradient */}
      <div className="oxy-ambient" />
      
      {/* Library drawer */}
      <div className={`oxy-library ${showLibrary ? 'open' : ''}`}>
        <div className="oxy-library-inner">
          <div className="oxy-library-header">
            <span>Transcripts</span>
            <button onClick={() => setShowLibrary(false)} className="oxy-library-close">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="oxy-library-list">
            {transcripts.map((t, i) => (
              <button key={t.id} className="oxy-library-item" style={{'--i': i}}>
                <span className="oxy-library-title">{t.title}</span>
                <span className="oxy-library-when">{t.when}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main surface */}
      <main className="oxy-main">
        {/* Top bar - minimal */}
        <header className="oxy-bar">
          <div className="oxy-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
              <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" opacity="0.15"/>
            </svg>
            <span>Oxy</span>
          </div>
          <button className="oxy-bar-btn" onClick={() => setShowLibrary(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </button>
        </header>

        {/* Content area */}
        <div className="oxy-content">
          {messages.length === 0 ? (
            <div className="oxy-empty">
              <div className="oxy-empty-top">
                <p className="oxy-empty-time">Good {greeting()}</p>
                <h1 className="oxy-empty-title">What would you like to know?</h1>
              </div>
              
              <div className="oxy-empty-middle">
                <p className="oxy-empty-desc">
                  I can search your meeting transcripts, summarize discussions, 
                  surface decisions, and help you recall what was said.
                </p>
              </div>

              <div className="oxy-starters">
                {[
                  { label: 'Summarize', detail: 'recent meetings' },
                  { label: 'Find', detail: 'action items' },
                  { label: 'Search', detail: 'by topic' }
                ].map((s, i) => (
                  <button 
                    key={i} 
                    className="oxy-starter"
                    style={{'--i': i}}
                    onClick={() => setInput(`${s.label} ${s.detail}`)}
                  >
                    <span className="oxy-starter-label">{s.label}</span>
                    <span className="oxy-starter-detail">{s.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="oxy-thread">
              {messages.map((m, i) => (
                <div 
                  key={m.id} 
                  className={`oxy-msg oxy-msg-${m.role}`}
                  style={{'--i': i}}
                >
                  {m.role === 'assistant' && (
                    <div className="oxy-msg-indicator">
                      <span className="oxy-dot" />
                    </div>
                  )}
                  <div className="oxy-msg-body">
                    <p className="oxy-msg-text">{m.text}</p>
                    <span className="oxy-msg-time">{formatTime(m.time)}</span>
                  </div>
                </div>
              ))}
              
              {isThinking && (
                <div className="oxy-msg oxy-msg-assistant oxy-thinking">
                  <div className="oxy-msg-indicator">
                    <span className="oxy-dot oxy-dot-pulse" />
                  </div>
                  <div className="oxy-msg-body">
                    <p className="oxy-msg-text oxy-msg-thinking">Searching transcripts</p>
                  </div>
                </div>
              )}
              
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="oxy-composer">
          {/* Mentions */}
          {showMentions && filteredTranscripts.length > 0 && (
            <div className="oxy-mentions">
              {filteredTranscripts.map((t, i) => (
                <button 
                  key={t.id}
                  className="oxy-mention"
                  onClick={() => selectMention(t)}
                  style={{'--i': i}}
                >
                  <span>{t.title}</span>
                  <span className="oxy-mention-when">{t.when}</span>
                </button>
              ))}
            </div>
          )}
          
          <div className={`oxy-input-wrap ${focusedInput ? 'focused' : ''} ${input.trim() ? 'has-text' : ''}`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={onKeyDown}
              onFocus={() => setFocusedInput(true)}
              onBlur={() => setFocusedInput(false)}
              placeholder="Ask anything..."
              rows={1}
            />
            <div className="oxy-input-actions">
              <span className="oxy-hint">
                <kbd>@</kbd> to cite
              </span>
              <button 
                className="oxy-send"
                onClick={send}
                disabled={!input.trim() || isThinking}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14"/>
                  <path d="M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');
        
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .oxy {
          --black: #121212;
          --gray-900: #1a1a1a;
          --gray-800: #2e2e2e;
          --gray-700: #4a4a4a;
          --gray-600: #6a6a6a;
          --gray-500: #8a8a8a;
          --gray-400: #a3a3a3;
          --gray-300: #c2c2c2;
          --gray-200: #e0e0e0;
          --gray-100: #f0f0f0;
          --gray-50: #f8f8f7;
          --white: #fefefe;
          
          --text-primary: var(--gray-900);
          --text-secondary: var(--gray-600);
          --text-tertiary: var(--gray-500);
          --text-faint: var(--gray-400);
          
          --surface: var(--white);
          --surface-raised: var(--white);
          --surface-overlay: var(--gray-50);
          
          --border: rgba(0,0,0,0.06);
          --border-strong: rgba(0,0,0,0.1);
          
          --focus: rgba(0,0,0,0.85);
          --focus-ring: rgba(0,0,0,0.08);

          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 15px;
          line-height: 1.6;
          color: var(--text-primary);
          background: var(--surface);
          height: 100vh;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-feature-settings: 'ss01' on, 'cv01' on;
        }

        /* Ambient gradient - barely there */
        .oxy-ambient {
          position: fixed;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(255, 252, 248, 0.8) 0%,
            rgba(252, 252, 254, 0.6) 50%,
            rgba(248, 250, 252, 0.4) 100%
          );
          pointer-events: none;
          z-index: 0;
        }

        /* Library drawer */
        .oxy-library {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 320px;
          background: var(--surface);
          border-left: 1px solid var(--border);
          transform: translateX(100%);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 100;
        }

        .oxy-library.open {
          transform: translateX(0);
        }

        .oxy-library-inner {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .oxy-library-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          letter-spacing: 0.01em;
        }

        .oxy-library-close {
          width: 28px;
          height: 28px;
          border: none;
          background: none;
          color: var(--text-tertiary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.15s ease;
        }

        .oxy-library-close:hover {
          background: var(--surface-overlay);
          color: var(--text-primary);
        }

        .oxy-library-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 12px 24px;
        }

        .oxy-library-item {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 14px 16px;
          background: none;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease;
          animation: libraryIn 0.3s ease backwards;
          animation-delay: calc(var(--i) * 0.04s);
        }

        @keyframes libraryIn {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .oxy-library-item:hover {
          background: var(--surface-overlay);
        }

        .oxy-library-title {
          font-size: 14px;
          font-weight: 450;
          color: var(--text-primary);
        }

        .oxy-library-when {
          font-size: 12px;
          color: var(--text-faint);
        }

        /* Main layout */
        .oxy-main {
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          max-width: 720px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Top bar */
        .oxy-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 0;
          flex-shrink: 0;
        }

        .oxy-mark {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-primary);
        }

        .oxy-mark svg {
          opacity: 0.7;
        }

        .oxy-mark span {
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
        }

        .oxy-bar-btn {
          width: 36px;
          height: 36px;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 10px;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .oxy-bar-btn:hover {
          border-color: var(--border-strong);
          color: var(--text-primary);
        }

        /* Content */
        .oxy-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        /* Empty state */
        .oxy-empty {
          padding: 60px 0;
          animation: emptyIn 0.7s ease;
        }

        @keyframes emptyIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .oxy-empty-top {
          margin-bottom: 48px;
        }

        .oxy-empty-time {
          font-size: 13px;
          font-weight: 400;
          color: var(--text-tertiary);
          margin-bottom: 12px;
          animation: emptyItemIn 0.5s ease 0.1s backwards;
        }

        .oxy-empty-title {
          font-size: 32px;
          font-weight: 400;
          letter-spacing: -0.025em;
          line-height: 1.2;
          color: var(--text-primary);
          animation: emptyItemIn 0.5s ease 0.15s backwards;
        }

        @keyframes emptyItemIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .oxy-empty-middle {
          padding: 32px 0;
          border-top: 1px solid var(--border);
          animation: emptyItemIn 0.5s ease 0.2s backwards;
        }

        .oxy-empty-desc {
          font-size: 15px;
          line-height: 1.7;
          color: var(--text-secondary);
          max-width: 440px;
        }

        .oxy-starters {
          display: flex;
          gap: 12px;
          padding-top: 32px;
          border-top: 1px solid var(--border);
        }

        .oxy-starter {
          flex: 1;
          padding: 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: all 0.25s ease;
          animation: starterIn 0.4s ease backwards;
          animation-delay: calc(0.25s + var(--i) * 0.06s);
        }

        @keyframes starterIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .oxy-starter:hover {
          border-color: var(--text-primary);
          transform: translateY(-2px);
        }

        .oxy-starter-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .oxy-starter-detail {
          display: block;
          font-size: 13px;
          color: var(--text-tertiary);
        }

        /* Thread */
        .oxy-thread {
          padding: 32px 0;
        }

        .oxy-msg {
          display: flex;
          gap: 16px;
          margin-bottom: 36px;
          animation: msgIn 0.35s ease backwards;
          animation-delay: calc(var(--i) * 0.03s);
        }

        @keyframes msgIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .oxy-msg-user {
          flex-direction: row-reverse;
        }

        .oxy-msg-indicator {
          width: 20px;
          padding-top: 6px;
          flex-shrink: 0;
        }

        .oxy-dot {
          display: block;
          width: 6px;
          height: 6px;
          background: var(--text-primary);
          border-radius: 50%;
        }

        .oxy-dot-pulse {
          animation: dotPulse 1.5s ease infinite;
        }

        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        .oxy-msg-body {
          flex: 1;
          min-width: 0;
        }

        .oxy-msg-text {
          font-size: 15px;
          line-height: 1.75;
          color: var(--text-primary);
          white-space: pre-wrap;
        }

        .oxy-msg-user .oxy-msg-text {
          color: var(--text-secondary);
        }

        .oxy-msg-thinking {
          color: var(--text-tertiary) !important;
          font-style: italic;
        }

        .oxy-msg-thinking::after {
          content: '';
          animation: ellipsis 1.5s infinite;
        }

        @keyframes ellipsis {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }

        .oxy-msg-time {
          display: block;
          font-size: 11px;
          color: var(--text-faint);
          margin-top: 8px;
        }

        .oxy-msg-user .oxy-msg-body {
          text-align: right;
        }

        /* Composer */
        .oxy-composer {
          padding: 24px 0 32px;
          position: relative;
          flex-shrink: 0;
        }

        .oxy-mentions {
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          margin-bottom: 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          padding: 6px;
          animation: mentionsIn 0.2s ease;
        }

        @keyframes mentionsIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .oxy-mention {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: none;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          font-size: 14px;
          color: var(--text-primary);
          cursor: pointer;
          transition: background 0.12s ease;
          animation: mentionIn 0.15s ease backwards;
          animation-delay: calc(var(--i) * 0.03s);
        }

        @keyframes mentionIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .oxy-mention:hover {
          background: var(--surface-overlay);
        }

        .oxy-mention-when {
          font-size: 12px;
          color: var(--text-faint);
        }

        .oxy-input-wrap {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          padding: 6px 6px 6px 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .oxy-input-wrap.focused {
          border-color: var(--focus);
          box-shadow: 0 0 0 3px var(--focus-ring);
        }

        .oxy-input-wrap textarea {
          flex: 1;
          border: none;
          background: none;
          font-family: inherit;
          font-size: 15px;
          line-height: 1.55;
          color: var(--text-primary);
          resize: none;
          padding: 10px 0;
          max-height: 200px;
        }

        .oxy-input-wrap textarea:focus {
          outline: none;
        }

        .oxy-input-wrap textarea::placeholder {
          color: var(--text-faint);
        }

        .oxy-input-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 4px;
        }

        .oxy-hint {
          font-size: 12px;
          color: var(--text-faint);
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .oxy-input-wrap.focused .oxy-hint {
          opacity: 1;
        }

        .oxy-hint kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          background: var(--surface-overlay);
          border-radius: 4px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 500;
          color: var(--text-tertiary);
          margin-right: 2px;
        }

        .oxy-send {
          width: 38px;
          height: 38px;
          border: none;
          border-radius: 12px;
          background: var(--gray-100);
          color: var(--gray-400);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          flex-shrink: 0;
        }

        .oxy-input-wrap.has-text .oxy-send {
          background: var(--text-primary);
          color: var(--surface);
        }

        .oxy-input-wrap.has-text .oxy-send:hover {
          transform: scale(1.04);
        }

        .oxy-send:disabled {
          cursor: default;
        }

        /* Scrollbar */
        .oxy ::-webkit-scrollbar {
          width: 4px;
        }

        .oxy ::-webkit-scrollbar-track {
          background: transparent;
        }

        .oxy ::-webkit-scrollbar-thumb {
          background: var(--gray-200);
          border-radius: 2px;
        }

        .oxy ::-webkit-scrollbar-thumb:hover {
          background: var(--gray-300);
        }

        /* Selection */
        .oxy ::selection {
          background: rgba(0,0,0,0.08);
        }
      `}</style>
    </div>
  );
}
