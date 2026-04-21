import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getToken, getChatToken, getValidChatToken, isAuthenticated, isTokenExpired } from '../services/authService'
import { getSCMCredentials } from '../services/credentialService'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

// Helper function to preprocess markdown content
const preprocessMarkdown = (content) => {
  if (!content || typeof content !== 'string') {
    return String(content || '')
  }
  
  let processed = content
  
  // Normalize line breaks first
  processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // If content is already valid markdown (has proper code blocks), return as-is
  // Only process if we detect the "--- language" pattern
  if (!processed.includes('--- ') || !processed.match(/^---\s+\w+/m)) {
    // Standard markdown - return as-is, just normalize
    return processed
  }
  
  // Split content into lines for processing
  const lines = processed.split('\n')
  const result = []
  let inCodeBlock = false
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    
    // Check if line starts a code block with "--- language"
    const codeBlockMatch = line.match(/^---\s+(\w+)\s*(.*)$/)
    
    if (codeBlockMatch) {
      // Close any existing code block
      if (inCodeBlock) {
        result.push('```')
        inCodeBlock = false
      }
      
      // Start new code block
      const lang = codeBlockMatch[1]
      const codeStart = codeBlockMatch[2]
      result.push(`\`\`\`${lang}`)
      inCodeBlock = true
      
      // If there's code on the same line, add it
      if (codeStart.trim()) {
        result.push(codeStart)
      }
      
      i++
      continue
    }
    
    // Check if we're already in a code block and encounter another "---"
    if (inCodeBlock && line.trim() === '---') {
      // Close current code block
      result.push('```')
      inCodeBlock = false
      // Don't add the "---" line, it's just a separator
      i++
      continue
    }
    
    // Check if we're already in a code block and encounter "--- language"
    if (inCodeBlock && line.match(/^---\s+\w+/)) {
      // Close current code block first
      result.push('```')
      inCodeBlock = false
      // Process the new code block (will be handled in next iteration)
      continue
    }
    
    // Check for standard markdown code blocks
    if (line.trim().startsWith('```')) {
      if (line.match(/^```(\w+)/)) {
        inCodeBlock = true
      } else if (line.trim() === '```') {
        inCodeBlock = false
      }
      result.push(line)
      i++
      continue
    }
    
    // Regular line - add as is
    result.push(line)
    i++
  }
  
  // Close any unclosed code blocks at the end
  if (inCodeBlock) {
    result.push('```')
  }
  
  processed = result.join('\n')
  
  // Final cleanup: remove excessive blank lines around code blocks
  processed = processed.replace(/```(\w+)\n\n+/g, '```$1\n')
  processed = processed.replace(/\n+\n```/g, '\n```')
  
  return processed
}

const CodeBlock = ({ language, value, isGroovy, onRegenerate, onConfirmed }) => {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (onRegenerate && !isRegenerating) {
      setIsRegenerating(true);
      try {
        await onRegenerate();
      } catch (error) {
      } finally {
        setIsRegenerating(false);
      }
    }
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
      {isGroovy && (onRegenerate || onConfirmed) && (
        <div className="flex gap-2 p-3 bg-slate-50 border-t border-slate-200 justify-end">
          {onRegenerate && (
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className={`px-4 py-2 text-[13px] font-medium rounded-md flex items-center gap-1.5 transition-all ${
                isRegenerating ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm'
              }`}
            >
              {isRegenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Regenerating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Regenerate</span>
                </>
              )}
            </button>
          )}
          {onConfirmed && (
            <button
              onClick={onConfirmed}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-[14px] font-medium flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Confirmed</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Shared markdown components configuration for consistent rendering
const createMarkdownComponents = (messages, message, handleRegenerateCode, handleConfirmCode) => {
  const messageIndex = messages ? messages.findIndex(m => m === message) : -1;

  return {
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
      const isGroovy = language === 'groovy';
      
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
        <CodeBlock 
          language={language} 
          value={value} 
          isGroovy={isGroovy}
          onRegenerate={isGroovy && handleRegenerateCode ? () => handleRegenerateCode(messageIndex) : undefined}
          onConfirmed={isGroovy && handleConfirmCode ? handleConfirmCode : undefined}
        />
      ) : (
        <code className="bg-slate-100 text-emerald-700 px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-200/60" {...props}>
          {children}
        </code>
      );
    }
  };
};

// Options Menu Component
const OptionsMenu = ({ options, sessionId, onSelect }) => {
  const handleOptionClick = async (option) => {
    const token = getToken()
    const chatApiUrl = import.meta.env.VITE_CHAT_API_BASE_URL || 'http://localhost:8081'
    
    try {
      const response = await fetch(
        `${chatApiUrl}/api/jenkins/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${chatToken}`,
          },
          body: JSON.stringify({
            message: option.label || option.value,
            session_id: sessionId,
            selected_option: option.value,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      onSelect(data)
    } catch (error) {
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="space-y-2">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionClick(option)}
            className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all duration-150 flex items-center justify-between group"
          >
            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
              {option.label || option.value}
            </span>
            <svg
              className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

// Form Component with SCM/Manual support
const FormComponent = ({ form, sessionId, onSubmit }) => {
  const [formData, setFormData] = useState({})
  const [visibleFields, setVisibleFields] = useState(new Set())
  const [scmCredentials, setScmCredentials] = useState([])
  const [loadingSCM, setLoadingSCM] = useState(false)
  const [repoSearchQuery, setRepoSearchQuery] = useState('')
  const [repoSearchResults, setRepoSearchResults] = useState([])
  const [showRepoSearch, setShowRepoSearch] = useState(false)
  const [repoNamespaces, setRepoNamespaces] = useState([])
  const [loadingNamespaces, setLoadingNamespaces] = useState(false)
  const [repositories, setRepositories] = useState([])
  const [loadingRepositories, setLoadingRepositories] = useState(false)
  const repoSearchRef = useRef(null)


  // Fetch SCM credentials when SCM is selected
  useEffect(() => {
    if (formData.source_type === 'SCM') {
      fetchSCMCredentials()
    }
  }, [formData.source_type])

  // Fetch repository namespaces when SCM credential is selected
  useEffect(() => {
    if (formData.source_type === 'SCM' && formData.scm_cred_id) {
      fetchRepoNamespaces()
    } else {
      setRepoNamespaces([])
      setRepositories([])
    }
  }, [formData.scm_cred_id, formData.source_type])

  // Fetch repositories when namespace is selected
  useEffect(() => {
    if (formData.source_type === 'SCM' && formData.repo_namespace) {
      fetchRepositoriesByNamespace(formData.repo_namespace)
    } else {
      setRepositories([])
    }
  }, [formData.repo_namespace, formData.source_type])

  // Initialize branch field with default value when SCM is selected
  useEffect(() => {
    if (formData.source_type === 'SCM' && !formData.branch) {
      setFormData((prev) => ({
        ...prev,
        branch: 'master/main'
      }))
    }
  }, [formData.source_type])

  const fetchRepoNamespaces = async () => {
    setLoadingNamespaces(true)
    try {
      const token = getToken()
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
      
      const response = await fetch(`${apiBaseUrl}/api/scm/repo-namespaces`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      // Handle the response format: { namespaces: [...], total_namespaces: X, total_repositories: Y }
      const namespaces = data.namespaces || []
      setRepoNamespaces(namespaces)
    } catch (error) {
      setRepoNamespaces([])
    } finally {
      setLoadingNamespaces(false)
    }
  }

  const fetchRepositoriesByNamespace = async (namespace) => {
    setLoadingRepositories(true)
    try {
      const token = getToken()
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
      
      // Fetch all repositories for the user (backend doesn't support namespace filter yet)
      const response = await fetch(`${apiBaseUrl}/api/scm/repos`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      // Handle both array and object responses
      const allRepos = Array.isArray(data) ? data : (data.repositories || data.repos || [])
      
      // Filter repositories by namespace on the frontend
      // Use path_with_namespace for filtering (no spaces) as it matches the namespace format from backend
      const filteredRepos = allRepos.filter((repo) => {
        if (!namespace) return false
        
        // Prefer path_with_namespace for filtering (cleaner format without spaces)
        const repoFullPath = repo.path_with_namespace || repo.name_with_namespace?.replace(/\s*\/\s*/g, '/') || repo.full_name || ''
        // Check if the repository belongs to the selected namespace
        // Namespace should match everything before the last '/' in the full path
        if (repoFullPath) {
          const parts = repoFullPath.split('/').filter(part => part.trim()) // Remove empty parts
          if (parts.length > 1) {
            const repoNamespace = parts.slice(0, -1).join('/') // Everything except the last part (repo name)
            return repoNamespace === namespace
          }
        }
        return false
      })
      
      setRepositories(filteredRepos)
    } catch (error) {
      setRepositories([])
    } finally {
      setLoadingRepositories(false)
    }
  }

  const fetchSCMCredentials = async () => {
    setLoadingSCM(true)
    try {
      const token = getToken()
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
      
      const response = await fetch(`${apiBaseUrl}/api/scm`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      // Handle both array and object responses
      const credentials = Array.isArray(data) ? data : (data.credentials || data.scm_credentials || [])
      setScmCredentials(credentials || [])
    } catch (error) {
      // Fallback to the old endpoint if new one fails
      try {
        const credentials = await getSCMCredentials()
        setScmCredentials(credentials || [])
      } catch (fallbackError) {
        setScmCredentials([])
      }
    } finally {
      setLoadingSCM(false)
    }
  }

  // Search repositories (placeholder - will be implemented based on backend API)
  const searchRepositories = async (query, scmCredId) => {
    if (!query || query.length < 2 || !scmCredId) {
      setRepoSearchResults([])
      setShowRepoSearch(false)
      return
    }

    // TODO: Implement actual API call to search repositories
    // This should call: GET /api/scm/repositories?scm_cred_id={scmCredId}&query={query}
    // For now, return mock results
    const mockResults = [
      { id: '1', name: `${query}-repo-1`, full_name: `user/${query}-repo-1`, description: 'Repository description 1' },
      { id: '2', name: `${query}-repo-2`, full_name: `user/${query}-repo-2`, description: 'Repository description 2' },
    ]
    setRepoSearchResults(mockResults)
    setShowRepoSearch(true)
  }

  // Trigger repo search when SCM cred is selected and there's a query
  useEffect(() => {
    if (formData.scm_cred_id && repoSearchQuery && repoSearchQuery.length >= 2) {
      const query = repoSearchQuery
      const scmCredId = formData.scm_cred_id
      
      if (!query || query.length < 2 || !scmCredId) {
        setRepoSearchResults([])
        setShowRepoSearch(false)
        return
      }

      // TODO: Implement actual API call to search repositories
      // This should call: GET /api/scm/repositories?scm_cred_id={scmCredId}&query={query}
      // For now, return mock results
      const mockResults = [
        { id: '1', name: `${query}-repo-1`, full_name: `user/${query}-repo-1`, description: 'Repository description 1' },
        { id: '2', name: `${query}-repo-2`, full_name: `user/${query}-repo-2`, description: 'Repository description 2' },
      ]
      setRepoSearchResults(mockResults)
      setShowRepoSearch(true)
    } else if (!formData.scm_cred_id) {
      setRepoSearchResults([])
      setShowRepoSearch(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.scm_cred_id])

  useEffect(() => {
    if (form && form.fields) {
      // Initialize visible fields based on show_if conditions
      const initialVisible = new Set()
      form.fields.forEach((field) => {
        if (!field.show_if) {
          initialVisible.add(field.name)
        }
      })
      setVisibleFields(initialVisible)
    }
  }, [form])

  const handleFieldChange = (name, value) => {
    // Preserve selected_repo when updating other fields
    const newFormData = { ...formData, [name]: value }
    
    // Ensure selected_repo is preserved (it's an object, so shallow copy is fine)
    if (formData.selected_repo && name !== 'selected_repo') {
      newFormData.selected_repo = formData.selected_repo
    }
    
    // Clear dependent fields when source_type changes
    if (name === 'source_type') {
      // Clear SCM-specific fields if switching away from SCM
      if (value !== 'SCM') {
        const scmFields = ['scm_cred_id', 'repo_name', 'repo_full_name', 'repo_namespace', 'branch', 'selected_repo']
        scmFields.forEach(field => {
          delete newFormData[field]
        })
        setRepoSearchQuery('')
        setRepoSearchResults([])
        setShowRepoSearch(false)
        setRepoNamespaces([])
        setRepositories([])
      } else {
        // Initialize branch with default value when switching to SCM
        if (!newFormData.branch) {
          newFormData.branch = 'master/main'
        }
      }
      // Clear Manual-specific fields if switching away from Manual
      if (value !== 'Manual') {
        const manualFields = ['stack_details']
        manualFields.forEach(field => {
          delete newFormData[field]
        })
      }
    }
    
    // Clear repo_namespace and repo_name when scm_cred_id changes
    if (name === 'scm_cred_id') {
      delete newFormData.repo_namespace
      delete newFormData.repo_name
      delete newFormData.repo_full_name
      delete newFormData.selected_repo
      setRepoSearchQuery('')
      setRepoSearchResults([])
      setShowRepoSearch(false)
      setRepoNamespaces([])
      setRepositories([])
    }
    
    // Clear repo_name when repo_namespace changes
    if (name === 'repo_namespace') {
      delete newFormData.repo_name
      delete newFormData.repo_full_name
      delete newFormData.selected_repo
      setRepositories([])
    }
    
    setFormData(newFormData)

    // Handle conditional field visibility
    if (form && form.fields) {
      const updatedVisible = new Set(visibleFields)
      form.fields.forEach((field) => {
        if (field.show_if) {
          const condition = field.show_if
          const shouldShow = newFormData[condition.field] === condition.value
          if (shouldShow) {
            updatedVisible.add(field.name)
          } else {
            updatedVisible.delete(field.name)
            // Clear the field value if it's hidden
            delete newFormData[field.name]
          }
        }
      })
      setVisibleFields(updatedVisible)
    }

    setFormData(newFormData)
  }

  const handleRepoSearch = (query) => {
    setRepoSearchQuery(query)
    if (formData.scm_cred_id) {
      searchRepositories(query, formData.scm_cred_id)
      setShowRepoSearch(true)
    }
  }

  const handleRepoSelect = (repo) => {
    setFormData((prev) => ({
      ...prev,
      repo_name: repo.name,
      repo_full_name: repo.full_name,
    }))
    setRepoSearchQuery(repo.full_name || repo.name)
    setShowRepoSearch(false)
    setRepoSearchResults([])
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onSubmit(formData, sessionId)
  }

  if (!form || !form.fields) {
    return (
      <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
        Error: Invalid form configuration
      </div>
    )
  }

  // Check if this is a pipeline form (has source_type field)
  const hasSourceType = form.fields.some(f => f.name === 'source_type')
  const sourceType = formData.source_type || ''

  return (
    <form 
      onSubmit={handleSubmit} 
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
    >
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', marginBottom: '16px' }}>
        {form.title || 'Form'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {form.fields.map((field) => {
          if (!visibleFields.has(field.name)) {
            return null
          }

          // Special handling for source_type field
          if (field.name === 'source_type') {
            return (
              <div key={field.name}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  {field.label || 'Source Type'}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
                <select
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  required={field.required}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select {field.label || 'Source Type'}</option>
                  <option value="SCM">SCM</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
            )
          }

          // Special handling for SCM credentials field
          if (field.name === 'scm_cred_id' && sourceType === 'SCM') {
            return (
              <div key={field.name} style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  {field.label || 'SCM Credentials'}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
                {loadingSCM ? (
                  <div style={{ padding: '8px 12px', color: '#6b7280', fontSize: '14px' }}>Loading SCM credentials...</div>
                ) : (
                  <select
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    required={field.required}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Select SCM Credentials</option>
                    {scmCredentials.map((cred) => {
                      // Handle different response formats
                      const credId = cred.id || cred._id || cred.scm_name || cred.name
                      const credName = cred.scm_name || cred.name || cred.scm || 'Unknown'
                      const credUsername = cred.username || cred.user || ''
                      const displayName = credUsername ? `${credName} (${credUsername})` : credName
                      
                      return (
                        <option key={credId} value={credId}>
                          {displayName}
                        </option>
                      )
                    })}
                  </select>
                )}
                {scmCredentials.length === 0 && !loadingSCM && (
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    No SCM credentials found. Please add credentials in Settings.
                  </p>
                )}
              </div>
            )
          }

          // Special handling for repo namespace dropdown
          if (field.name === 'repo_namespace' && sourceType === 'SCM') {
            return (
              <div key={field.name}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  {field.label || 'Repository Namespace'}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
                {loadingNamespaces ? (
                  <div style={{ padding: '8px 12px', color: '#6b7280', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      border: '2px solid #d1d5db', 
                      borderTopColor: '#6b7280', 
                      borderRadius: '50%', 
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span>Loading namespaces...</span>
                  </div>
                ) : (
                  <select
                    value={formData[field.name] || ''}
                    onChange={(e) => {
                      const selectedNamespace = e.target.value
                      // Clear repo_name and selected_repo when namespace changes (repository is namespace-specific)
                      setFormData((prev) => {
                        const updated = { ...prev, [field.name]: selectedNamespace }
                        delete updated.repo_name
                        delete updated.repo_full_name
                        delete updated.selected_repo
                        return updated
                      })
                      setRepoSearchQuery('')
                      setRepoSearchResults([])
                      setShowRepoSearch(false)
                      setRepositories([]) // Clear repositories until new ones are fetched
                    }}
                    required={field.required}
                    disabled={!formData.scm_cred_id}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      outline: 'none',
                      fontSize: '14px',
                      backgroundColor: formData.scm_cred_id ? '#ffffff' : '#f9fafb',
                      cursor: formData.scm_cred_id ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <option value="">Select Repository Namespace</option>
                    {repoNamespaces.map((namespace) => (
                      <option key={namespace.value} value={namespace.value}>
                        {namespace.label} ({namespace.count} {namespace.count === 1 ? 'repository' : 'repositories'})
                      </option>
                    ))}
                  </select>
                )}
                {!formData.scm_cred_id && (
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Please select SCM credentials first
                  </p>
                )}
                {repoNamespaces.length === 0 && !loadingNamespaces && formData.scm_cred_id && (
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    No namespaces found. Please sync repositories first.
                  </p>
                )}
              </div>
            )
          }

          // Special handling for repo name dropdown
          if (field.name === 'repo_name' && sourceType === 'SCM') {
            return (
              <div key={field.name}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  {field.label || 'Repository Name'}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
                {loadingRepositories ? (
                  <div style={{ padding: '8px 12px', color: '#6b7280', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      border: '2px solid #d1d5db', 
                      borderTopColor: '#6b7280', 
                      borderRadius: '50%', 
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span>Loading repositories...</span>
                  </div>
                ) : (
                  <select
                    value={formData.repo_full_name || formData[field.name] || ''}
                    onChange={(e) => {
                      const selectedValue = e.target.value
                      if (!selectedValue) {
                        handleFieldChange(field.name, '')
                        setFormData((prev) => {
                          const updated = { ...prev }
                          delete updated.repo_name
                          delete updated.repo_full_name
                          delete updated.selected_repo
                          return updated
                        })
                        return
                      }
                      
                      const selectedRepo = repositories.find(r => {
                        // Use path_with_namespace for matching (consistent with filtering and dropdown value)
                        const repoFullPath = r.path_with_namespace || r.name_with_namespace?.replace(/\s*\/\s*/g, '/') || r.full_name
                        return repoFullPath === selectedValue
                      })
                      
                      if (selectedRepo) {
                        // Use 'name' field for repo_name (as confirmed by user)
                        const repoName = selectedRepo.name || selectedRepo.repo_name || ''
                        // Use path_with_namespace for repo_full_name (cleaner format, no spaces)
                        const repoFullPath = selectedRepo.path_with_namespace || selectedRepo.name_with_namespace?.replace(/\s*\/\s*/g, '/') || selectedRepo.full_name || repoName
                        
                        // Store the complete repository object - ensure we have ALL fields from BE response
                        // Deep copy to preserve all properties including http_url_to_repo, path_with_namespace, etc.
                        const completeRepo = JSON.parse(JSON.stringify(selectedRepo))
                        // Ensure these fields are explicitly set (in case they're missing)
                        completeRepo.name = repoName
                        completeRepo.path_with_namespace = repoFullPath
                        
                        setFormData((prev) => ({
                          ...prev,
                          repo_name: repoName,
                          repo_full_name: repoFullPath,
                          selected_repo: completeRepo, // Store complete repo object for form submission
                        }))
                      } else {
                        // If repo not found, clear the selection
                        setFormData((prev) => {
                          const updated = { ...prev }
                          delete updated.repo_name
                          delete updated.repo_full_name
                          delete updated.selected_repo
                          return updated
                        })
                      }
                    }}
                    required={field.required}
                    disabled={!formData.scm_cred_id || !formData.repo_namespace}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      outline: 'none',
                      fontSize: '14px',
                      backgroundColor: (formData.scm_cred_id && formData.repo_namespace) ? '#ffffff' : '#f9fafb',
                      cursor: (formData.scm_cred_id && formData.repo_namespace) ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <option value="">Select Repository</option>
                    {repositories.map((repo) => {
                      const repoId = repo.id || repo.repo_id || repo._id || repo.name || ''
                      // Use 'name' field for display (as confirmed by user)
                      const repoName = repo.name || repo.repo_name || ''
                      // Use path_with_namespace for value (consistent with filtering, no spaces)
                      const repoFullPath = repo.path_with_namespace || repo.name_with_namespace?.replace(/\s*\/\s*/g, '/') || repo.full_name || repoName
                      const repoDescription = repo.description || ''
                      
                      return (
                        <option key={repoId} value={repoFullPath}>
                          {repoName} {repoDescription ? `- ${repoDescription.substring(0, 50)}${repoDescription.length > 50 ? '...' : ''}` : ''}
                        </option>
                      )
                    })}
                  </select>
                )}
                {!formData.scm_cred_id && (
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Please select SCM credentials first
                  </p>
                )}
                {formData.scm_cred_id && !formData.repo_namespace && (
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Please select a repository namespace first
                  </p>
                )}
                {repositories.length === 0 && !loadingRepositories && formData.scm_cred_id && formData.repo_namespace && (
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    No repositories found for this namespace. Please sync repositories first.
                  </p>
                )}
                {formData.repo_full_name && (
                  <input type="hidden" name="repo_full_name" value={formData.repo_full_name} />
                )}
              </div>
            )
          }

          // Special handling for branch field (SCM)
          if (field.name === 'branch' && sourceType === 'SCM') {
            return (
              <div key={field.name}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  {field.label || 'Branch'}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
                <input
                  type="text"
                  value={formData[field.name] || 'master/main'}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder || 'master/main'}
                  required={field.required}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                />
              </div>
            )
          }

          // Special handling for stack details (Manual)
          if (field.name === 'stack_details' && sourceType === 'Manual') {
            return (
              <div key={field.name}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  {field.label || 'Stack Details'}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder || 'Enter stack details (e.g., Node.js, Python, Java, etc.)'}
                  required={field.required}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            )
          }

          // Default field rendering
          return (
            <div key={field.name}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                {field.label}
                {field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  required={field.required}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select {field.label}</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder || ''}
                  required={field.required}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              ) : (
                <input
                  type={field.type || 'text'}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder || ''}
                  required={field.required}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
      <button
        type="submit"
        style={{
          marginTop: '24px',
          width: '100%',
          padding: '12px 16px',
          background: 'linear-gradient(to right, #3b82f6, #f97316)',
          color: '#ffffff',
          fontWeight: 500,
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          transition: 'opacity 0.15s',
          fontSize: '14px'
        }}
        onMouseEnter={(e) => e.target.style.opacity = '0.9'}
        onMouseLeave={(e) => e.target.style.opacity = '1'}
      >
        {form.submit_button_text || 'Submit'}
      </button>
    </form>
  )
}

// Pre-Input Form Component (shown before sending message to LLM)
const PreInputForm = ({ formConfig, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({})
  const [visibleFields, setVisibleFields] = useState(new Set())

  useEffect(() => {
    if (formConfig && formConfig.fields) {
      // Initialize visible fields based on show_if conditions
      const initialVisible = new Set()
      formConfig.fields.forEach((field) => {
        if (!field.show_if) {
          initialVisible.add(field.name)
        }
      })
      setVisibleFields(initialVisible)
    }
  }, [formConfig])

  const handleFieldChange = (name, value) => {
    const newFormData = { ...formData, [name]: value }
    setFormData(newFormData)
    
    // Handle conditional field visibility
    if (formConfig && formConfig.fields) {
      const updatedVisible = new Set(visibleFields)
      formConfig.fields.forEach((field) => {
        if (field.show_if) {
          const condition = field.show_if
          const shouldShow = newFormData[condition.field] === condition.value
          if (shouldShow) {
            updatedVisible.add(field.name)
          } else {
            updatedVisible.delete(field.name)
            // Clear the field value if it's hidden
            delete newFormData[field.name]
          }
        }
      })
      setVisibleFields(updatedVisible)
      setFormData(newFormData)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  if (!formConfig || !formConfig.fields) {
    return null
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{formConfig.title || 'Form'}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Cancel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formConfig.fields.map((field) => {
          if (!visibleFields.has(field.name)) {
            return null
          }

          return (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  required={field.required}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select {field.label}</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder || ''}
                  required={field.required}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
            </div>
          )
        })}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-[#F0F7FF] text-[#2196F3] font-medium rounded-lg hover:bg-[#E3F2FD] hover:shadow-md transition-opacity duration-150"
          >
            {formConfig.submit_button_text || 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}

// --- Jenkins Chat History localStorage helpers ---
const JENKINS_SESSIONS_KEY = 'jenkins_chat_sessions'

const loadJenkinsSessions = () => {
  try {
    const raw = localStorage.getItem(JENKINS_SESSIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveJenkinsSessions = (sessions) => {
  try {
    localStorage.setItem(JENKINS_SESSIONS_KEY, JSON.stringify(sessions))
  } catch (e) {
    console.error('Failed to save Jenkins chat sessions:', e)
  }
}

const groupJenkinsSessionsByDate = (sessions) => {
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

const JenkinsChatInterface = ({ isOpen, onClose, initialMessage }) => {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [showPreInputForm, setShowPreInputForm] = useState(false)
  const [preInputFormConfig, setPreInputFormConfig] = useState(null)
  const [lastSubmittedFormData, setLastSubmittedFormData] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const eventSourceRef = useRef(null)

  // --- Chat History Sidebar state ---
  const [chatSessions, setChatSessions] = useState(() => loadJenkinsSessions())
  const [activeLocalSessionId, setActiveLocalSessionId] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Persist current session to localStorage
  const persistCurrentSession = (localId, msgs, serverSessionId) => {
    setChatSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === localId
          ? { ...s, messages: msgs, serverSessionId: serverSessionId || s.serverSessionId, updatedAt: new Date().toISOString() }
          : s
      )
      saveJenkinsSessions(updated)
      return updated
    })
  }

  // Auto-title from first user message
  const updateJenkinsSessionTitle = (localId, title) => {
    setChatSessions((prev) => {
      const updated = prev.map((s) => (s.id === localId ? { ...s, title } : s))
      saveJenkinsSessions(updated)
      return updated
    })
  }

  // Start a new chat session
  const handleNewJenkinsChat = () => {
    // Close any SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    const newId = `jsession_${Date.now()}`
    const initMsg = initialMessage
      ? [{ role: 'assistant', content: initialMessage, type: 'text' }]
      : []
    const newSession = {
      id: newId,
      title: 'New conversation',
      messages: initMsg,
      serverSessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setChatSessions((prev) => {
      const updated = [newSession, ...prev]
      saveJenkinsSessions(updated)
      return updated
    })
    setActiveLocalSessionId(newId)
    setMessages(initMsg)
    setSessionId(null)
    setInputValue('')
    setStreamingMessage('')
    setShowPreInputForm(false)
    setPreInputFormConfig(null)
    setLastSubmittedFormData(null)
    setDeleteConfirmId(null)
  }

  // Load a previous session
  const handleLoadJenkinsSession = (session) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setActiveLocalSessionId(session.id)
    setMessages(session.messages || [])
    setSessionId(session.serverSessionId || null)
    setInputValue('')
    setStreamingMessage('')
    setIsLoading(false)
    setShowPreInputForm(false)
    setPreInputFormConfig(null)
    setLastSubmittedFormData(null)
    setDeleteConfirmId(null)
  }

  // Delete a session
  const handleDeleteJenkinsSession = (localId) => {
    setChatSessions((prev) => {
      const updated = prev.filter((s) => s.id !== localId)
      saveJenkinsSessions(updated)
      if (localId === activeLocalSessionId) {
        if (updated.length > 0) {
          const sorted = [...updated].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          handleLoadJenkinsSession(sorted[0])
        } else {
          handleNewJenkinsChat()
        }
      }
      return updated
    })
    setDeleteConfirmId(null)
  }

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const initializedRef = useRef(false)

  // On open: load most recent session or create new
  useEffect(() => {
    if (isOpen) {
      if (initializedRef.current) return
      initializedRef.current = true

      const sessions = loadJenkinsSessions()
      setChatSessions(sessions)
      if (sessions.length > 0 && !activeLocalSessionId) {
        const sorted = [...sessions].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        const latest = sorted[0]
        setActiveLocalSessionId(latest.id)
        setMessages(latest.messages || [])
        setSessionId(latest.serverSessionId || null)
      } else if (sessions.length === 0 && !activeLocalSessionId) {
        handleNewJenkinsChat()
      }
    } else {
      initializedRef.current = false
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setInputValue('')
      setStreamingMessage('')
      setShowPreInputForm(false)
      setPreInputFormConfig(null)
      setLastSubmittedFormData(null)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMessage])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Auto-save messages to localStorage whenever they change
  useEffect(() => {
    if (activeLocalSessionId && messages.length > 0) {
      persistCurrentSession(activeLocalSessionId, messages, sessionId)
      // Auto-title: use first user message
      const userMsgs = messages.filter((m) => m.role === 'user')
      if (userMsgs.length === 1) {
        const title = userMsgs[0].content.length > 40 ? userMsgs[0].content.substring(0, 40) + '…' : userMsgs[0].content
        updateJenkinsSessionTitle(activeLocalSessionId, title)
      }
    }
  }, [messages, sessionId])

  const showPreInputFormHandler = () => {
    // Add form to conversation when "Add Form" button is clicked
    const pipelineForm = {
      title: 'Pipeline Configuration',
      fields: [
        {
          name: 'source_type',
          label: 'Source Type',
          type: 'select',
          required: true,
          options: [
            { value: 'SCM', label: 'SCM' },
            { value: 'Manual', label: 'Manual' }
          ]
        },
        {
          name: 'scm_cred_id',
          label: 'SCM Credentials',
          type: 'select',
          required: false,
          show_if: {
            field: 'source_type',
            value: 'SCM'
          }
        },
        {
          name: 'repo_namespace',
          label: 'Repository Namespace',
          type: 'select',
          required: false,
          show_if: {
            field: 'source_type',
            value: 'SCM'
          }
        },
        {
          name: 'repo_name',
          label: 'Repository Name',
          type: 'text',
          required: false,
          placeholder: 'Search repositories...',
          show_if: {
            field: 'source_type',
            value: 'SCM'
          }
        },
        {
          name: 'branch',
          label: 'Branch',
          type: 'text',
          required: false,
          placeholder: 'master/main',
          show_if: {
            field: 'source_type',
            value: 'SCM'
          }
        },
        {
          name: 'stack_details',
          label: 'Stack Details',
          type: 'textarea',
          required: false,
          placeholder: 'Enter stack details (e.g., Node.js, Python, Java, etc.)',
          show_if: {
            field: 'source_type',
            value: 'Manual'
          }
        }
      ],
      submit_button_text: 'Generate Pipeline'
    }
    
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        type: 'form',
        form: pipelineForm,
        content: 'Please fill out the form to configure your pipeline.',
        requires_form: true,
      },
    ])
  }

  const cancelPreInputForm = () => {
    setShowPreInputForm(false)
    setPreInputFormConfig(null)
  }

  const handlePreInputFormSubmit = async (formData) => {
    setShowPreInputForm(false)
    setPreInputFormConfig(null)
    
    // Send form data along with message
    const userMessage = 'Build pipeline' // This would come from user input
    await sendMessageToLLM(userMessage, formData)
  }

  // Fallback function for regular API call (non-streaming)
  const handleRegularAPICall = async (userMessage, formData = null, currentSessionId = null) => {
    // Get valid chat token (automatically refreshes if expired)
    let chatToken
    try {
      chatToken = await getValidChatToken()
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Failed to get chat token. Please try again later.',
        },
      ])
      setIsLoading(false)
      // Don't logout - let user retry manually
      return
    }
    
    const chatApiUrl = import.meta.env.VITE_CHAT_API_BASE_URL || 'http://localhost:8081'
    const session = currentSessionId || sessionId || `jenkins-chat-${Date.now()}`
    
    try {
      const response = await fetch(
        `${chatApiUrl}/api/jenkins/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${chatToken}`,
          },
          body: JSON.stringify({
            message: userMessage,
            session_id: session,
            project_id: project?.id,
            has_form_data: !!formData,
            form_data: formData,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.session_id) {
        setSessionId(data.session_id)
      }
      
      if (data.type === 'form' || data.requires_form === true) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            type: 'form',
            form: data.form,
            content: data.message || data.content || '',
            requires_form: data.requires_form,
          },
        ])
      } else if (data.type === 'options' || data.requires_options === true) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            type: 'options',
            options: data.options,
            content: data.message || data.content || '',
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            type: 'text',
            content: data.response || data.message || data.content || 'No response received',
          },
        ])
      }
      setIsLoading(false)
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ])
      setIsLoading(false)
    }
  }

  const sendMessageToLLM = async (userMessage, formData = null) => {
    setIsLoading(true)
    setStreamingMessage('')
    
    // Get valid chat token (automatically refreshes if expired)
    let chatToken
    try {
      chatToken = await getValidChatToken()
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Failed to get chat token. Please try again later.',
        },
      ])
      setIsLoading(false)
      // Don't logout - let user retry manually
      return
    }
    
    const chatApiUrl = import.meta.env.VITE_CHAT_API_BASE_URL || 'http://localhost:8081'
    const currentSessionId = sessionId || `jenkins-chat-${Date.now()}`
    
    // Build query parameters
    const params = new URLSearchParams({
      message: userMessage,
    })
    
    if (currentSessionId) {
      params.append('session_id', currentSessionId)
    }
    
    if (project?.id) {
      params.append('project_id', project.id)
    }
    
    if (chatToken) {
      params.append('token', chatToken)
    }
    
    // Build SSE URL
    const sseUrl = `${chatApiUrl}/api/jenkins/chat/stream?${params.toString()}`
    
    try {
      // Close any existing EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      
      // Create new EventSource for SSE
      const eventSource = new EventSource(sseUrl)
      eventSourceRef.current = eventSource
      
      let accumulatedContent = ''
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'chunk') {
            // Accumulate streaming content
            accumulatedContent += data.content
            setStreamingMessage(accumulatedContent)
          } else if (data.type === 'done') {
            // Streaming complete - add final message
            eventSource.close()
            eventSourceRef.current = null
            
            // Determine message type based on response
            let messageType = data.response_type || 'text'
            if (data.form || data.requires_form === true) {
              messageType = 'form'
            } else if (data.options || data.requires_options === true) {
              messageType = 'options'
            }
            
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                type: messageType,
                content: accumulatedContent || data.content || '',
                form: data.form,
                options: data.options,
                requires_form: data.requires_form,
              },
            ])
            
            setStreamingMessage('')
            setIsLoading(false)
            
            // Update session ID if provided
            if (data.session_id) {
              setSessionId(data.session_id)
            }
          } else if (data.type === 'error') {
            // Handle error
            eventSource.close()
            eventSourceRef.current = null
            
            // Check if it's an authentication error
            if (data.message === 'Unauthorized' || data.message?.toLowerCase().includes('unauthorized')) {
              const currentChatToken = getChatToken()
              
              // Only show error message - don't auto-redirect
              // This is likely a backend configuration issue (not reading token from query param)
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  content: 'Authentication error: Backend rejected the request. This might be a backend configuration issue. Please check backend logs.',
                },
              ])
              
              // Don't auto-redirect - let user know it might be a backend issue
              // setTimeout(() => {
              //   handleSessionExpiration()
              // }, 2000)
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  content: data.message || 'Sorry, I encountered an error. Please try again.',
                },
              ])
            }
            
            setStreamingMessage('')
            setIsLoading(false)
          }
        } catch (parseError) {
          // Silently handle parse errors
        }
      }
      
      eventSource.onerror = (error) => {
        // Check if connection is closed
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSource.close()
          eventSourceRef.current = null
          
          // Fallback to regular API call - don't logout
          handleRegularAPICall(userMessage, formData, currentSessionId)
        } else {
          // Connection might be reconnecting, don't close yet
        }
      }
      
    } catch (error) {
      
      // Fallback to regular API call - don't logout
      await handleRegularAPICall(userMessage, formData, currentSessionId)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage, type: 'text' }])
    
    await sendMessageToLLM(userMessage)
  }

  // Handle code regeneration - request BE to generate new pipeline code
  const handleRegenerateCode = async (messageIndex) => {
    try {
      
      // Get valid chat token
      const chatToken = await getValidChatToken()
      const chatApiUrl = import.meta.env.VITE_CHAT_API_BASE_URL || 'http://localhost:8081'
      const currentSessionId = sessionId || `jenkins-chat-${Date.now()}`
      
      // Build regenerate message - include last submitted form data if available
      let regenerateMessage = 'regenerate pipeline code'
      if (lastSubmittedFormData) {
        // Include form data in the message so backend doesn't ask for it again
        regenerateMessage = `regenerate pipeline code with previous form data: ${JSON.stringify(lastSubmittedFormData)}`
      }
      
      // Send regenerate request to backend via SSE
      // Use the same message format as regular chat, but with regenerate flag
      const params = new URLSearchParams({
        message: regenerateMessage,
        session_id: currentSessionId,
      })
      
      if (chatToken) {
        params.append('token', chatToken)
      }

      if (project?.id) {
        params.append('project_id', project.id)
      }
      
      const sseUrl = `${chatApiUrl}/api/jenkins/chat/stream?${params.toString()}`
      
      // Close any existing EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      
      setIsLoading(true)
      setStreamingMessage('')
      
      // Create new EventSource for SSE
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
            eventSource.close()
            eventSourceRef.current = null
            
            let messageType = data.response_type || 'text'
            if (data.form || data.requires_form === true) {
              messageType = 'form'
              // If backend asks for form during regeneration and we have previous form data, auto-submit it
              if (lastSubmittedFormData && Object.keys(lastSubmittedFormData).length > 0) {
                // Auto-submit the previous form data
                const currentSessionId = data.session_id || sessionId || `jenkins-chat-${Date.now()}`
                handleFormSubmit(lastSubmittedFormData, currentSessionId)
                return // Don't add the form message, just auto-submit
              }
            } else if (data.options || data.requires_options === true) {
              messageType = 'options'
            }
            
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                type: messageType,
                content: accumulatedContent || data.content || '',
                form: data.form,
                options: data.options,
                requires_form: data.requires_form,
              },
            ])
            
            setStreamingMessage('')
            setIsLoading(false)
            
            if (data.session_id) {
              setSessionId(data.session_id)
            }
          } else if (data.type === 'error') {
            eventSource.close()
            eventSourceRef.current = null
            setStreamingMessage('')
            setIsLoading(false)
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: data.message || 'Error regenerating code. Please try again.',
              },
            ])
          }
        } catch (parseError) {
          // Silently handle parse errors
        }
      }
      
      eventSource.onerror = (error) => {
        eventSource.close()
        eventSourceRef.current = null
        setIsLoading(false)
        setStreamingMessage('')
        // Fallback to regular API call
        handleRegularAPICall('regenerate pipeline code', null, currentSessionId)
      }
    } catch (error) {
      setIsLoading(false)
      setStreamingMessage('')
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error regenerating the code. Please try again.',
        },
      ])
    }
  }

  // Handle code confirmation - show done message
  const handleConfirmCode = () => {
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '✅ Done! Pipeline code confirmed.',
        type: 'text',
      },
    ])
  }

  const handleFormSubmit = async (formData, formSessionId) => {
    setIsLoading(true)
    
    let chatToken
    try {
      chatToken = await getValidChatToken()
    } catch (error) {
      setIsLoading(false)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Failed to get chat token. Please try again later.',
        },
      ])
      return
    }
    
    const chatApiUrl = import.meta.env.VITE_CHAT_API_BASE_URL || 'http://localhost:8081'
    
    // Build payload with only the fields BE accepts: repo_url, branch, output_filename
    let submissionPayload = {}
    
    // Send form data directly to BE - BE will handle extraction
    // For SCM: send source_type, scm_cred_id, repo_namespace, repo_name, branch, and selected_repo object
    // For Manual: send source_type and stack_details
    if (formData && formData.source_type === 'SCM') {
      // Send all form data including the complete repository object
      submissionPayload = {
        source_type: formData.source_type,
        scm_cred_id: formData.scm_cred_id,
        repo_namespace: formData.repo_namespace,
        repo_name: formData.repo_name,
        repo_full_name: formData.repo_full_name,
        branch: formData.branch || 'master/main',
        selected_repo: formData.selected_repo, // Complete repository object from BE response
      }
    } else if (formData && formData.source_type === 'Manual') {
      submissionPayload = {
        source_type: formData.source_type,
        stack_details: formData.stack_details || '',
      }
    } else {
      setIsLoading(false)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error: Invalid form data. Please fill out the form correctly and try again.',
          type: 'error',
        },
      ])
      return
    }
    
    // Final validation - ensure we have a valid payload
    if (!submissionPayload || Object.keys(submissionPayload).length === 0) {
      setIsLoading(false)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error: Form data is incomplete. Please fill out all required fields and try again.',
          type: 'error',
        },
      ])
      return
    }
    
    // Basic validation - ensure we have required fields
    if (formData && formData.source_type === 'SCM') {
      if (!submissionPayload.scm_cred_id || !submissionPayload.repo_namespace || !submissionPayload.repo_name) {
        setIsLoading(false)
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Error: Please fill out all required fields (SCM credentials, namespace, and repository).',
            type: 'error',
          },
        ])
        return
      }
    }
    
    // Store the submitted form data for regeneration (only for SCM with valid data)
    if (formData && formData.source_type === 'SCM' && submissionPayload.selected_repo) {
      setLastSubmittedFormData(submissionPayload)
    }
    
    const requestPayload = {
      query: 'submit',
      session_id: formSessionId || sessionId,
      project_id: project?.id,
      is_form_submission: true,
      form_data: submissionPayload,
    }
    
    try {
      const response = await fetch(
        `${chatApiUrl}/api/jenkins/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${chatToken}`,
          },
          body: JSON.stringify(requestPayload),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Handle error responses from backend
      if (data.error || data.type === 'error') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            type: 'error',
            content: data.message || data.error || 'An error occurred while submitting the form. Please try again.',
          },
        ])
        setIsLoading(false)
        return // Don't close the interface, just show the error
      }
      
      if (data.session_id) {
        setSessionId(data.session_id)
      }
      
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          type: data.type || 'text',
          content: data.response || data.message || data.content || 'Form submitted successfully',
          form: data.form,
          options: data.options,
        },
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error submitting the form: ${error.message || 'Please try again.'}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleOptionSelect = (data) => {
    if (data.session_id) {
      setSessionId(data.session_id)
    }
    
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        type: data.type || 'text',
        content: data.response || data.message || data.content || '',
        form: data.form,
        options: data.options,
      },
    ])
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  if (!isOpen) {
    return null
  }

  // --- Grouped sessions for sidebar ---
  const grouped = groupJenkinsSessionsByDate(chatSessions)

  const renderSessionGroup = (label, sessions) => {
    if (sessions.length === 0) return null
    return (
      <div key={label} style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', padding: '0 12px', marginBottom: '6px' }}>
          {label}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => handleLoadJenkinsSession(s)}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${s.id === activeLocalSessionId
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 text-emerald-700 font-bold shadow-sm shadow-emerald-900/5'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm'
                }`}
            >
              <svg className={`w-3.5 h-3.5 flex-shrink-0 ${s.id === activeLocalSessionId ? 'text-emerald-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="flex-1 text-xs truncate overflow-hidden whitespace-nowrap">{s.title}</span>
              {deleteConfirmId === s.id ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleDeleteJenkinsSession(s.id)} className="p-0.5 text-red-500 hover:text-red-700 transition-colors" title="Confirm delete">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <button onClick={() => setDeleteConfirmId(null)} className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors" title="Cancel">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <button
                  data-delete-btn
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(s.id) }}
                  className="p-0.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                  title="Delete conversation"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const chatInterface = (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}
    >
      {/* ===== Chat History Sidebar ===== */}
      <div style={{
        width: isSidebarOpen ? '260px' : '0px',
        minWidth: isSidebarOpen ? '260px' : '0px',
        borderRight: isSidebarOpen ? '1px solid #e5e7eb' : 'none',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease-in-out',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: '16px 16px 12px', flexShrink: 0 }}>
          <button
            onClick={() => handleNewJenkinsChat()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_16px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 transition-all duration-300 group"
          >
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
        {/* Session List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 16px' }}>
          {chatSessions.length === 0 ? (
            <div style={{ padding: '32px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>No conversations yet</p>
            </div>
          ) : (
            <>
              {renderSessionGroup('Today', grouped.today)}
              {renderSessionGroup('Yesterday', grouped.yesterday)}
              {renderSessionGroup('Previous 7 Days', grouped.week)}
              {renderSessionGroup('Older', grouped.older)}
            </>
          )}
        </div>
      </div>

      {/* ===== Main Chat Column ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '16px 24px', 
        borderBottom: '1px solid #e5e7eb', 
        backgroundColor: '#ffffff', 
        minHeight: '64px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Sidebar toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              padding: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '6px',
              color: '#64748b',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#334155' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b' }}
            title={isSidebarOpen ? 'Hide history' : 'Show history'}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
          <img
            src="/icons8-jenkins-color-16.png"
            alt="Jenkins Logo"
            style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            onError={(e) => {
              e.target.onerror = null
              e.target.src = 'https://img.icons8.com/color/32/jenkins.png'
            }}
          />
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Jenkins Agent</h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Version 2.426.1 • Active</p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '8px',
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          aria-label="Close chat"
        >
          <svg
            style={{ width: '20px', height: '20px', color: '#475569' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Messages Area */}
      <div style={{ 
        flex: '1 1 auto', 
        overflowY: 'auto', 
        backgroundColor: '#f9fafb', 
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 16px', width: '100%' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
              <div style={{ textAlign: 'center' }}>
                <svg
                  style={{ width: '64px', height: '64px', margin: '0 auto 16px', opacity: 0.5 }}
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
                <p style={{ fontSize: '14px', color: '#6b7280' }}>Start a conversation with Jenkins Agent</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {messages.map((message, index) => (
                <div
                  key={index}
                  style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}
                >
                  {message.role === 'assistant' && (
                    <div style={{ flexShrink: 0, marginRight: '12px' }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #10b981, #0d9488)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <img
                          src="/icons8-jenkins-color-16.png"
                          alt="Jenkins"
                          style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                          onError={(e) => {
                            e.target.onerror = null
                            e.target.src = 'https://img.icons8.com/color/24/jenkins.png'
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {message.type === 'options' && message.role === 'assistant' ? (
                    <div style={{ maxWidth: '85%', width: '100%' }}>
                      {message.content && (
                        <div style={{ marginBottom: '12px', fontSize: '14px', color: '#1f2937', wordBreak: 'break-word', lineHeight: '1.6' }}>
                          <ReactMarkdown
                            skipHtml={false}
                            remarkPlugins={[remarkGfm]}
                            components={createMarkdownComponents(messages, message, handleRegenerateCode, handleConfirmCode)}
                          >
                            {preprocessMarkdown(message.content)}
                          </ReactMarkdown>
                        </div>
                      )}
                      <OptionsMenu 
                        options={message.options} 
                        sessionId={sessionId || `jenkins-chat-${Date.now()}`}
                        onSelect={handleOptionSelect}
                      />
                    </div>
                  ) : (message.type === 'form' || message.requires_form) && message.role === 'assistant' ? (
                    <div 
                      style={{ maxWidth: '85%', width: '100%' }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        return null
                      })()}
                      {message.content && (
                        <div style={{ marginBottom: '12px', fontSize: '14px', color: '#1f2937', wordBreak: 'break-word', lineHeight: '1.6' }}>
                          <ReactMarkdown
                            skipHtml={false}
                            remarkPlugins={[remarkGfm]}
                            components={createMarkdownComponents(messages, message, handleRegenerateCode, handleConfirmCode)}
                          >
                            {preprocessMarkdown(message.content)}
                          </ReactMarkdown>
                        </div>
                      )}
                      {message.form ? (
                        <FormComponent 
                          form={message.form} 
                          sessionId={sessionId || `jenkins-chat-${Date.now()}`}
                          onSubmit={handleFormSubmit}
                        />
                      ) : (
                        <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
                          Error: Form data is missing. Message type: {message.type}, Has form: {message.form ? 'Yes' : 'No'}, Requires form: {message.requires_form ? 'Yes' : 'No'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        maxWidth: '85%',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        background: message.role === 'user' 
                          ? '#059669' 
                          : '#ffffff',
                        backgroundColor: message.role === 'user' ? undefined : '#ffffff',
                        color: message.role === 'user' ? '#ffffff' : '#1f2937',
                        border: message.role === 'user' ? 'none' : '1px solid #e5e7eb',
                        boxShadow: message.role === 'user' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      {message.role === 'user' ? (
                        <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.6', margin: 0, color: '#ffffff' }}>
                          {message.content}
                        </p>
                      ) : (
                        <div style={{ fontSize: '14px', wordBreak: 'break-word', lineHeight: '1.6', color: '#1f2937' }}>
                          {message.content ? (
                            <ReactMarkdown
                              skipHtml={false}
                              remarkPlugins={[remarkGfm]}
                              components={createMarkdownComponents(messages, message, handleRegenerateCode, handleConfirmCode)}
                            >
                              {preprocessMarkdown(message.content)}
                            </ReactMarkdown>
                          ) : (
                            <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No content</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {message.role === 'user' && (
                    <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%', 
                        backgroundColor: '#e2e8f0', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <svg
                          style={{ width: '20px', height: '20px', color: '#475569' }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Pre-Input Form */}
              {showPreInputForm && preInputFormConfig && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ maxWidth: '85%', width: '100%' }}>
                    <PreInputForm
                      formConfig={preInputFormConfig}
                      onSubmit={handlePreInputFormSubmit}
                      onCancel={cancelPreInputForm}
                    />
                  </div>
                </div>
              )}
              
              {/* Streaming message or loading indicator */}
              {(isLoading || streamingMessage) && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ flexShrink: 0, marginRight: '12px' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: 'linear-gradient(to right, #3b82f6, #f97316)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Jenkins_logo.svg"
                        alt="Jenkins"
                        style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ 
                    backgroundColor: '#ffffff', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px', 
                    padding: '12px 16px', 
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    maxWidth: '85%'
                  }}>
                    {streamingMessage ? (
                      <div style={{ fontSize: '14px', wordBreak: 'break-word', lineHeight: '1.6', color: '#1f2937' }}>
                        <ReactMarkdown
                          skipHtml={false}
                          remarkPlugins={[remarkGfm]}
                          components={createMarkdownComponents(null, null, handleRegenerateCode, handleConfirmCode)}
                        >
                          {preprocessMarkdown(streamingMessage)}
                        </ReactMarkdown>
                        <span style={{ display: 'inline-block', width: '8px', height: '16px', backgroundColor: '#10b981', marginLeft: '4px', animation: 'pulse 1s infinite' }}></span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-soft"></div>
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse-soft" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse-soft" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-5 bg-white border-t border-slate-100 flex-shrink-0 relative z-10 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
        <div className="max-w-4xl mx-auto w-full">
          {!showPreInputForm && (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={showPreInputFormHandler}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100 rounded-full transition-all duration-200 border border-emerald-100 shadow-sm"
                title="Show input form"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Add Form</span>
              </button>
            </div>
          )}
          
          <form onSubmit={handleSend} className="relative mb-2">
            <div className="relative group flex items-end">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl blur opacity-0 group-focus-within:opacity-25 transition duration-500 pointer-events-none"></div>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message Jenkins Agent..."
                rows={1}
                className="relative w-full pl-6 pr-16 py-4 bg-slate-50 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl text-sm focus:outline-none focus:border-emerald-400/50 focus:bg-white transition-all duration-300 text-slate-800 placeholder-slate-400 block resize-none min-h-[56px] max-h-[200px]"
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
                }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 bottom-2 w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-xl shadow-md disabled:shadow-none hover:shadow-lg disabled:opacity-40 disabled:from-slate-400 disabled:to-slate-400 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                {isLoading ? (
                  <svg
                    style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }}
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      style={{ opacity: 0.25 }}
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      style={{ opacity: 0.75 }}
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <svg
                    style={{ width: '20px', height: '20px' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </form>
          <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', textAlign: 'center', marginBottom: '0' }}>
            Jenkins Agent can help you with CI/CD pipelines, builds, and deployments
          </p>
        </div>
      </div>
      {/* End Main Chat Column */}
      </div>
    </div>
  )

  // Render using portal to ensure it's above everything
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(chatInterface, document.body)
  }
  return chatInterface
}

export default JenkinsChatInterface

