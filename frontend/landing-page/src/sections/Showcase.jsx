import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Terminal, Code2, CheckCircle } from 'lucide-react';

const codeSnippets = [
  {
    type: 'terraform',
    title: 'Terraform Configuration',
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
    title: 'Kubernetes Deployment',
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
    }, 30);

    return () => clearInterval(typeInterval);
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % codeSnippets.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="showcase" className="py-24 relative overflow-hidden bg-agentic-secondary">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-5 font-display text-agentic-text">
            See <span className="text-agentic-primary">InfraX</span> in Action
          </h2>
          <p className="text-base md:text-lg text-agentic-text/60 leading-relaxed max-w-2xl mx-auto font-sans">
            Watch AI generate infrastructure code, pipelines, and configurations in real-time
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left - Code Preview */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="bg-agentic-surface rounded-2xl p-6 border border-agentic-text/10 shadow-lg relative overflow-hidden">
                {/* Terminal Header */}
                <div className="flex items-center justify-between mb-4 relative z-10 border-b border-agentic-text/5 pb-4">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-5 h-5 text-agentic-primary" />
                    <span className="text-xs font-mono font-semibold tracking-wide text-agentic-text/50">InfraX AI</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-agentic-danger" />
                    <div className="w-3 h-3 rounded-full bg-agentic-warning" />
                    <div className="w-3 h-3 rounded-full bg-agentic-success" />
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-2 mb-4 relative z-10">
                  {codeSnippets.map((snippet, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveTab(index)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold tracking-wide font-sans transition-all duration-200 ${activeTab === index
                          ? 'bg-agentic-primary/10 text-agentic-primary border border-agentic-primary/20 shadow-sm'
                          : 'text-agentic-text/50 hover:text-agentic-text hover:bg-agentic-text/5 border border-transparent'
                        }`}
                    >
                      {snippet.title}
                    </button>
                  ))}
                </div>

                {/* Code Display */}
                <div className="bg-agentic-text text-agentic-surface rounded-lg p-6 font-mono text-sm overflow-x-auto shadow-inner relative z-10">
                  <pre className="text-agentic-surface/80">
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
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="p-6 transition-all duration-300">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-lg bg-agentic-surface border border-agentic-text/10 flex items-center justify-center flex-shrink-0">
                    <Code2 className="w-6 h-6 text-agentic-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight mb-2 text-agentic-text font-display">Auto-Generated Code</h3>
                    <p className="text-sm leading-relaxed text-agentic-text/60 font-sans">
                      <span className="font-semibold italic">InfraX</span> generates production-ready infrastructure code following best practices and security standards.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 transition-all duration-300">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-lg bg-agentic-surface border border-agentic-text/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-agentic-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight mb-2 text-agentic-text font-display">Validated & Tested</h3>
                    <p className="text-sm leading-relaxed text-agentic-text/60 font-sans">
                      All generated configurations are validated against cloud provider requirements and tested before deployment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 transition-all duration-300">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-lg bg-agentic-surface border border-agentic-text/10 flex items-center justify-center flex-shrink-0">
                    <Terminal className="w-6 h-6 text-agentic-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight mb-2 text-agentic-text font-display">One-Click Deploy</h3>
                    <p className="text-sm leading-relaxed text-agentic-text/60 font-sans">
                      Review, approve, and deploy with a single click. <span className="font-semibold italic">InfraX</span> handles the entire deployment process.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Showcase;
