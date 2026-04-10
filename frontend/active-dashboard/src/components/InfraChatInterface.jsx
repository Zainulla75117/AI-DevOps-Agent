import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'

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

// ============================================================
// InfraChatInterface
// ============================================================
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
  const messagesEndRef = useRef(null)

  // On mount: if sessions exist, load the most recent one; otherwise create a new session
  useEffect(() => {
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

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
  }

  // --- Load session ---
  const handleLoadSession = (session) => {
    setActiveSessionId(session.id)
    setMessages(session.messages)
    setInputValue('')
    setIsTyping(false)
    setDeleteConfirmId(null)
  }

  // --- Delete session ---
  const handleDeleteSession = (sessionId) => {
    setChatSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId)
      saveSessions(projectId, updated)

      // If deleting the active session, switch to newest or create new
      if (sessionId === activeSessionId) {
        if (updated.length > 0) {
          const sorted = [...updated].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          setActiveSessionId(sorted[0].id)
          setMessages(sorted[0].messages)
        } else {
          // Create a brand new session
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

  // --- Send message ---
  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: inputValue.trim(),
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInputValue('')
    setIsTyping(true)

    // Auto-title: if this is the first user message in the session
    const userMsgsCount = newMessages.filter((m) => m.sender === 'user').length
    if (userMsgsCount === 1 && activeSessionId) {
      const title = userMsg.text.length > 40 ? userMsg.text.substring(0, 40) + '…' : userMsg.text
      updateSessionTitle(activeSessionId, title)
    }

    // Persist user message immediately
    if (activeSessionId) persistSession(activeSessionId, newMessages)

    // Simulate AI response
    setTimeout(() => {
      let aiResponseText = ''
      const aiMsgCount = newMessages.filter((m) => m.sender === 'ai').length

      if (aiMsgCount === 1) {
        aiResponseText =
          "That sounds like a great plan. To support that, I recommend a High-Availability Network (VPC with 2 Public and 2 Private Subnets), an Application Load Balancer, and an ECS Fargate cluster for compute. Does this architecture sound good to you?"
      } else if (aiMsgCount >= 2) {
        aiResponseText =
          "Excellent. I've automatically configured the CloudFormation templates and executed the terraform plan. Your infrastructure is now provisioning!"

        setTimeout(() => {
          onInfrastructureCreated(
            {
              vpcName: `${project.project_name}-ai-vpc`,
              vpcCidr: '10.0.0.0/16',
              provider: 'aws',
              method: 'copilot-assisted',
            },
            'AI successfully provisioned your infrastructure!'
          )
        }, 3000)
      }

      const withAi = [...newMessages, { id: Date.now() + 1, sender: 'ai', text: aiResponseText }]
      setMessages(withAi)
      setIsTyping(false)

      if (activeSessionId) persistSession(activeSessionId, withAi)
    }, 1500)
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
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 ${s.id === activeSessionId
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
              onClick={() => handleLoadSession(s)}
            >
              {/* Chat icon */}
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

              {/* Delete button */}
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
        {/* Sidebar Header */}
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <button
            onClick={() => handleNewChat()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-emerald-600 text-xs font-semibold rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Session List */}
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
            {/* Sidebar toggle */}
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
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100 flex-shrink-0">
          <form onSubmit={handleSendMessage} className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your infrastructure requirements..."
              className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all text-slate-800"
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-colors flex items-center justify-center"
            >
              <img
                src="/icons8-send-puffy-filled-32.png"
                alt="Send"
                className="w-5 h-5 object-contain block m-auto"
                onError={(e) => {
                  e.target.onerror = null
                  e.target.src = 'https://img.icons8.com/puffy-filled/32/ffffff/sent.png'
                }}
              />
            </button>
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
