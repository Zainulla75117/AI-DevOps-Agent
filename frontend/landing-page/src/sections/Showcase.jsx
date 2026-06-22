import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Terminal, Code2, CheckCircle } from 'lucide-react';

const codeSnippets = [
  {
    type: 'terraform',
    title: 'Terraform Config',
    code: `resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.medium"
  
  tags = {
    Name = "InfraX-Managed"
    Environment = "production"
  }
}`,
  },
  {
    type: 'yaml',
    title: 'Kubernetes Pods',
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 8080`,
  },
  {
    type: 'yaml',
    title: 'CI/CD Pipeline',
    code: `name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy
        run: |
          terraform init
          terraform apply -auto-approve`,
  },
];

const showcaseFeatures = [
  {
    id: 0,
    icon: Code2,
    title: 'Auto-Generated Code',
    description: 'InfraX generates production-ready infrastructure code following industry standards and security compliance patterns.',
  },
  {
    id: 1,
    icon: CheckCircle,
    title: 'Validated & Tested',
    description: 'All generated configurations are validated against real cloud provider schemes to guarantee deployments work correctly.',
  },
  {
    id: 2,
    icon: Terminal,
    title: 'One-Click Deploy',
    description: 'Review, approve, and execute the generated DevOps scripts instantly in your cloud environment with full logging.',
  },
];

const Showcase = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [typingCode, setTypingCode] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const currentSnippet = codeSnippets[activeTab];
    setTypingCode('');
    setIsTyping(true);

    let charIndex = 0;
    const typeInterval = setInterval(() => {
      if (charIndex < currentSnippet.code.length) {
        setTypingCode(currentSnippet.code.slice(0, charIndex + 1));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(typeInterval);
      }
    }, 15); // Faster typing for better UX

    return () => clearInterval(typeInterval);
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % codeSnippets.length);
    }, 8000); // Slower transition to allow reading
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="showcase" className="py-24 relative overflow-hidden bg-agentic-secondary">
      {/* Background radial spotlight */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-agentic-primary/5 rounded-full blur-[140px] pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="text-[11px] font-mono font-medium uppercase tracking-[0.15em] text-agentic-primary/70 mb-4">Live Execution</div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-5 font-display text-agentic-text">
            See <span className="text-agentic-primary dark:text-shimmer-anim font-semibold">InfraX</span> in Action
          </h2>
          <p className="text-base md:text-lg text-agentic-text/60 leading-relaxed max-w-2xl mx-auto font-sans">
            Watch AI generate infrastructure code, pipelines, and configurations in real-time
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Code Preview (Terminal Styling) */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="bg-[#090d16] rounded-2xl p-6 border border-white/10 shadow-2xl relative overflow-hidden">
                {/* Terminal Header */}
                <div className="flex items-center justify-between mb-5 relative z-10 border-b border-white/5 pb-4">
                  <div className="flex items-center space-x-2.5">
                    <Terminal className="w-4 h-4 text-agentic-primary" />
                    <span className="text-[11px] font-mono font-medium tracking-wider text-white/40 uppercase">Terminal</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1.5 mb-4 relative z-10 overflow-x-auto pb-1 scrollbar-none">
                  {codeSnippets.map((snippet, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveTab(index)}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wide font-sans transition-all duration-200 flex-shrink-0 ${
                        activeTab === index
                          ? 'bg-agentic-primary/20 text-agentic-primary border border-agentic-primary/30 shadow-sm'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {snippet.title}
                    </button>
                  ))}
                </div>

                {/* Code Display */}
                <div className="bg-[#05080f] text-blue-200/90 rounded-lg p-5 font-mono text-[12px] md:text-sm overflow-x-auto shadow-inner border border-white/5 min-h-[260px] max-h-[360px] relative z-10">
                  <pre className="leading-relaxed">
                    <code>{typingCode}</code>
                    {isTyping && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="text-agentic-primary ml-1 font-bold"
                      >
                        ▋
                      </motion.span>
                    )}
                  </pre>
                </div>
              </div>
            </motion.div>

            {/* Right - Features List */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              {showcaseFeatures.map((feat) => {
                const Icon = feat.icon;
                const isActive = activeTab === feat.id;
                return (
                  <div
                    key={feat.id}
                    onClick={() => setActiveTab(feat.id)}
                    onMouseEnter={() => setActiveTab(feat.id)}
                    className={`p-6 rounded-xl cursor-pointer transition-all duration-300 relative ${
                      isActive
                        ? 'opacity-100 translate-x-1'
                        : 'opacity-50 hover:opacity-85'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        isActive
                          ? 'bg-agentic-primary/10 text-agentic-primary scale-105'
                          : 'bg-agentic-text/5 text-agentic-text/60'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`text-base md:text-lg font-semibold tracking-tight mb-2 font-display transition-colors duration-300 ${
                          isActive ? 'text-agentic-primary' : 'text-agentic-text'
                        }`}>
                          {feat.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-agentic-text/60 font-sans">
                          {feat.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Showcase;
