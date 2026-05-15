import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { getToken } from '../services/authService'
import {
  getConversations,
  getConversationMessages,
  deleteConversation as deleteConversationApi,
  renameConversation as renameConversationApi,
} from '../services/conversationService'
import { getProjectResources } from '../services/projectService'

// --- Infrastructure service URL (direct, SSE bypasses gateway) ---
const INFRA_API_URL = import.meta.env.VITE_INFRA_API_BASE_URL || 'http://localhost:8004'

// --- localStorage helpers (write-through cache for offline resilience) ---
const STORAGE_PREFIX = 'infra_chat_sessions_'

const getStorageKey = (projectId) => `${STORAGE_PREFIX}${projectId}`

const loadSessionsFromCache = (projectId) => {
  try {
    const raw = localStorage.getItem(getStorageKey(projectId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveSessionsToCache = (projectId, sessions) => {
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(sessions))
  } catch (e) {
    console.error('Failed to save chat sessions to cache:', e)
  }
}

// --- Date grouping helper ---
const groupSessionsByDate = (sessions) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000)

  const groups = { today: [], yesterday: [], week: [], older: [] }

  const sorted = [...sessions].sort((a, b) => new Date(b.updatedAt || b.updated_at) - new Date(a.updatedAt || a.updated_at))

  sorted.forEach((s) => {
    const d = new Date(s.updatedAt || s.updated_at)
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
  h1: ({ children }) => <h1 className="text-xl font-bold mt-5 mb-3 leading-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2 leading-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold mt-4 mb-2">{children}</h3>,
  p: ({ children }) => {
    let content = ''
    if (Array.isArray(children)) {
      content = children.join('')
    } else if (typeof children === 'string') {
      content = children
    }
    
    // Check for inline actionable buttons
    if (content.includes('[ACTION: DEPLOY]')) {
      return (
        <div className="my-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <h4 className="font-bold text-emerald-800 text-sm">Deploy Infrastructure</h4>
            <p className="text-[11px] text-emerald-600/80 mt-0.5 font-medium">Ready to provision the requested resources to AWS.</p>
          </div>
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition-all hover:-translate-y-0.5 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Deploy Now
          </button>
        </div>
      )
    }

    return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
  },
  ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1.5 marker:opacity-60">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1.5 marker:opacity-60">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold opacity-100">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="border border-current/20 px-4 py-2 my-3 bg-current/5 italic rounded opacity-90">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium hover:opacity-80">{children}</a>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded border border-current/20">
      <table className="w-full text-sm text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="text-xs uppercase bg-current/5 border-b border-current/20">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-current/10 last:border-0 hover:bg-current/5">{children}</tr>,
  th: ({ children }) => <th className="px-4 py-3 font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-4 py-3">{children}</td>,
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const value = String(children).replace(/\n$/, '');
    const language = match ? match[1].toLowerCase().trim() : '';

    const isText = language === 'text' || (!match && !inline);

    // Generative UI for large artifacts
    if (!inline && language === 'json' && value.includes('"architecture"')) {
       return (
         <div className="my-4 border border-indigo-200/60 rounded-xl overflow-hidden bg-indigo-50/30 shadow-sm">
           <div className="bg-indigo-100/50 px-4 py-2.5 border-b border-indigo-200/60 flex items-center gap-2">
             <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
             <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Architecture Blueprint</span>
           </div>
           <div className="p-6 flex items-center justify-center min-h-[120px] bg-gradient-to-br from-white to-indigo-50/20">
              <span className="text-xs font-semibold text-indigo-400 border border-indigo-200/60 border-dashed px-4 py-2 rounded-lg bg-white shadow-sm flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Interactive Diagram Rendering...
              </span>
           </div>
           <div className="bg-white border-t border-indigo-100/60 p-2">
              <details className="text-xs text-slate-500 group">
                <summary className="cursor-pointer hover:text-indigo-600 font-medium px-2 py-1 outline-none list-none flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  View JSON Source
                </summary>
                <div className="mt-2 px-2 pb-2">
                  <CodeBlock language="json" value={value} />
                </div>
              </details>
           </div>
         </div>
       )
    }

    if (!inline && language === 'terraform' && value.length > 500) {
      return (
         <div className="my-4 border border-emerald-200/60 rounded-xl overflow-hidden bg-emerald-50/30 shadow-sm">
           <div className="bg-emerald-100/50 px-4 py-2.5 border-b border-emerald-200/60 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
               <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Terraform Configuration</span>
             </div>
             <span className="text-[10px] font-bold bg-white text-emerald-600 px-2 py-0.5 rounded-md border border-emerald-200 shadow-sm">Artifact</span>
           </div>
           <div className="bg-white p-2">
              <details className="text-xs text-slate-500 group">
                <summary className="cursor-pointer hover:text-emerald-600 font-medium px-2 py-1 outline-none list-none flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  Show Full Configuration ({value.split('\n').length} lines)
                </summary>
                <div className="mt-2 px-2 pb-2">
                  <CodeBlock language="terraform" value={value} />
                </div>
              </details>
           </div>
         </div>
       )
    }

    if (isText) {
      if (value.includes('\n')) {
        return (
          <div className="font-medium bg-current/5 border border-current/20 rounded-md p-3 my-3 whitespace-pre-wrap shadow-sm text-[13.5px] leading-relaxed">
            {value}
          </div>
        );
      }
      return <span className="font-bold mx-1 opacity-100">{value}</span>;
    }

    return !inline && match ? (
      <CodeBlock language={match[1]} value={value} />
    ) : (
      <code className="bg-current/10 px-1.5 py-0.5 rounded text-[13px] font-mono border border-current/20" {...props}>
        {children}
      </code>
    );
  }
};

const InfraChatInterface = ({ project, onCancel, onInfrastructureCreated, selectedRepo }) => {
  const projectId = project.id || project.project_name

  // --- Session & sidebar state ---
  const [chatSessions, setChatSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [hasInfrastructure, setHasInfrastructure] = useState(null)

  // --- Chat state ---
  const [messages, setMessages] = useState([createDefaultMessage(project.project_name)])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const messagesEndRef = useRef(null)
  const eventSourceRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const textareaRef = useRef(null)

  const initializedRef = useRef(false)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)
  
  // --- Power User features state ---
  const [showCommands, setShowCommands] = useState(false)
  const [commandFilter, setCommandFilter] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')

  const COMMANDS = [
    { cmd: '/scan-repo', desc: 'Scan currently selected repository' },
    { cmd: '/cost-estimate', desc: 'Estimate AWS costs for current architecture' },
    { cmd: '/clear', desc: 'Clear the current conversation context' },
    { cmd: '/plan', desc: 'Generate a Terraform plan' },
  ]

  const MENTIONS = [
    { tag: '@project', desc: 'Entire project context' },
  ]

  const SUGGESTED_PROMPTS = hasInfrastructure ? [
    "Explain my current architecture",
    "How can I reduce my AWS costs?",
    "Scan repository for new microservices"
  ] : [
    "Scan my repository and propose an architecture",
    "Deploy a standard full-stack environment",
    "What AWS services do I need for a React app?"
  ]

  // On mount: load conversations from API (fallback to localStorage cache)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const loadConversations = async () => {
      // 1. Check if infrastructure exists for this project
      let infraExists = false
      try {
        const resources = await getProjectResources(projectId)
        if (resources && resources.length > 0) {
          infraExists = true
        }
      } catch (err) {
        console.warn('Could not check existing project resources:', err)
      }
      setHasInfrastructure(infraExists)

      try {
        // Try API first
        const apiConversations = await getConversations(projectId)

        if (apiConversations.length > 0) {
          // Map API format to local format
          const mapped = apiConversations.map((c) => ({
            id: c.session_id,
            title: c.title,
            message_count: c.message_count,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }))
          setChatSessions(mapped)

          // Load the most recent conversation's messages
          const latest = mapped[0]
          setActiveSessionId(latest.id)

          try {
            const data = await getConversationMessages(latest.id)
            if (data && data.messages && data.messages.length > 0) {
              const loadedMessages = data.messages.map((m, i) => ({
                id: m.id || i + 1,
                sender: m.role === 'user' ? 'user' : 'ai',
                text: m.content,
              }))
              setMessages(loadedMessages)
            }
          } catch {
            // Could not load messages, keep default
          }

          // Trigger repo scan if repo selected AND NO infra exists
          if (selectedRepo && !infraExists) {
            setTimeout(() => {
              triggerMessage('[INIT_REPO_SCAN]', latest.id)
            }, 500)
          }
          return
        }
      } catch (err) {
        console.warn('Could not load conversations from API, using local cache:', err)
      }

      // Fallback: try localStorage cache
      const cached = loadSessionsFromCache(projectId)
      if (cached.length > 0) {
        const sorted = [...cached].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        const latest = sorted[0]
        setActiveSessionId(latest.id)
        setMessages(latest.messages || [createDefaultMessage(project.project_name)])
        setChatSessions(cached)

        if (selectedRepo && !infraExists) {
          setTimeout(() => {
            triggerMessage('[INIT_REPO_SCAN]', latest.id, latest.messages)
          }, 500)
        }
      } else {
        handleNewChat(false, true, infraExists)
      }
    }

    loadConversations()
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

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const isScrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 100
    setIsUserScrolledUp(isScrolledUp)
  }

  const scrollToBottom = (force = false) => {
    if (!isUserScrolledUp || force) {
      if (force) setIsUserScrolledUp(false)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, streamingMessage])

  // --- Draft Persistence & Auto-resize ---
  useEffect(() => {
    if (activeSessionId) {
      const draft = localStorage.getItem(`draft_${projectId}_${activeSessionId}`) || ''
      setInputValue(draft)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
        }
      }, 0)
    } else {
      setInputValue('')
    }
  }, [activeSessionId, projectId])

  const handleInputChange = (e) => {
    const val = e.target.value
    setInputValue(val)
    if (activeSessionId) {
      localStorage.setItem(`draft_${projectId}_${activeSessionId}`, val)
    }
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'

    const cursorPosition = e.target.selectionStart || 0
    const textBeforeCursor = val.slice(0, cursorPosition)
    
    // Command trigger
    const cmdMatch = textBeforeCursor.match(/(^|\s)\/([a-zA-Z-]*)$/)
    if (cmdMatch) {
      setShowCommands(true)
      setCommandFilter(cmdMatch[2].toLowerCase())
      setShowMentions(false)
    } else {
      setShowCommands(false)
    }

    // Mention trigger
    const mentionMatch = textBeforeCursor.match(/(^|\s)@([a-zA-Z-]*)$/)
    if (mentionMatch) {
      setShowMentions(true)
      setMentionFilter(mentionMatch[2].toLowerCase())
      setShowCommands(false)
    } else {
      setShowMentions(false)
    }
  }

  const insertText = (textToInsert, triggerChar) => {
    if (!textareaRef.current) return
    const cursorPosition = textareaRef.current.selectionStart
    const textBeforeCursor = inputValue.slice(0, cursorPosition)
    const textAfterCursor = inputValue.slice(cursorPosition)
    
    const triggerIndex = textBeforeCursor.lastIndexOf(triggerChar)
    if (triggerIndex !== -1) {
      const newTextBefore = textBeforeCursor.slice(0, triggerIndex)
      const newVal = newTextBefore + textToInsert + ' ' + textAfterCursor
      setInputValue(newVal)
      
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.selectionStart = newTextBefore.length + textToInsert.length + 1
          textareaRef.current.selectionEnd = textareaRef.current.selectionStart
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
        }
      }, 0)
    }
    
    setShowCommands(false)
    setShowMentions(false)
  }

  // --- Persist current session to localStorage cache ---
  const persistSession = useCallback(
    (sessionId, msgs) => {
      setChatSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, messages: msgs, updatedAt: new Date().toISOString() } : s
        )
        saveSessionsToCache(projectId, updated)
        return updated
      })
    },
    [projectId]
  )

  // --- Refresh conversations from API (called after title changes, etc.) ---
  const refreshConversations = useCallback(async () => {
    try {
      const apiConversations = await getConversations(projectId)
      if (apiConversations.length > 0) {
        const mapped = apiConversations.map((c) => ({
          id: c.session_id,
          title: c.title,
          message_count: c.message_count,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }))
        setChatSessions(mapped)
      }
    } catch {
      // Silently fail — localStorage cache will still work
    }
  }, [projectId])

  // --- New Chat ---
  const handleNewChat = (shouldSave = true, isInitial = true, infraExists = hasInfrastructure) => {
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
      if (shouldSave) saveSessionsToCache(projectId, updated)
      return updated
    })

    setActiveSessionId(newId)
    setMessages([defaultMsg])
    setInputValue('')
    setIsTyping(false)
    setStreamingMessage('')

    // Automatically trigger initial repo scan if a repo is selected AND no infra exists
    if (selectedRepo && isInitial && !infraExists) {
      setTimeout(() => {
        triggerMessage('[INIT_REPO_SCAN]', newId, [defaultMsg])
      }, 500)
    }
  }

  // --- Load session ---
  const handleLoadSession = async (session) => {
    setActiveSessionId(session.id)
    setInputValue('')
    setIsTyping(false)
    setStreamingMessage('')
    setDeleteConfirmId(null)

    // Load messages from API
    try {
      const data = await getConversationMessages(session.id)
      if (data && data.messages && data.messages.length > 0) {
        const loadedMessages = data.messages.map((m, i) => ({
          id: m.id || i + 1,
          sender: m.role === 'user' ? 'user' : 'ai',
          text: m.content,
        }))
        setMessages(loadedMessages)
        return
      }
    } catch {
      // Fall through to local cache
    }

    // Fallback: if we have messages in the local session object
    if (session.messages) {
      setMessages(session.messages)
    } else {
      setMessages([createDefaultMessage(project.project_name)])
    }
  }

  // --- Delete session ---
  const handleDeleteSession = async (sessionId) => {
    // Delete from API
    try {
      await deleteConversationApi(sessionId)
    } catch {
      console.warn('Failed to delete conversation from API')
    }

    setChatSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId)
      saveSessionsToCache(projectId, updated)

      if (sessionId === activeSessionId) {
        if (updated.length > 0) {
          const sorted = [...updated].sort((a, b) => new Date(b.updatedAt || b.updated_at) - new Date(a.updatedAt || a.updated_at))
          setActiveSessionId(sorted[0].id)
          handleLoadSession(sorted[0])
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
          saveSessionsToCache(projectId, [fresh])
          return [fresh]
        }
      }

      return updated
    })
    setDeleteConfirmId(null)
  }

  const triggerMessage = (text, sessionIdOverride = null, currentMessagesOverride = null) => {
    const targetSessionId = sessionIdOverride || activeSessionId
    const currentMessages = currentMessagesOverride || messages

    const isHidden = text === '[INIT_REPO_SCAN]'
    let newMessages = currentMessages

    if (!isHidden) {
      const userMsg = {
        id: Date.now(),
        sender: 'user',
        text: text,
      }
      newMessages = [...currentMessages, userMsg]
      setMessages(newMessages)
    } else {
      setIsTyping(true)
    }

    if (targetSessionId && !isHidden) persistSession(targetSessionId, newMessages)

    const token = getToken()
    if (!token) {
      if (!isHidden) {
        const errorMsg = {
          id: Date.now() + 1,
          sender: 'ai',
          text: '⚠️ Authentication required. Please log in again.',
        }
        const withError = [...newMessages, errorMsg]
        setMessages(withError)
        setIsTyping(false)
        if (targetSessionId) persistSession(targetSessionId, withError)
      }
      return
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const paramsObj = {
      message: text,
      project_id: projectId,
      project_name: project.project_name,
      session_id: targetSessionId || `infra-chat-${Date.now()}`,
      token: token,
    }

    if (selectedRepo) {
      if (selectedRepo.repo_id) paramsObj.repo_id = selectedRepo.repo_id
      if (selectedRepo.credential_id) paramsObj.credential_id = selectedRepo.credential_id
      if (selectedRepo.provider) paramsObj.provider = selectedRepo.provider
    }

    const params = new URLSearchParams(paramsObj)
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

            // Only use the callback pattern for setMessages to ensure we have latest state
            setMessages(prev => {
              const updatedMessages = [...prev, aiMsg]
              if (targetSessionId) persistSession(targetSessionId, updatedMessages)
              return updatedMessages
            })

            setStreamingMessage('')
            setIsTyping(false)

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

            // Refresh sidebar to pick up LLM-generated titles
            setTimeout(() => refreshConversations(), 1500)

            eventSource.close()
            eventSourceRef.current = null
          } else if (data.type === 'error') {
            setMessages(prev => {
              const errorMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: `⚠️ ${data.message || 'An error occurred. Please try again.'}`,
              }
              const withError = [...prev, errorMsg]
              if (targetSessionId) persistSession(targetSessionId, withError)
              return withError
            })
            setStreamingMessage('')
            setIsTyping(false)
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
            setMessages(prev => {
              const aiMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: accumulatedContent,
              }
              const updatedMessages = [...prev, aiMsg]
              if (targetSessionId) persistSession(targetSessionId, updatedMessages)
              return updatedMessages
            })
          } else if (!isHidden) {
            setMessages(prev => {
              const errorMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: '⚠️ Network error. Connection lost.',
              }
              const withError = [...prev, errorMsg]
              if (targetSessionId) persistSession(targetSessionId, withError)
              return withError
            })
          }
          setStreamingMessage('')
          setIsTyping(false)
        }
      }
    } catch (error) {
      console.error('Failed to establish SSE connection:', error)
      setIsTyping(false)
    }
  }

  // --- Send message (real SSE to infrastructure-service) ---
  const handleSendMessage = (e) => {
    e?.preventDefault()
    if (!inputValue.trim() || isTyping) return

    const text = inputValue.trim()
    
    // Intercept client-side commands
    if (text === '/clear') {
      setMessages([createDefaultMessage(project.project_name)])
      setInputValue('')
      setShowCommands(false)
      setShowMentions(false)
      return
    }

    setInputValue('')
    setShowCommands(false)
    setShowMentions(false)
    
    if (activeSessionId) {
      localStorage.removeItem(`draft_${projectId}_${activeSessionId}`)
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    
    setIsTyping(true)
    setStreamingMessage('')
    setIsUserScrolledUp(false)

    triggerMessage(text)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }



  // --- Phase 2: Chat Controls ---
  const handleStopGenerating = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      
      setMessages(prev => {
        const finalContent = streamingMessage ? streamingMessage + '\n\n*(Generation stopped by user)*' : '*(Generation stopped by user)*'
        const aiMsg = {
          id: Date.now() + 1,
          sender: 'ai',
          text: finalContent,
        }
        const updatedMessages = [...prev, aiMsg]
        if (activeSessionId) persistSession(activeSessionId, updatedMessages)
        return updatedMessages
      })
      setStreamingMessage('')
      setIsTyping(false)
    }
  }

  const handleRegenerate = () => {
    let lastUserText = ''
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        lastUserText = messages[i].text
        break
      }
    }
    if (!lastUserText || isTyping) return
    triggerMessage("Regenerate response for: " + lastUserText)
  }

  const handleEditClick = (text) => {
    setInputValue(text)
    if (textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }

  const handleSuggestionClick = (text) => {
    setInputValue('')
    setShowCommands(false)
    setShowMentions(false)
    if (activeSessionId) {
      localStorage.removeItem(`draft_${projectId}_${activeSessionId}`)
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setIsTyping(true)
    setStreamingMessage('')
    setIsUserScrolledUp(false)
    triggerMessage(text)
  }

  // --- Grouped sessions ---
  const grouped = groupSessionsByDate(chatSessions)

  const renderGroup = (label, sessions) => {
    if (sessions.length === 0) return null
    return (
      <div key={label} className="mb-3">
        <p className="text-[11px] font-medium text-slate-400 px-3 mb-1">{label}</p>
        <div className="space-y-px">
          {sessions.map((s) => {
            const isActive = s.id === activeSessionId
            const isDeleting = deleteConfirmId === s.id

            return (
              <div
                key={s.id}
                className={`group relative overflow-hidden rounded-md cursor-pointer transition-colors duration-150 ${
                  isDeleting
                    ? 'bg-red-50'
                    : isActive
                      ? 'bg-slate-200/70'
                      : 'hover:bg-slate-100'
                }`}
                onClick={() => !isDeleting && handleLoadSession(s)}
              >
                {/* Normal state */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5"
                  style={{
                    transform: isDeleting ? 'translateX(-100%)' : 'translateX(0)',
                    opacity: isDeleting ? 0 : 1,
                    position: isDeleting ? 'absolute' : 'relative',
                    transition: 'transform 0.25s ease, opacity 0.2s ease',
                  }}
                >
                  <span className={`flex-1 text-[13px] truncate ${
                    isActive ? 'text-slate-900 font-medium' : 'text-slate-600'
                  }`} title={s.title}>
                    {s.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirmId(s.id)
                    }}
                    className="p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity duration-150 flex-shrink-0"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Delete confirmation */}
                <div
                  className="flex items-center justify-between px-3 py-2.5 w-full"
                  style={{
                    transform: isDeleting ? 'translateX(0)' : 'translateX(100%)',
                    opacity: isDeleting ? 1 : 0,
                    position: isDeleting ? 'relative' : 'absolute',
                    top: isDeleting ? undefined : 0,
                    transition: 'transform 0.25s ease, opacity 0.2s ease 0.05s',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[12px] text-red-600">Delete?</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      className="text-[11px] font-medium text-red-600 hover:text-red-700 transition-colors"
                    >
                      Yes
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xl flex h-[calc(100vh-7rem)] min-h-[600px] overflow-hidden">
      {/* ===== Chat History Sidebar ===== */}
      <div
        className={`flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0'
          }`}
      >
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <button
            onClick={() => handleNewChat()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md hover:bg-emerald-800 hover:-translate-y-0.5 transition-all duration-300 group"
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
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-white relative"
        >
          {messages.map((msg, index) => {
            const isLastAiMessage = index === messages.length - 1 && msg.sender === 'ai'
            
            return (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} group/msg max-w-4xl mx-auto w-full`}>
              <div className={msg.sender === 'user' ? 'max-w-[80%] flex flex-col items-end' : 'w-full'}>
                <div
                  className={`relative text-[15px] leading-relaxed ${msg.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm px-4 py-3'
                    : 'text-slate-700 py-1'
                    }`}
                >
                  <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                    {preprocessMarkdown(msg.text)}
                  </ReactMarkdown>
                </div>
                
                {/* Edit button — outside the bubble */}
                {!isTyping && msg.sender === 'user' && (
                  <div className="mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEditClick(msg.text)}
                      className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Edit message"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  </div>
                )}
                
                {/* Regenerate button — below AI message */}
                {!isTyping && msg.sender === 'ai' && isLastAiMessage && (
                  <div className="flex gap-1 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                    <button 
                      onClick={handleRegenerate}
                      className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Regenerate response"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            )
          })}

          {/* Streaming message (real-time SSE content) */}
          {streamingMessage && (
            <div className="flex justify-start max-w-4xl mx-auto w-full">
              <div className="w-full text-[15px] leading-relaxed text-slate-700 py-1">
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                  {preprocessMarkdown(streamingMessage)}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Typing indicator (shown before first chunk arrives) */}
          {isTyping && !streamingMessage && (
            <div className="flex justify-start max-w-3xl mx-auto w-full">
              <div className="flex items-center gap-1.5 py-3">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse-soft"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse-soft" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse-soft" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}


          {/* Spacer to push content above floating input */}
          <div className="h-32 flex-shrink-0" />
          <div ref={messagesEndRef} />
        </div>

        {isUserScrolledUp && (
          <button 
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:bg-slate-700 transition-all flex items-center gap-2 z-20"
          >
            <span>New messages below</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </button>
        )}

        {/* Input Area (Floating) */}
        <div className="absolute bottom-0 left-0 right-0 p-5 pt-16 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/90 to-transparent z-10 pointer-events-none">
          <div className="pointer-events-auto relative max-w-4xl mx-auto">
            
            {/* Suggested Prompts (Only visible at start) */}
            {messages.length <= 1 && !isTyping && !streamingMessage && hasInfrastructure !== null && (
              <div className="absolute bottom-full mb-4 left-0 w-full flex flex-wrap justify-center gap-2 animate-fade-in-up">
                {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(prompt)}
                    className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-emerald-100 hover:border-emerald-300 text-slate-600 hover:text-emerald-700 text-xs font-semibold rounded-full shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Stop Generating Button */}
            {isTyping && (
              <div className="absolute bottom-full mb-4 left-0 w-full flex justify-center animate-fade-in-up z-50">
                <button 
                  onClick={handleStopGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800/90 backdrop-blur-sm text-white text-xs font-semibold rounded-full hover:bg-red-500 hover:text-white transition-all shadow-lg hover:shadow-red-500/20"
                >
                  <span className="w-2.5 h-2.5 bg-current rounded-sm"></span>
                  Stop Generating
                </button>
              </div>
            )}

            {/* Context Mentions / Slash Commands Popup */}
            {(showCommands || showMentions) && (
              <div className="absolute bottom-full mb-2 left-6 w-64 max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-xl p-1 z-50 animate-fade-in-up">
                {showCommands && COMMANDS.filter(c => c.cmd.toLowerCase().includes(commandFilter)).map(c => (
                  <button 
                    key={c.cmd}
                    onClick={() => insertText(c.cmd, '/')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex flex-col transition-colors"
                  >
                    <span className="text-emerald-600 font-mono text-sm font-bold">{c.cmd}</span>
                    <span className="text-[10px] text-slate-500 truncate">{c.desc}</span>
                  </button>
                ))}
                {showMentions && MENTIONS.filter(m => m.tag.toLowerCase().includes(mentionFilter)).map(m => (
                  <button 
                    key={m.tag}
                    onClick={() => insertText(m.tag, '@')}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex flex-col transition-colors"
                  >
                    <span className="text-indigo-600 font-mono text-sm font-bold">{m.tag}</span>
                    <span className="text-[10px] text-slate-500 truncate">{m.desc}</span>
                  </button>
                ))}
                
                {/* Empty states */}
                {showCommands && COMMANDS.filter(c => c.cmd.toLowerCase().includes(commandFilter)).length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400 italic">No matching commands</div>
                )}
                {showMentions && MENTIONS.filter(m => m.tag.toLowerCase().includes(mentionFilter)).length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400 italic">No matching mentions</div>
                )}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="relative">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl blur opacity-0 group-focus-within:opacity-25 transition duration-500"></div>
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your infrastructure requirements... (Shift+Enter for new line)"
                  className="relative w-full pl-6 pr-16 py-4 bg-white border border-slate-300 shadow-[0_4px_20px_rgba(0,0,0,0.06)] rounded-2xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-all duration-300 text-slate-800 placeholder-slate-400 block resize-none overflow-hidden"
                  style={{ minHeight: '54px', maxHeight: '200px' }}
                  rows={1}
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
            <p className="text-center text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-3 drop-shadow-sm">
              AI may hallucinate infrastructure endpoints. Verify before production.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InfraChatInterface
