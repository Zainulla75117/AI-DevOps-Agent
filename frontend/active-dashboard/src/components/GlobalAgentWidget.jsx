import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { motion, AnimatePresence } from 'framer-motion'
import { getToken } from '../services/authService'

// Guide service URL (direct SSE, bypasses gateway)
const GUIDE_API_URL = import.meta.env.VITE_GUIDE_API_BASE_URL || 'http://localhost:8006'

// --- Markdown Component Setup (Reused from InfraChat for consistency) ---
const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group rounded-lg overflow-hidden my-4 shadow-sm bg-[#1e1e1e] border border-white/10">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 text-slate-300 text-[11px] font-medium tracking-wider uppercase border-b border-white/10">
        <span>{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <span className="text-emerald-400">Copied</span>
          ) : (
            <span>Copy</span>
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
  )
}

const markdownComponents = {
  h1: ({ children }) => <h1 className="text-xl font-bold mt-5 mb-3 leading-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2 leading-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold mt-4 mb-2">{children}</h3>,
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1.5 marker:opacity-60">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1.5 marker:opacity-60">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold opacity-100">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-current/30 pl-4 py-1 my-3 italic bg-current/5 rounded-r opacity-90">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium hover:opacity-80">{children}</a>,
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const value = String(children).replace(/\n$/, '')
    
    if (!inline && match) {
      return <CodeBlock language={match[1]} value={value} />
    }
    return (
      <code className="bg-slate-500/10 px-1.5 py-0.5 rounded text-[13px] font-mono border border-current/10" {...props}>
        {children}
      </code>
    )
  }
}

// --- Main Widget Component ---
const GlobalAgentWidget = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId] = useState(() => `guide-${Date.now()}`)
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "Hi! Need help with something? I’m your guide",
    }
  ])
  const [streamingMessage, setStreamingMessage] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const eventSourceRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) scrollToBottom()
  }, [messages, streamingMessage, isOpen])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  const sendMessage = (userText) => {
    setIsTyping(true)
    setStreamingMessage('')

    const token = getToken()
    if (!token) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'ai',
        text: '⚠️ You need to be logged in to use the guide. Please log in and try again.',
      }])
      setIsTyping(false)
      return
    }

    // Close any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const params = new URLSearchParams({
      message: userText,
      session_id: sessionId,
      token: token,
    })
    const sseUrl = `${GUIDE_API_URL}/api/guide/chat/stream?${params.toString()}`

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
            setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: finalContent }])
            setStreamingMessage('')
            setIsTyping(false)
            eventSource.close()
            eventSourceRef.current = null
          } else if (data.type === 'error') {
            setMessages(prev => [...prev, {
              id: Date.now(),
              sender: 'ai',
              text: `⚠️ ${data.message || 'Something went wrong. Please try again.'}`,
            }])
            setStreamingMessage('')
            setIsTyping(false)
            eventSource.close()
            eventSourceRef.current = null
          }
        } catch (parseError) {
          console.error('Failed to parse SSE event:', parseError)
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        eventSourceRef.current = null

        if (accumulatedContent) {
          // Got partial content before error — show what we have
          setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: accumulatedContent }])
        } else {
          setMessages(prev => [...prev, {
            id: Date.now(),
            sender: 'ai',
            text: '⚠️ Could not connect to the Guide service. Make sure it is running on port 8006.',
          }])
        }
        setStreamingMessage('')
        setIsTyping(false)
      }
    } catch (error) {
      console.error('Failed to establish SSE connection:', error)
      setIsTyping(false)
    }
  }

  const handleSend = (e) => {
    e.preventDefault()
    if (!inputValue.trim() || isTyping) return

    const userText = inputValue.trim()
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userText }])
    setInputValue('')
    
    sendMessage(userText)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <>
      {/* --- Floating Action Button --- */}
      <div className="fixed bottom-6 right-6 z-[100]">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="relative flex items-center justify-center w-14 h-14 bg-slate-900 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-700/50 hover:bg-slate-800 transition-colors group"
            >
              {/* Outer glow */}
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <img 
                src="/ask-24.png" 
                alt="Ask Agent" 
                className="w-6 h-6 relative z-10 invert opacity-90"
              />

              {/* Tooltip */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: 10, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 5, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-[120%] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-xl border border-white/10"
                  >
                    Ask Agent
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* --- Main Chat Window --- */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
            className={`fixed bottom-6 right-6 z-[100] transition-all duration-300 ease-in-out ${isExpanded ? 'w-[800px] h-[80vh]' : 'w-[400px] h-[650px]'} max-h-[85vh] max-w-[calc(100vw-3rem)] bg-white/95 backdrop-blur-3xl rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-slate-200/60 flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center">
                  <img 
                    src="/ask-24.png" 
                    alt="Bot" 
                    className="w-4 h-4 invert opacity-90"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-display">Global Agent</h3>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Online & Ready</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  title={isExpanded ? "Minimize" : "Expand"}
                >
                  {isExpanded ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'ai' && (
                    <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                      <img 
                        src="/ask-24.png" 
                        alt="Bot" 
                        className="w-3.5 h-3.5 invert opacity-90"
                      />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm text-[13.5px] leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-slate-900 text-white rounded-tr-sm'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                    }`}
                  >
                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}

              {/* Streaming Message Indicator */}
              {streamingMessage && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <img 
                      src="/ask-24.png" 
                      alt="Bot" 
                      className="w-3.5 h-3.5 invert opacity-90"
                    />
                  </div>
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 shadow-sm text-[13.5px] leading-relaxed bg-white border border-slate-200 text-slate-700 rounded-tl-sm">
                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                      {streamingMessage}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Typing Dot Animation (when waiting for response) */}
              {isTyping && !streamingMessage && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <img 
                      src="/ask-24.png" 
                      alt="Bot" 
                      className="w-3.5 h-3.5 invert opacity-90"
                    />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse-soft"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse-soft" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse-soft" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 relative z-10">
              <form onSubmit={handleSend} className="relative flex items-end gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-1.5 focus-within:border-slate-400 focus-within:bg-white transition-all shadow-sm">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask the agent anything..."
                  className="w-full bg-transparent resize-none outline-none py-2 px-3 text-[13.5px] text-slate-800 placeholder-slate-400 max-h-[120px]"
                  rows={1}
                  onInput={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTyping}
                  className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:bg-slate-300 transition-all mb-0.5 mr-0.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default GlobalAgentWidget
