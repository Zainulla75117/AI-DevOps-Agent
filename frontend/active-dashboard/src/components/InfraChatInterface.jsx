import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const InfraChatInterface = ({ project, onCancel, onInfrastructureCreated }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: `Hello! I'm your Infrastructure Copilot. I can help you provision AWS resources for **${project.project_name}**. What kind of application or infrastructure are you looking to build today?`,
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: inputValue.trim(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)

    // Simulate AI response logic
    setTimeout(() => {
      let aiResponseText = ''

      if (messages.length === 1) {
        aiResponseText = "That sounds like a great plan. To support that, I recommend a High-Availability Network (VPC with 2 Public and 2 Private Subnets), an Application Load Balancer, and an ECS Fargate cluster for compute. Does this architecture sound good to you?"
      } else if (messages.length >= 3) {
        aiResponseText = "Excellent. I've automatically configured the CloudFormation templates and executed the terraform plan. Your infrastructure is now provisioning!"
        
        // Let's actually simulate the successful creation and redirect!
        setTimeout(() => {
          onInfrastructureCreated(
            {
              vpcName: `${project.project_name}-ai-vpc`,
              vpcCidr: '10.0.0.0/16',
              provider: 'aws',
              method: 'copilot-assisted'
            },
            'AI successfully provisioned your infrastructure!'
          )
        }, 3000)
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'ai', text: aiResponseText },
      ])
      setIsTyping(false)
    }, 1500)
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/50 shadow-2xl flex flex-col h-[800px] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-white/50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2a1 1 0 011 1v1a1 1 0 01-2 0V3a1 1 0 011-1zM4 9h16a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6a2 2 0 012-2zm4 4a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2zm-6 5v2m4-2v2" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Copilot Assisted</h2>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">
              AI Infrastructure Provisioning <span className="mx-1.5 opacity-50">•</span> <span className="text-indigo-600 font-bold">{project.project_name}</span>
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
              className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
              }`}
            >
              <ReactMarkdown 
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-bold">{children}</strong>
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
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSendMessage} className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your infrastructure requirements..."
            className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 transition-all text-slate-800"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors"
          >
            <svg className="w-4 h-4 translate-x-px translate-y-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
        <p className="text-center text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-3">
          AI may hallucinate infrastructure endpoints. Verify before production.
        </p>
      </div>
    </div>
  )
}

export default InfraChatInterface
