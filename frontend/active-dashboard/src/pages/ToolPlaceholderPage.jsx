import { useAuth } from '../hooks/useAuth'
import PageLayout from '../components/PageLayout'
import { useLocation } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { Plus, X, Search, GitBranch, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getSCMRepos, getRepoTree } from '../services/credentialService'
import { getToken } from '../services/authService'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const QUICK_TOOLS_API_URL = import.meta.env.VITE_QUICK_TOOLS_API_BASE_URL || 'http://localhost:8007'

// ── Markdown Code Block ─────────────────────────────────────────────
const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group rounded-lg overflow-hidden my-4 border border-slate-700/50 shadow-md bg-[#1e1e1e]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] text-slate-300 text-xs border-b border-white/5">
        <span className="font-mono uppercase tracking-wider">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <><CheckCircle2 size={14} className="text-emerald-400" /><span>Copied</span></>
          ) : (
            <><span>Copy</span></>
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
  ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const value = String(children).replace(/\n$/, '')
    return !inline && match ? (
      <CodeBlock language={match[1]} value={value} />
    ) : (
      <code className="bg-current/10 px-1.5 py-0.5 rounded text-[13px] font-mono border border-current/20" {...props}>
        {children}
      </code>
    )
  }
}

// ── Main Component ──────────────────────────────────────────────────
const ToolPlaceholderPage = () => {
  const { userInfo, handleLogout } = useAuth()
  const location = useLocation()
  const [prompt, setPrompt] = useState('')

  const pathParts = location.pathname.split('/')
  const toolId = pathParts[pathParts.length - 1]

  const [sessionId, setSessionId] = useState('')
  useEffect(() => {
    setSessionId(`qt-${toolId}-${Date.now()}`)
  }, [toolId])

  // Repo popover state
  const [showRepoPopover, setShowRepoPopover] = useState(false)
  const [repos, setRepos] = useState([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const popoverRef = useRef(null)

  // Selected repo & scan state
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null) // { found: [...], tree: [...] }

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingResponse, setStreamingResponse] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const eventSourceRef = useRef(null)
  const responseRef = useRef(null)

  const getToolTitle = () => {
    switch (toolId) {
      case 'dockerfile': return 'Dockerfile'
      case 'jenkins': return 'Jenkins Pipeline'
      case 'k8s-manifest': return 'K8s Manifest'
      case 'helm': return 'Helm Charts'
      default: return 'Quick Tool'
    }
  }

  const getToolDescription = () => {
    switch (toolId) {
      case 'dockerfile': return 'Generate highly optimized, production-ready Dockerfiles for your applications.'
      case 'jenkins': return 'Create robust, declarative Jenkins CI/CD pipelines tailored to your deployment workflow.'
      case 'k8s-manifest': return 'Build reliable Kubernetes deployment manifests and service configurations instantly.'
      case 'helm': return 'Design customizable Helm charts for scalable application packaging and distribution.'
      default: return 'Use AI to rapidly generate DevOps configurations and infrastructure code.'
    }
  }

  const getSamplePrompts = () => {
    switch (toolId) {
      case 'dockerfile': return [
        "Write a multi-stage Dockerfile for a Node.js API...",
        "Create a secure Dockerfile for a Python FastAPI app...",
        "Dockerize a React app with Nginx server..."
      ]
      case 'jenkins': return [
        "Generate a declarative pipeline for a Maven project...",
        "Create a Jenkinsfile with SonarQube and Docker build stages...",
        "Write a pipeline to deploy to AWS EKS..."
      ]
      case 'k8s-manifest': return [
        "Create a deployment and service for a Postgres database...",
        "Write an ingress controller manifest for my web app...",
        "Generate a StatefulSet configuration for Redis..."
      ]
      case 'helm': return [
        "Create a starter Helm chart for a Go microservice...",
        "Generate a Helm chart with configmap and secrets...",
        "Write a Helm template for a multi-tier application..."
      ]
      default: return [
        "Describe what you want to build...",
        "Paste your infrastructure requirements here..."
      ]
    }
  }

  const getToolGradient = () => {
    switch (toolId) {
      case 'dockerfile': return 'linear-gradient(180deg, #0db7ed 0%, #298d83 50%, #268b81 100%)'
      case 'jenkins': return 'linear-gradient(180deg, #d32f2f 0%, #298d83 50%, #268b81 100%)'
      case 'k8s-manifest': return 'linear-gradient(180deg, #326ce5 0%, #298d83 50%, #268b81 100%)'
      case 'helm': return 'linear-gradient(180deg, #0f1689 0%, #298d83 50%, #268b81 100%)'
      default: return 'linear-gradient(180deg, #3275d9 0%, #298d83 50%, #268b81 100%)'
    }
  }

  // ── Tool-specific file detection ──────────────────────────────────
  const detectToolFiles = (tree) => {
    if (!tree || tree.length === 0) return []

    switch (toolId) {
      case 'dockerfile':
        return tree.filter(f => {
          const name = f.split('/').pop().toLowerCase()
          return name.startsWith('dockerfile') || name === 'docker-compose.yml' || name === 'docker-compose.yaml'
        })
      case 'jenkins':
        return tree.filter(f => {
          const name = f.split('/').pop().toLowerCase()
          return name === 'jenkinsfile' || name.startsWith('jenkinsfile.') || f.includes('.jenkins/')
        })
      case 'k8s-manifest':
        return tree.filter(f => {
          const lower = f.toLowerCase()
          const isYaml = lower.endsWith('.yaml') || lower.endsWith('.yml')
          const inK8sDir = lower.includes('k8s/') || lower.includes('kubernetes/') || lower.includes('manifests/') || lower.includes('deploy/')
          return isYaml && inK8sDir
        })
      case 'helm':
        return tree.filter(f => {
          const name = f.split('/').pop().toLowerCase()
          const lower = f.toLowerCase()
          return name === 'chart.yaml' || name === 'values.yaml' || lower.includes('templates/')
        })
      default:
        return []
    }
  }

  // ── Animated placeholder ──────────────────────────────────────────
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('')

  useEffect(() => {
    let currentPromptIndex = 0
    let currentCharIndex = 0
    let isDeleting = false
    let timeoutId
    let isMounted = true

    const type = () => {
      if (!isMounted) return

      const prompts = getSamplePrompts()
      const currentPrompt = prompts[currentPromptIndex]

      if (isDeleting) {
        setAnimatedPlaceholder(currentPrompt.substring(0, currentCharIndex - 1))
        currentCharIndex--
      } else {
        setAnimatedPlaceholder(currentPrompt.substring(0, currentCharIndex + 1))
        currentCharIndex++
      }

      let typingSpeed = isDeleting ? 15 : 35

      if (!isDeleting && currentCharIndex === currentPrompt.length) {
        typingSpeed = 1500
        isDeleting = true
      } else if (isDeleting && currentCharIndex === 0) {
        isDeleting = false
        currentPromptIndex = (currentPromptIndex + 1) % prompts.length
        typingSpeed = 300
      }

      timeoutId = setTimeout(type, typingSpeed)
    }

    type()

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [toolId])

  useEffect(() => {
    document.title = `infraXai - ${getToolTitle()}`
  }, [toolId])

  // ── Click outside to close popover ────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowRepoPopover(false)
      }
    }
    if (showRepoPopover) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showRepoPopover])

  // ── Cleanup EventSource on unmount ────────────────────────────────
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  // ── Auto-scroll response area ─────────────────────────────────────
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight
    }
  }, [streamingResponse, generatedContent])

  // ── Fetch repos ───────────────────────────────────────────────────
  const handleOpenPopover = async () => {
    setShowRepoPopover(!showRepoPopover)
    if (!showRepoPopover && repos.length === 0) {
      setRepoLoading(true)
      try {
        const data = await getSCMRepos()
        setRepos(data || [])
      } catch (err) {
        console.error('Failed to fetch repos:', err)
      } finally {
        setRepoLoading(false)
      }
    }
  }

  // ── Select repo & scan tree ───────────────────────────────────────
  const handleSelectRepo = async (repo) => {
    setSelectedRepo(repo)
    setShowRepoPopover(false)
    setScanLoading(true)
    setScanResult(null)

    try {
      const data = await getRepoTree(repo.id)
      const tree = data.tree || []
      const found = detectToolFiles(tree)
      setScanResult({ found, tree })
    } catch (err) {
      console.error('Failed to fetch repo tree:', err)
      setScanResult({ found: [], tree: [] })
    } finally {
      setScanLoading(false)
    }
  }

  // ── Clear selected repo ───────────────────────────────────────────
  const handleClearRepo = () => {
    setSelectedRepo(null)
    setScanResult(null)
  }

  // ── Send prompt → SSE stream ──────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return

    const text = prompt.trim()
    setPrompt('')
    setIsGenerating(true)
    setStreamingResponse('')
    setGeneratedContent('')

    const token = getToken()
    if (!token) {
      setGeneratedContent('⚠️ Authentication required. Please log in again.')
      setIsGenerating(false)
      return
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const params = new URLSearchParams({
      tool_type: toolId,
      prompt: text,
      folder_tree: JSON.stringify(scanResult?.tree || []),
      session_id: sessionId,
      token: token,
    })

    const sseUrl = `${QUICK_TOOLS_API_URL}/api/tools/generate/stream?${params.toString()}`

    try {
      const eventSource = new EventSource(sseUrl)
      eventSourceRef.current = eventSource

      let accumulated = ''

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'chunk') {
            accumulated += data.content
            setStreamingResponse(accumulated)
          } else if (data.type === 'done') {
            setGeneratedContent(data.content || accumulated)
            setStreamingResponse('')
            setIsGenerating(false)
            eventSource.close()
            eventSourceRef.current = null
          } else if (data.type === 'error') {
            setGeneratedContent(`⚠️ ${data.message || 'An error occurred.'}`)
            setStreamingResponse('')
            setIsGenerating(false)
            eventSource.close()
            eventSourceRef.current = null
          }
        } catch (parseError) {
          console.error('Failed to parse SSE event:', parseError)
        }
      }

      eventSource.onerror = () => {
        if (accumulated) {
          setGeneratedContent(accumulated)
        } else {
          setGeneratedContent('⚠️ Connection error. Please try again.')
        }
        setStreamingResponse('')
        setIsGenerating(false)
        eventSource.close()
        eventSourceRef.current = null
      }
    } catch (error) {
      console.error('Failed to establish SSE connection:', error)
      setIsGenerating(false)
    }
  }

  // ── Filter repos by search ────────────────────────────────────────
  const filteredRepos = repos.filter(r =>
    r.name?.toLowerCase().includes(repoSearch.toLowerCase()) ||
    r.name_with_namespace?.toLowerCase().includes(repoSearch.toLowerCase())
  )

  const displayContent = streamingResponse || generatedContent

  return (
    <PageLayout userInfo={userInfo} onLogout={handleLogout}>
      <div className="relative flex-1 w-full overflow-hidden flex flex-col items-center justify-center">

        {/* Background Gradients */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: getToolGradient()
          }}
        >
          <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[120%] h-[100%] bg-white opacity-80 rounded-[100%] blur-[120px] pointer-events-none mix-blend-screen"></div>
          <div className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] bg-white opacity-100 rounded-[100%] blur-[90px] pointer-events-none"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-[40%] bg-white opacity-100 rounded-[100%] blur-[60px] pointer-events-none"></div>
        </div>

        {/* Scrollable content area */}
        <div className={`z-10 w-full flex flex-col items-center ${displayContent ? 'justify-start pt-10 overflow-y-auto h-full' : 'justify-center'} transition-all duration-500`}>

          {/* Tool Header & Description */}
          <div className={`text-center px-6 cursor-default transition-all duration-500 ${displayContent ? 'mb-6' : 'mb-10'}`}>
            <h1 className={`font-bold text-slate-800 tracking-tight drop-shadow-sm transition-all duration-500 ${displayContent ? 'text-2xl mb-2' : 'text-3xl sm:text-4xl mb-4'}`}>
              {getToolTitle()}
            </h1>
            {!displayContent && (
              <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto font-medium leading-relaxed">
                {getToolDescription()}
              </p>
            )}
          </div>

          {/* Context Chip (selected repo + scan results) */}
          {selectedRepo && (
            <div className="w-full max-w-[760px] px-6 mb-4">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm">
                <GitBranch size={16} className="text-slate-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-slate-700 truncate">{selectedRepo.name}</span>
                <span className="text-slate-300 mx-1">·</span>
                {scanLoading ? (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Loader2 size={12} className="animate-spin" /> Scanning...
                  </span>
                ) : scanResult?.found?.length > 0 ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 size={12} />
                    {scanResult.found.length} {getToolTitle().toLowerCase()} file{scanResult.found.length > 1 ? 's' : ''} found
                  </span>
                ) : scanResult ? (
                  <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                    <AlertCircle size={12} />
                    No existing {getToolTitle().toLowerCase()} detected
                  </span>
                ) : null}
                <button
                  onClick={handleClearRepo}
                  className="ml-auto p-1 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-black/5"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Chat Input Container */}
          <div className="w-full max-w-[760px] px-6">
            <form onSubmit={handleSubmit}>
              <div className="bg-[#f4f3ef] rounded-[32px] p-3 shadow-[0_12px_40px_rgb(0,0,0,0.1)] flex flex-col relative h-[120px] transition-shadow duration-300 focus-within:shadow-[0_12px_50px_rgb(0,0,0,0.15)] group">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  placeholder={animatedPlaceholder}
                  className="w-full h-full bg-transparent resize-none outline-none border-none text-slate-800 p-3 pt-4 text-lg font-medium placeholder:text-[#a3a19b] transition-colors"
                  autoFocus
                  spellCheck="false"
                />

                {/* Bottom Controls */}
                <div className="flex justify-between items-end mt-2 px-1 pb-1">
                  {/* Left Side: Repo picker */}
                  <div className="relative" ref={popoverRef}>
                    <button
                      type="button"
                      onClick={handleOpenPopover}
                      className={`w-[34px] h-[34px] flex items-center justify-center rounded-full transition-all duration-200 ${showRepoPopover
                        ? 'bg-slate-800 text-white'
                        : 'text-[#8a8883] hover:text-slate-700 hover:bg-black/5'
                        }`}
                      title="Attach a repository"
                    >
                      <Plus size={22} strokeWidth={2.5} />
                    </button>

                    {/* Repo Popover */}
                    {showRepoPopover && (
                      <div className="absolute bottom-12 left-0 w-80 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-[0_20px_60px_rgb(0,0,0,0.15)] overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                        {/* Search */}
                        <div className="px-3 pt-3 pb-2">
                          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl">
                            <Search size={14} className="text-slate-400" />
                            <input
                              type="text"
                              value={repoSearch}
                              onChange={(e) => setRepoSearch(e.target.value)}
                              placeholder="Search repositories..."
                              className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Repo list */}
                        <div className="max-h-60 overflow-y-auto px-1.5 pb-2">
                          {repoLoading ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-slate-400 text-sm">
                              <Loader2 size={16} className="animate-spin" /> Loading repos...
                            </div>
                          ) : filteredRepos.length === 0 ? (
                            <div className="text-center py-8 text-sm text-slate-400">
                              {repos.length === 0 ? 'No repos synced. Go to Settings → SCM.' : 'No matches found.'}
                            </div>
                          ) : (
                            filteredRepos.map((repo) => (
                              <button
                                key={repo.id}
                                type="button"
                                onClick={() => handleSelectRepo(repo)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                              >
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center flex-shrink-0">
                                  <GitBranch size={14} className="text-slate-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-700 truncate">{repo.name}</p>
                                  <p className="text-[11px] text-slate-400 truncate">{repo.name_with_namespace || repo.http_url_to_repo}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Send */}
                  <div className="flex items-center">
                    <button
                      type="submit"
                      disabled={!prompt.trim() || isGenerating}
                      className={`w-[34px] h-[34px] flex items-center justify-center rounded-full shadow-[0_2px_8px_rgb(0,0,0,0.04)] transition-all duration-200 transform hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed
                        ${prompt.trim() && !isGenerating ? 'bg-slate-800 text-white hover:bg-black hover:shadow-lg' : 'bg-[#8a8883] text-white hover:bg-[#787671]'}`}
                    >
                      {isGenerating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <img
                          src="/icons8-send-puffy-filled-32.png"
                          alt="Send"
                          className="w-4 h-4 object-contain block m-auto filter brightness-0 invert"
                          onError={(e) => {
                            e.target.onerror = null
                            e.target.src = 'https://img.icons8.com/puffy-filled/32/ffffff/sent.png'
                          }}
                        />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Generated Response Area */}
          {displayContent && (
            <div className="w-full max-w-[760px] px-6 mt-6 mb-10">
              <div
                ref={responseRef}
                className="bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-lg p-6 max-h-[70vh] overflow-y-auto text-sm text-slate-700 leading-relaxed"
              >
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                  {displayContent}
                </ReactMarkdown>
                {isGenerating && (
                  <div className="flex items-center gap-1.5 mt-4">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}

export default ToolPlaceholderPage
