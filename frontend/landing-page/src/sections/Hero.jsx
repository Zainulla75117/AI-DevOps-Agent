import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { useState, useEffect } from 'react';

const Hero = () => {
  const [codeLines, setCodeLines] = useState([
    '> infrax deploy --target aws-us-east-1',
    '✓ Analyzing infrastructure requirements...',
    '✓ Provisioning AWS EKS cluster...',
    '✓ Configuring VPC & networking...',
    '✓ Deploying monitoring stack...',
    '✓ Infrastructure ready. Latency check: OK.',
  ]);
  const [currentLine, setCurrentLine] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLine((prev) => {
        if (prev >= codeLines.length - 1) {
          setIsResetting(true);
          setTimeout(() => {
            setCurrentLine(0);
            setIsResetting(false);
          }, 3000);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [codeLines.length]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-agentic-secondary">
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-8"
          >
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-agentic-surface border border-agentic-text/10 rounded-full">
              <span className="w-2 h-2 bg-agentic-primary rounded-full animate-pulse" />
              <span className="text-sm font-medium text-agentic-text">AI-First Infrastructure Engine</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-display leading-tight text-agentic-text">
              Delegate Your <span className="text-agentic-primary">DevOps</span> Workflows
            </h1>

            <p className="text-xl text-agentic-text/80 leading-relaxed max-w-2xl font-sans">
              <span className="font-semibold italic">InfraX</span> builds cloud infrastructure, configures pipelines, and acts as your autonomous SRE. Tell it what you need, and consider it done.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <motion.a
                href="https://infraxai.vercel.app"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group px-8 py-4 bg-agentic-primary text-white rounded-md font-medium flex items-center justify-center space-x-2 hover:bg-[#265A4B] transition-colors shadow-sm"
              >
                <span>Product Site</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>
              <motion.a
                href="#demo"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 bg-agentic-surface border border-agentic-text/10 text-agentic-text rounded-md font-medium flex items-center justify-center space-x-2 hover:border-agentic-text/20 transition-colors shadow-sm"
              >
                <Play className="w-5 h-5" />
                <span>Watch Product Demo</span>
              </motion.a>
            </div>
          </motion.div>

          {/* Right - Terminal/Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative"
          >
            <div className="bg-agentic-surface rounded-xl p-6 border border-agentic-text/10 shadow-lg">
              {/* Terminal Header */}
              <div className="flex items-center space-x-2 mb-4 border-b border-agentic-text/5 pb-4">
                <div className="w-3 h-3 rounded-full bg-agentic-danger" />
                <div className="w-3 h-3 rounded-full bg-agentic-warning" />
                <div className="w-3 h-3 rounded-full bg-agentic-success" />
                <span className="ml-4 text-sm font-medium text-agentic-text/50 font-sans tracking-wide">Terminal</span>
              </div>

              {/* Terminal Content */}
              <div className="bg-agentic-text text-agentic-surface rounded-md p-6 font-mono text-sm space-y-3 min-h-[300px] shadow-inner">
                {!isResetting && codeLines.slice(0, currentLine + 1).map((line, idx) => (
                  <motion.div
                    key={`${line}-${idx}-${currentLine}`}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className={line.startsWith('✓') ? 'text-agentic-success' : 'text-agentic-secondary/80'}
                  >
                    {line}
                  </motion.div>
                ))}
                {!isResetting && currentLine < codeLines.length - 1 && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                    className="text-agentic-primary font-bold inline-block"
                  >
                    ▋
                  </motion.span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator - Mouse */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 hidden md:block"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
          className="relative flex flex-col items-center"
        >
          <div className="relative w-8 h-12 border-2 border-agentic-text/20 rounded-full flex justify-center bg-agentic-surface">
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
              className="mt-2 w-1.5 h-2.5 bg-agentic-primary rounded-full"
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;

