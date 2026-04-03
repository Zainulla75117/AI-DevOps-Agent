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
    Name = "InfraAgent-Managed"
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
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-heading">
            See <span className="text-gradient">InfraAgent</span> in Action
          </h2>
          <p className="text-xl text-secondary max-w-2xl mx-auto text-sharp">
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
              <div className="glass-effect rounded-2xl p-6 border border-theme shadow-2xl relative overflow-hidden">
                {/* Terminal Header */}
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-5 h-5 text-neon-green" />
                    <span className="text-sm text-tertiary font-medium text-sharp">InfraAgent AI</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-2 mb-4 relative z-10">
                  {codeSnippets.map((snippet, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveTab(index)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeTab === index
                          ? 'bg-neon-green/30 text-neon-green border border-neon-green/60 shadow-lg shadow-neon-green/20'
                          : 'text-muted hover:text-secondary hover:bg-theme-surface'
                      }`}
                    >
                      {snippet.title}
                    </button>
                  ))}
                </div>

                {/* Code Display */}
                <div className="bg-terminal rounded-lg p-6 font-mono text-sm overflow-x-auto border border-theme relative z-10">
                  <pre className="text-secondary">
                    <code>{typingCode}</code>
                    {isTyping && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="text-neon-green ml-1 font-bold"
                      >
                        ▊
                      </motion.span>
                    )}
                  </pre>
                </div>

                {/* Enhanced Glow Effect */}
                <div className="absolute -inset-2 bg-gradient-to-r from-neon-green/30 via-neon-green-light/20 to-neon-blue/30 rounded-2xl blur-2xl -z-10 animate-pulse-slow" />
                <div className="absolute -inset-1 bg-gradient-to-r from-neon-green/20 to-neon-blue/20 rounded-2xl blur-xl -z-10" />
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
              <div className="glass-effect-hover rounded-xl p-6 border border-theme transition-all duration-300 hover:scale-105">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center flex-shrink-0 shadow-lg shadow-neon-green/30">
                    <Code2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-heading-color text-heading">Auto-Generated Code</h3>
                    <p className="text-secondary text-sharp">
                      InfraAgent generates production-ready infrastructure code following best practices and security standards.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-effect-hover rounded-xl p-6 border border-theme transition-all duration-300 hover:scale-105">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-blue to-neon-blue-light flex items-center justify-center flex-shrink-0 shadow-lg shadow-neon-blue/30">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-heading-color text-heading">Validated & Tested</h3>
                    <p className="text-secondary text-sharp">
                      All generated configurations are validated against cloud provider requirements and tested before deployment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-effect-hover rounded-xl p-6 border border-theme transition-all duration-300 hover:scale-105">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-green-light to-neon-green flex items-center justify-center flex-shrink-0 shadow-lg shadow-neon-green/30">
                    <Terminal className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-heading-color text-heading">One-Click Deploy</h3>
                    <p className="text-secondary text-sharp">
                      Review, approve, and deploy with a single click. InfraAgent handles the entire deployment process.
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

