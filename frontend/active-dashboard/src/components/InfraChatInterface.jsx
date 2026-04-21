import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { getToken } from '../services/authService'

// --- Infrastructure service URL (direct, SSE bypasses gateway) ---
const INFRA_API_URL = import.meta.env.VITE_INFRA_API_BASE_URL || 'http://localhost:8004'

// --- localStorage helpers ---
const STORAGE_PREFIX = 'infra_chat_sessions_'

const getStorageKey = (projectId) => `${STORAGE_PREFIX}${projectId}`

const loadSessions = (projectId) => {
  try {
    const raw = localStorage.getItem(getStorageKey(projectId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveSessions = (projectId, sessions) => {
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(sessions))
  } catch (e) {
    console.error('Failed to save chat sessions:', e)
  }
}

// --- Date grouping helper ---
const groupSessionsByDate = (sessions) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000)

  const groups = { today: [], yesterday: [], week: [], older: [] }

  const sorted = [...sessions].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

  sorted.forEach((s) => {
    const d = new Date(s.updatedAt)
    if (d >= today) groups.today.push(s)
    else if (d >= yesterday) groups.yesterday.push(s)
    else if (d >= sevenDaysAgo) groups.week.push(s)
    else groups.older.push(s)
  })

  return groups
}

const createDefaultMessage = (projectName) => ({
  id: 1,
  sender: 'ai',
  text: `Hello! I'm your Infrastructure Copilot. I can help you provision AWS resources for **${projectName}**. What kind of application or infrastructure are you looking to build today?`,
})

// Helper function to preprocess markdown content to clean up LLM code block hallucinations
const preprocessMarkdown = (content) => {
  if (!content || typeof content !== 'string') return '';
  return content.replace(/```(?:text|)\s*\n(.*?)\n\s*```/ig, (match, p1) => ` **${p1.trim()}** `);
};

// ============================================================
// InfraChatInterface
// ============================================================

// --- Markdown Components Generator ---
const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden my-4 border border-slate-700/50 shadow-md bg-[#1e1e1e]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] text-slate-300 text-xs border-b border-white/5">
        <span className="font-mono uppercase tracking-wider">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        PreTag="div"
        customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const markdownComponents = {
  h1: ({ children }) => <h1 className="text-xl font-bold text-slate-800 mt-5 mb-3 leading-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold text-slate-800 mt-4 mb-2 leading-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold text-slate-800 mt-4 mb-2">{children}</h3>,
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-slate-700">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1.5 text-slate-700 marker:text-slate-400">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1.5 text-slate-700 marker:text-slate-400">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="border border-emerald-100/50 px-4 py-2 my-3 bg-emerald-50/50 italic text-emerald-900 rounded">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 underline underline-offset-2 font-medium">{children}</a>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded border border-slate-200">
      <table className="w-full text-sm text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">{children}</tr>,
  th: ({ children }) => <th className="px-4 py-3 font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-4 py-3">{children}</td>,
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const value = String(children).replace(/\n$/, '');
    const language = match ? match[1].toLowerCase().trim() : '';
    
    const isText = language === 'text' || (!match && !inline);

    if (isText) {
      if (value.includes('\n')) {
        return (
          <div className="font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-3 my-3 whitespace-pre-wrap shadow-sm text-[13.5px] leading-relaxed">
            {value}
          </div>
        );
      }
      return <span className="font-bold text-slate-900 mx-1">{value}</span>;
    }
    
    return !inline && match ? (
      <CodeBlock language={match[1]} value={value} />
    ) : (
      <code className="bg-slate-100 text-emerald-700 px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-200/60" {...props}>
        {children}
      </code>
    );
  }
};

const InfraChatInterface = ({ project, onCancel, onInfrastructureCreated }) => {
  const projectId = project.id || project.project_name

  // --- Session & sidebar state ---
  const [chatSessions, setChatSessions] = useState(() => loadSessions(projectId))
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // --- Chat state ---
  const [messages, setMessages] = useState([createDefaultMessage(project.project_name)])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const messagesEndRef = useRef(null)
  const eventSourceRef = useRef(null)

  const initializedRef = useRef(false)

  // On mount: if sessions exist, load the most recent one; otherwise create a new session
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const sessions = loadSessions(projectId)
    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      const latest = sorted[0]
      setActiveSessionId(latest.id)
      setMessages(latest.messages)
      setChatSessions(sessions)
    } else {
      handleNewChat(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, streamingMessage])

  // --- Persist current session whenever messages change ---
  const persistSession = useCallback(
    (sessionId, msgs) => {
      setChatSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, messages: msgs, updatedAt: new Date().toISOString() } : s
        )
        saveSessions(projectId, updated)
        return updated
      })
    },
    [projectId]
  )

  // --- Auto-title from first user message ---
  const updateSessionTitle = useCallback(
    (sessionId, title) => {
      setChatSessions((prev) => {
        const updated = prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        saveSessions(projectId, updated)
        return updated
      })
    },
    [projectId]
  )

  // --- New Chat ---
  const handleNewChat = (shouldSave = true) => {
    const newId = `session_${Date.now()}`
    const defaultMsg = createDefaultMessage(project.project_name)
    const newSession = {
      id: newId,
      title: 'New conversation',
      messages: [defaultMsg],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setChatSessions((prev) => {
      const updated = [newSession, ...prev]
      if (shouldSave) saveSessions(projectId, updated)
      return updated
    })

    setActiveSessionId(newId)
    setMessages([defaultMsg])
    setInputValue('')
    setIsTyping(false)
    setStreamingMessage('')
  }

  // --- Load session ---
  const handleLoadSession = (session) => {
    setActiveSessionId(session.id)
    setMessages(session.messages)
    setInputValue('')
    setIsTyping(false)
    setStreamingMessage('')
    setDeleteConfirmId(null)
  }

  // --- Delete session ---
  const handleDeleteSession = (sessionId) => {
    setChatSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId)
      saveSessions(projectId, updated)

      if (sessionId === activeSessionId) {
        if (updated.length > 0) {
          const sorted = [...updated].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          setActiveSessionId(sorted[0].id)
          setMessages(sorted[0].messages)
        } else {
          const newId = `session_${Date.now()}`
          const defaultMsg = createDefaultMessage(project.project_name)
          const fresh = {
            id: newId,
            title: 'New conversation',
            messages: [defaultMsg],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          setActiveSessionId(newId)
          setMessages([defaultMsg])
          saveSessions(projectId, [fresh])
          return [fresh]
        }
      }

      return updated
    })
    setDeleteConfirmId(null)
  }

  // --- Send message (real SSE to infrastructure-service) ---
  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!inputValue.trim() || isTyping) return

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: inputValue.trim(),
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInputValue('')
    setIsTyping(true)
    setStreamingMessage('')

    // Auto-title: if this is the first user message in the session
    const userMsgsCount = newMessages.filter((m) => m.sender === 'user').length
    if (userMsgsCount === 1 && activeSessionId) {
      const title = userMsg.text.length > 40 ? userMsg.text.substring(0, 40) + '…' : userMsg.text
      updateSessionTitle(activeSessionId, title)
    }

    // Persist user message immediately
    if (activeSessionId) persistSession(activeSessionId, newMessages)

    // Get auth token
    const token = getToken()
    if (!token) {
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: '⚠️ Authentication required. Please log in again.',
      }
      const withError = [...newMessages, errorMsg]
      setMessages(withError)
      setIsTyping(false)
      if (activeSessionId) persistSession(activeSessionId, withError)
      return
    }

    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Build SSE URL with query params
    const params = new URLSearchParams({
      message: userMsg.text,
      project_id: projectId,
      project_name: project.project_name,
      session_id: activeSessionId || `infra-chat-${Date.now()}`,
      token: token,
    })

    const sseUrl = `${INFRA_API_URL}/api/infra/chat/stream?${params.toString()}`

    try {
      const eventSource = new EventSource(sseUrl)
      eventSourceRef.current = eventSource

      let accumulatedContent = ''

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'chunk') {
            accumulatedContent += data.content
            setStreamingMessage(accumulatedContent)
          } else if (data.type === 'done') {
            const finalContent = data.content || accumulatedContent
            const aiMsg = {
              id: Date.now() + 1,
              sender: 'ai',
              text: finalContent,
            }
            const updatedMessages = [...newMessages, aiMsg]
            setMessages(updatedMessages)
            setStreamingMessage('')
            setIsTyping(false)

            if (activeSessionId) persistSession(activeSessionId, updatedMessages)

            // If resources were saved, notify parent
            if (data.response_type === 'saved' && data.saved_resources?.length > 0) {
              const savedRes = data.saved_resources
              onInfrastructureCreated(
                {
                  resources: savedRes,
                  provider: 'aws',
                  method: 'copilot-assisted',
                },
                `AI successfully provisioned ${savedRes.length} resource${savedRes.length > 1 ? 's' : ''}!`
              )
            }

            eventSource.close()
            eventSourceRef.current = null
          } else if (data.type === 'error') {
            const errorMsg = {
              id: Date.now() + 1,
              sender: 'ai',
              text: `⚠️ ${data.message || 'An error occurred. Please try again.'}`,
            }
            const withError = [...newMessages, errorMsg]
            setMessages(withError)
            setStreamingMessage('')
            setIsTyping(false)
            if (activeSessionId) persistSession(activeSessionId, withError)

            eventSource.close()
            eventSourceRef.current = null
          }
        } catch (parseError) {
          console.error('Failed to parse SSE event:', parseError)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        eventSource.close()
        eventSourceRef.current = null

        if (isTyping) {
          if (accumulatedContent) {
            const aiMsg = {
              id: Date.now() + 1,
              sender: 'ai',
              text: accumulatedContent,
            }
            const updatedMessages = [...newMessages, aiMsg]
            setMessages(updatedMessages)
            if (activeSessionId) persistSession(activeSessionId, updatedMessages)
          } else {
            const errorMsg = {
              id: Date.now() + 1,
              sender: 'ai',
              text: '⚠️ Connection lost. Please check that the infrastructure service is running and try again.',
            }
            const withError = [...newMessages, errorMsg]
            setMessages(withError)
            if (activeSessionId) persistSession(activeSessionId, withError)
          }
          setStreamingMessage('')
          setIsTyping(false)
        }
      }
    } catch (error) {
      console.error('Failed to create EventSource:', error)
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: '⚠️ Failed to connect to the infrastructure service. Please try again.',
      }
      const withError = [...newMessages, errorMsg]
      setMessages(withError)
      setIsTyping(false)
      setStreamingMessage('')
      if (activeSessionId) persistSession(activeSessionId, withError)
    }
  }

  // --- Grouped sessions ---
  const grouped = groupSessionsByDate(chatSessions)

  const renderGroup = (label, sessions) => {
    if (sessions.length === 0) return null
    return (
      <div key={label} className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 mb-1.5">
          {label}
        </p>
        <div className="space-y-0.5">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${s.id === activeSessionId
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 text-emerald-700 font-bold shadow-sm shadow-emerald-900/5'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm'
                }`}
              onClick={() => handleLoadSession(s)}
            >
              <svg
                className={`w-3.5 h-3.5 flex-shrink-0 ${s.id === activeSessionId ? 'text-emerald-500' : 'text-slate-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="flex-1 text-xs truncate">{s.title}</span>

              {deleteConfirmId === s.id ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleDeleteSession(s.id)}
                    className="p-0.5 text-red-500 hover:text-red-700 transition-colors"
                    title="Confirm delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Cancel"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirmId(s.id)
                  }}
                  className="p-0.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                  title="Delete conversation"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-white/50 shadow-2xl flex h-[calc(100vh-7rem)] min-h-[600px] overflow-hidden">
      {/* ===== Chat History Sidebar ===== */}
      <div
        className={`flex-shrink-0 border-r border-slate-100 bg-slate-50/80 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0'
          }`}
      >
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <button
            onClick={() => handleNewChat()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_16px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 transition-all duration-300 group"
          >
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 pb-4">
          {chatSessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-slate-400">No conversations yet</p>
            </div>
          ) : (
            <>
              {renderGroup('Today', grouped.today)}
              {renderGroup('Yesterday', grouped.yesterday)}
              {renderGroup('Previous 7 Days', grouped.week)}
              {renderGroup('Older', grouped.older)}
            </>
          )}
        </div>
      </div>

      {/* ===== Main Chat Area ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-white/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title={isSidebarOpen ? 'Hide history' : 'Show history'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 2a1 1 0 011 1v1a1 1 0 01-2 0V3a1 1 0 011-1zM4 9h16a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6a2 2 0 012-2zm4 4a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2zm-6 5v2m4-2v2"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-display">Copilot Assisted</h2>
              <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">
                AI Infrastructure Provisioning <span className="mx-1.5 opacity-50">•</span>{' '}
                <span className="text-emerald-600 font-bold">{project.project_name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Exit Chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed ${msg.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                  }`}
              >
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                  {preprocessMarkdown(msg.text)}
                </ReactMarkdown>
              </div>
            </div>
          ))}

          {/* Streaming message (real-time SSE content) */}
          {streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm text-sm leading-relaxed bg-white border border-slate-100 text-slate-700">
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                  {preprocessMarkdown(streamingMessage)}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Typing indicator (shown before first chunk arrives) */}
          {isTyping && !streamingMessage && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-soft"></span>
                <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse-soft" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse-soft" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-5 bg-white border-t border-slate-100 flex-shrink-0 relative z-10 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
          <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl blur opacity-0 group-focus-within:opacity-25 transition duration-500"></div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your infrastructure requirements..."
                className="relative w-full pl-6 pr-16 py-4 bg-slate-50 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl text-sm focus:outline-none focus:border-emerald-400/50 focus:bg-white transition-all duration-300 text-slate-800 placeholder-slate-400 block"
                autoFocus
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-xl shadow-md disabled:shadow-none hover:shadow-lg disabled:opacity-40 disabled:from-slate-400 disabled:to-slate-400 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
              >
                <img
                  src="/icons8-send-puffy-filled-32.png"
                  alt="Send"
                  className="w-5 h-5 object-contain block m-auto filter brightness-0 invert"
                  onError={(e) => {
                    e.target.onerror = null
                    e.target.src = 'https://img.icons8.com/puffy-filled/32/ffffff/sent.png'
                  }}
                />
              </button>
            </div>
          </form>
          <p className="text-center text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-3">
            AI may hallucinate infrastructure endpoints. Verify before production.
          </p>
        </div>
      </div>
    </div>
  )
}

export default InfraChatInterface
