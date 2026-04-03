import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getToken, getChatToken, getValidChatToken, isAuthenticated, isTokenExpired } from '../services/authService'
import { getSCMCredentials } from '../services/credentialService'
import ReactMarkdown from 'react-markdown'
import hljs from 'highlight.js'
import groovy from 'highlight.js/lib/languages/groovy'
import bash from 'highlight.js/lib/languages/bash'
import 'highlight.js/styles/github-dark.css' // Dark theme similar to vscDarkPlus

// Register languages explicitly (some may not be included by default)
hljs.registerLanguage('groovy', groovy)
hljs.registerLanguage('bash', bash)

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

// Shared markdown components configuration for consistent rendering
const createMarkdownComponents = (messages, message, handleRegenerateCode, handleConfirmCode) => {
  const messageIndex = messages ? messages.findIndex(m => m === message) : -1
  
  return {
    // Headings
    h1: ({ children }) => <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', marginTop: '20px', lineHeight: '1.4', color: '#111827' }}>{children}</h1>,
    h2: ({ children }) => <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', marginTop: '18px', lineHeight: '1.4', color: '#111827' }}>{children}</h2>,
    h3: ({ children }) => <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', marginTop: '16px', lineHeight: '1.4', color: '#111827' }}>{children}</h3>,
    h4: ({ children }) => <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', marginTop: '14px', lineHeight: '1.4', color: '#1f2937' }}>{children}</h4>,
    h5: ({ children }) => <h5 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', marginTop: '12px', lineHeight: '1.4', color: '#1f2937' }}>{children}</h5>,
    h6: ({ children }) => <h6 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', marginTop: '12px', lineHeight: '1.4', color: '#374151' }}>{children}</h6>,
    
    // Paragraphs
    p: ({ children }) => <p style={{ marginBottom: '12px', marginTop: 0, lineHeight: '1.7', color: '#1f2937' }}>{children}</p>,
    
    // Lists
    ul: ({ children }) => <ul style={{ listStyle: 'disc', paddingLeft: '24px', marginBottom: '12px', marginTop: '8px' }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ listStyle: 'decimal', paddingLeft: '24px', marginBottom: '12px', marginTop: '8px' }}>{children}</ol>,
    li: ({ children, checked }) => {
      // Handle task list items
      if (checked !== null && checked !== undefined) {
        return (
          <li style={{ marginBottom: '6px', lineHeight: '1.6', listStyle: 'none', paddingLeft: '0' }}>
            <input type="checkbox" checked={checked} readOnly style={{ marginRight: '8px', cursor: 'default' }} />
            <span style={{ textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.7 : 1 }}>{children}</span>
          </li>
        )
      }
      return <li style={{ marginBottom: '6px', lineHeight: '1.6' }}>{children}</li>
    },
    
    // Pre blocks - ReactMarkdown wraps code blocks in <pre><code className="language-xxx">
    pre: ({ children }) => {
      // ReactMarkdown wraps code blocks: <pre><code className="language-xxx">content</code></pre>
      // The children is the <code> element, so we need to extract it
      if (children && typeof children === 'object') {
        // Check if children is a code element or has code element structure
        const codeElement = React.Children.toArray(children).find(
          child => child && typeof child === 'object' && 
          (child.type === 'code' || (child.props && /language-/.test(child.props.className || '')))
        )
        
        if (codeElement) {
          const codeProps = codeElement.props || {}
          const className = codeProps.className || ''
          const match = /language-([\w-]+)/i.exec(className || '')
          
          if (match) {
            const language = match[1].toLowerCase().trim()
            const isGroovy = language === 'groovy'
            const codeContent = codeProps.children || codeElement.children || ''
            
            return (
              <CodeBlock 
                className={className} 
                onRegenerate={isGroovy && handleRegenerateCode ? () => handleRegenerateCode(messageIndex) : undefined}
                onConfirmed={isGroovy && handleConfirmCode ? handleConfirmCode : undefined}
              >
                {String(codeContent).replace(/\n$/, '')}
              </CodeBlock>
            )
          }
        }
        
        // Check if children itself is a code element
        if (children.type === 'code' || (children.props && /language-/.test(children.props.className || ''))) {
          const codeProps = children.props || {}
          const className = codeProps.className || ''
          const match = /language-([\w-]+)/i.exec(className || '')
          
          if (match) {
            const language = match[1].toLowerCase().trim()
            const isGroovy = language === 'groovy'
            const codeContent = codeProps.children || children.children || ''
            
            return (
              <CodeBlock 
                className={className} 
                onRegenerate={isGroovy && handleRegenerateCode ? () => handleRegenerateCode(messageIndex) : undefined}
                onConfirmed={isGroovy && handleConfirmCode ? handleConfirmCode : undefined}
              >
                {String(codeContent).replace(/\n$/, '')}
              </CodeBlock>
            )
          }
        }
      }
      
      // Regular pre block without code
      return <pre style={{ 
        backgroundColor: '#f3f4f6', 
        padding: '12px', 
        borderRadius: '6px', 
        marginTop: '16px', 
        marginBottom: '16px', 
        overflowX: 'auto', 
        fontSize: '13px', 
        lineHeight: '1.5',
        border: '1px solid #e5e7eb'
      }}>{children}</pre>
    },
    
    // Code blocks - handle both inline and block code
    code: ({ node, inline, className, children, ...props }) => {
      // Inline code - render as styled span
      if (inline) {
        return (
          <code style={{ 
            backgroundColor: '#f3f4f6', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            fontSize: '12px', 
            fontFamily: 'monospace', 
            color: '#1f2937',
            border: '1px solid #e5e7eb'
          }}>
            {children}
          </code>
        )
      }
      
      // Block code - check if it has a language class
      // Use case-insensitive regex to handle "language-Groovy", "language-groovy", etc.
      const match = /language-([\w-]+)/i.exec(className || '')
      if (match) {
        const language = match[1].toLowerCase().trim()
        const isGroovy = language === 'groovy'
        
        // Debug logging for groovy
        if (isGroovy) {
          console.log('[Markdown code] ✅ GROOVY DETECTED!', { className, language, childrenLength: String(children).length })
        }
        
        return (
          <CodeBlock 
            className={className} 
            onRegenerate={isGroovy && handleRegenerateCode ? () => handleRegenerateCode(messageIndex) : undefined}
            onConfirmed={isGroovy && handleConfirmCode ? handleConfirmCode : undefined}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </CodeBlock>
        )
      }
      
      // Block code without language - return as-is (will be wrapped by pre)
      if (className && className.includes('groovy')) {
        console.warn('[Markdown code] ⚠️ Groovy in className but no match!', className)
      }
      
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
    
    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote style={{ 
        borderLeft: '4px solid #3b82f6', 
        paddingLeft: '16px', 
        margin: '12px 0',
        paddingTop: '8px',
        paddingBottom: '8px',
        backgroundColor: '#eff6ff',
        borderRadius: '4px',
        fontStyle: 'italic', 
        color: '#1e40af'
      }}>
        {children}
      </blockquote>
    ),
    
    // Links
    a: ({ href, children }) => (
      <a 
        href={href} 
        style={{ 
          color: '#2563eb', 
          textDecoration: 'underline',
          fontWeight: 500
        }} 
        target="_blank" 
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    
    // Text formatting
    strong: ({ children }) => <strong style={{ fontWeight: 600, color: '#111827' }}>{children}</strong>,
    em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
    
    // Horizontal rule
    hr: () => <hr style={{ border: 'none', borderTop: '2px solid #e5e7eb', margin: '20px 0' }} />,
    
    // Tables
    table: ({ children }) => (
      <div style={{ overflowX: 'auto', marginBottom: '16px', marginTop: '16px' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead style={{ backgroundColor: '#f9fafb' }}>{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children, isHeader }) => (
      <tr style={{ 
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: isHeader ? '#f9fafb' : 'transparent'
      }}>
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th style={{ 
        padding: '10px 12px', 
        textAlign: 'left', 
        fontWeight: 600, 
        color: '#111827',
        borderRight: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td style={{ 
        padding: '10px 12px', 
        borderRight: '1px solid #e5e7eb',
        color: '#1f2937'
      }}>
        {children}
      </td>
    ),
    
    // Images
    img: ({ src, alt }) => (
      <img 
        src={src} 
        alt={alt || ''} 
        style={{ 
          maxWidth: '100%', 
          height: 'auto', 
          borderRadius: '6px',
          margin: '12px 0',
          border: '1px solid #e5e7eb'
        }} 
      />
    ),
    
    // Line breaks
    br: () => <br />,
  }
}

// Language mapping - moved outside component for better performance
const LANGUAGE_MAP = {
  'groovy': 'groovy',
  'java': 'java',
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'python': 'python',
  'py': 'python',
  'bash': 'bash',
  'sh': 'bash',
  'shell': 'bash',
  'yaml': 'yaml',
  'yml': 'yaml',
  'json': 'json',
  'xml': 'xml',
  'html': 'xml',
  'css': 'css',
  'sql': 'sql',
  'dockerfile': 'dockerfile',
  'docker': 'dockerfile',
}

// Cache for highlighted code to avoid re-highlighting same content
const highlightCache = new Map()
const CACHE_SIZE_LIMIT = 100

// CodeBlock component with copy button, regenerate, and confirmed buttons (only for groovy)
const CodeBlock = ({ children, className, onRegenerate, onConfirmed, ...props }) => {
  const [copied, setCopied] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const codeRef = useRef(null)
  const highlightTimeoutRef = useRef(null)
  const observerRef = useRef(null)
  const isHighlightedRef = useRef(false)
  
  // Extract language from className
  const match = /language-([\w-]+)/i.exec(className || '')
  const language = match ? match[1].toLowerCase().trim() : ''
  const hljsLanguage = LANGUAGE_MAP[language] || language || null
  const isGroovy = language === 'groovy'
  
  // Get the code string
  const codeString = typeof children === 'string' ? children : String(children).replace(/\n$/, '')
  
  // Generate cache key
  const cacheKey = React.useMemo(() => {
    return `${hljsLanguage || 'auto'}:${codeString.length}:${codeString.slice(0, 50)}`
  }, [hljsLanguage, codeString])
  
  // Function to check if highlighting is needed
  const needsHighlighting = (element) => {
    if (!element) return false
    
    if (element.classList.contains('hljs') && element.innerHTML.includes('<span class="')) {
      return false
    }
    
    const html = element.innerHTML
    if (html.includes('<span class="')) return false
    
    const textContent = element.textContent || element.innerText || ''
    return textContent.trim() === codeString.trim() || html === codeString
  }
  
  // Function to apply highlighting
  const applyHighlighting = () => {
    const element = codeRef.current
    if (!element || !codeString) return
    
    if (!needsHighlighting(element)) {
      isHighlightedRef.current = true
      return
    }
    
    try {
      // Check cache first
      let highlighted = highlightCache.get(cacheKey)
      
      if (!highlighted) {
        // Generate highlighted code
        if (hljsLanguage && hljs.getLanguage(hljsLanguage)) {
          highlighted = hljs.highlight(codeString, { language: hljsLanguage }).value
        } else {
          highlighted = hljs.highlightAuto(codeString).value
        }
        
        // Cache the result
        if (highlightCache.size >= CACHE_SIZE_LIMIT) {
          const firstKey = highlightCache.keys().next().value
          highlightCache.delete(firstKey)
        }
        highlightCache.set(cacheKey, highlighted)
      }
      
      // Apply highlighting
      element.innerHTML = highlighted
      element.classList.add('hljs')
      isHighlightedRef.current = true
    } catch (error) {
      if (element && !element.classList.contains('hljs')) {
        element.textContent = codeString
      }
      isHighlightedRef.current = false
    }
  }

  // Highlight code using highlight.js
  useEffect(() => {
    const element = codeRef.current
    if (!element) return
    
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current)
    }
    
    highlightTimeoutRef.current = setTimeout(() => {
      applyHighlighting()
    }, 0)
    
    // MutationObserver to re-apply if ReactMarkdown overwrites it
    if (!observerRef.current) {
      let debounceTimer = null
      
      observerRef.current = new MutationObserver((mutations) => {
        if (isHighlightedRef.current) {
          const html = element.innerHTML
          if (!element.classList.contains('hljs') || !html.includes('<span')) {
            isHighlightedRef.current = false
          } else {
            return
          }
        }
        
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        
        debounceTimer = setTimeout(() => {
          if (needsHighlighting(element)) {
            applyHighlighting()
          }
        }, 50)
      })
      
      observerRef.current.observe(element, {
        childList: true,
        subtree: false,
        characterData: false,
      })
    }
    
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      isHighlightedRef.current = false
    }
  }, [codeString, hljsLanguage])

  const handleCopy = async () => {
    try {
      // Copy with exact indentation preserved
      await navigator.clipboard.writeText(codeString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
    }
  }

  const handleRegenerate = async () => {
    if (onRegenerate && !isRegenerating) {
      setIsRegenerating(true)
      try {
        await onRegenerate()
      } catch (error) {
      } finally {
        setIsRegenerating(false)
      }
    }
  }

  const handleConfirmed = () => {
    if (onConfirmed) {
      onConfirmed()
    }
  }

  return (
    <div 
      className="relative group" 
      style={{ 
        marginTop: '20px', 
        marginBottom: '20px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Header with language label and copy button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {language && (
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {language}
          </div>
        )}
        <button
          onClick={handleCopy}
          style={{
            padding: '4px 8px',
            backgroundColor: copied ? '#10b981' : 'transparent',
            color: copied ? '#ffffff' : '#6b7280',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.target.style.backgroundColor = '#f3f4f6'
              e.target.style.borderColor = '#d1d5db'
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              e.target.style.backgroundColor = 'transparent'
              e.target.style.borderColor = '#e5e7eb'
            }
          }}
          title="Copy code"
        >
          {copied ? (
            <>
              <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      
      {/* Code content */}
      <div style={{ position: 'relative', overflow: 'auto' }}>
        <pre style={{
          margin: 0,
          padding: '16px',
          fontSize: '13px',
          lineHeight: '1.6',
          fontFamily: '"Fira Code", "Consolas", "Monaco", "Courier New", monospace',
          backgroundColor: '#0d1117', // GitHub dark theme background
          color: '#c9d1d9',
          overflowX: 'auto',
        }}>
          <code
            ref={codeRef}
            className={hljsLanguage ? `hljs language-${hljsLanguage}` : 'hljs'}
            style={{
              fontFamily: '"Fira Code", "Consolas", "Monaco", "Courier New", monospace',
              fontSize: '13px',
              display: 'block',
              whiteSpace: 'pre',
              wordWrap: 'normal',
              wordBreak: 'normal',
            }}
          >
            {codeString}
          </code>
        </pre>
      </div>
      {/* Regenerate and Confirmed buttons below code block - ONLY for groovy */}
      {isGroovy && (onRegenerate || onConfirmed) && (
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          padding: '12px',
          backgroundColor: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          justifyContent: 'flex-end' 
        }}>
          {onRegenerate && (
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              style={{
                padding: '8px 16px',
                backgroundColor: isRegenerating ? '#9ca3af' : '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isRegenerating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                boxShadow: isRegenerating ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              }}
              onMouseEnter={(e) => {
                if (!isRegenerating) {
                  e.target.style.backgroundColor = '#2563eb'
                  e.target.style.boxShadow = '0 2px 4px 0 rgba(0, 0, 0, 0.1)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isRegenerating) {
                  e.target.style.backgroundColor = '#3b82f6'
                  e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }
              }}
            >
              {isRegenerating ? (
                <>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid #ffffff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span>Regenerating...</span>
                </>
              ) : (
                <>
                  <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Regenerate</span>
                </>
              )}
            </button>
          )}
          {onConfirmed && (
            <button
              onClick={handleConfirmed}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#059669'
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#10b981'
              }}
            >
              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Confirmed</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

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

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && initialMessage && messages.length === 0) {
      setMessages([{ role: 'assistant', content: initialMessage, type: 'text' }])
    }
  }, [isOpen, initialMessage])

  useEffect(() => {
    if (!isOpen) {
      setMessages([])
      setInputValue('')
      setStreamingMessage('')
      setSessionId(null)
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
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}
    >
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
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Jenkins_logo.svg"
            alt="Jenkins Logo"
            style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            onError={(e) => {
              e.target.style.display = 'none'
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
                  )}
                  {message.type === 'options' && message.role === 'assistant' ? (
                    <div style={{ maxWidth: '85%', width: '100%' }}>
                      {message.content && (
                        <div style={{ marginBottom: '12px', fontSize: '14px', color: '#1f2937', wordBreak: 'break-word', lineHeight: '1.6' }}>
                          <ReactMarkdown
                            skipHtml={false}
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
                          ? 'linear-gradient(to right, #3b82f6, #f97316)' 
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
                          components={createMarkdownComponents(null, null, handleRegenerateCode, handleConfirmCode)}
                        >
                          {preprocessMarkdown(streamingMessage)}
                        </ReactMarkdown>
                        <span style={{ display: 'inline-block', width: '8px', height: '16px', backgroundColor: '#3b82f6', marginLeft: '4px', animation: 'pulse 1s infinite' }}></span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#9ca3af', borderRadius: '50%', animation: 'bounce 1s infinite' }}></div>
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#9ca3af', borderRadius: '50%', animation: 'bounce 1s infinite', animationDelay: '0.1s' }}></div>
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#9ca3af', borderRadius: '50%', animation: 'bounce 1s infinite', animationDelay: '0.2s' }}></div>
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
      <div style={{ 
        borderTop: '1px solid #e5e7eb', 
        backgroundColor: '#ffffff',
        flexShrink: 0
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '12px 16px', width: '100%' }}>
          {!showPreInputForm && (
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={showPreInputFormHandler}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#2563eb',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#eff6ff'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                title="Show input form"
              >
                <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Add Form</span>
              </button>
            </div>
          )}
          
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
            <div style={{ flex: '1 1 auto', position: 'relative' }}>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message Jenkins Agent..."
                rows={1}
                style={{
                  width: '100%',
                  resize: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '12px 48px 12px 16px',
                  fontSize: '14px',
                  outline: 'none',
                  minHeight: '52px',
                  maxHeight: '200px',
                  fontFamily: 'inherit'
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
                }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                style={{
                  position: 'absolute',
                  right: '8px',
                  bottom: '8px',
                  padding: '8px',
                  background: 'linear-gradient(to right, #3b82f6, #f97316)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!inputValue.trim() || isLoading) ? 'not-allowed' : 'pointer',
                  opacity: (!inputValue.trim() || isLoading) ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
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
    </div>
  )

  // Render using portal to ensure it's above everything
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(chatInterface, document.body)
  }
  return chatInterface
}

export default JenkinsChatInterface

