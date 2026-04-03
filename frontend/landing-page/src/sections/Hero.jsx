import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { useState, useEffect } from 'react';

const Hero = () => {
  const [codeLines, setCodeLines] = useState([
    'terraform apply',
    '✓ Provisioning infrastructure...',
    '✓ Configuring Kubernetes cluster...',
    '✓ Setting up CI/CD pipelines...',
    '✓ Deploying monitoring stack...',
    '✓ Infrastructure ready!',
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
          }, 500);
          return prev;
        }
        return prev + 1;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [codeLines.length]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 grid-background" />
      
      {/* Gradient Orbs with better positioning */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-neon-green/25 rounded-full blur-3xl animate-float opacity-60" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-neon-blue/25 rounded-full blur-3xl animate-float opacity-60" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-neon-green/10 rounded-full blur-3xl animate-pulse-slow" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-full glass-effect border border-neon-green/40 shadow-lg shadow-neon-green/20"
            >
              <span className="w-2 h-2 bg-neon-green rounded-full animate-pulse shadow-lg shadow-neon-green/50" />
              <span className="text-sm font-medium text-neon-green">AI-Powered DevOps Automation</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-heading"
            >
              Automate Your Entire{' '}
              <span className="text-gradient-hero">DevOps Infra</span>{' '}
              with AI
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className="text-xl text-secondary leading-relaxed max-w-2xl text-sharp"
            >
              InfraAgent provisions cloud infra, automates CI/CD, manages Kubernetes, and monitors systems — all autonomously.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <motion.a
                href="#get-started"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group px-8 py-4 bg-gradient-to-r from-neon-green via-neon-green-light to-neon-blue text-white rounded-lg font-semibold flex items-center justify-center space-x-2 hover:shadow-2xl hover:shadow-neon-green/50 transition-all duration-300 hover:scale-105"
              >
                <span>Start Free</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>
              <motion.a
                href="#demo"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 glass-effect border border-theme text-heading-color rounded-lg font-semibold flex items-center justify-center space-x-2 hover:border-neon-blue/60 hover:bg-theme-surface transition-all duration-300"
              >
                <Play className="w-5 h-5" />
                <span>Book Demo</span>
              </motion.a>
            </motion.div>
          </motion.div>

          {/* Right - Terminal/Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative"
          >
            <div className="glass-effect rounded-2xl p-6 border border-theme shadow-2xl relative overflow-hidden">
              {/* Terminal Header */}
              <div className="flex items-center space-x-2 mb-4 relative z-10">
                <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                <span className="ml-4 text-sm text-tertiary font-medium">InfraAgent Terminal</span>
              </div>

              {/* Terminal Content */}
              <div className="bg-terminal rounded-lg p-6 font-mono text-sm space-y-2 min-h-[300px] relative z-10 border border-theme">
                <div className="text-neon-green font-semibold">$ infraagent deploy</div>
                {!isResetting && codeLines.slice(0, currentLine + 1).map((line, idx) => (
                  <motion.div
                    key={`${line}-${idx}-${currentLine}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                    className={line.startsWith('✓') ? 'text-green-400 font-medium' : 'text-tertiary'}
                  >
                    {line}
                  </motion.div>
                ))}
                {!isResetting && currentLine < codeLines.length - 1 && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                    className="text-neon-green font-bold inline-block"
                  >
                    ▊
                  </motion.span>
                )}
              </div>

              {/* Enhanced Glow Effect */}
              <div className="absolute -inset-2 bg-gradient-to-r from-neon-green/30 via-neon-green-light/20 to-neon-blue/30 rounded-2xl blur-2xl -z-10 animate-pulse-slow" />
              <div className="absolute -inset-1 bg-gradient-to-r from-neon-green/20 to-neon-blue/20 rounded-2xl blur-xl -z-10" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator - Mouse */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
          className="relative flex flex-col items-center"
        >
          {/* Mouse Body - Proper mouse shape with rounded top and flat bottom */}
              <div className="relative w-10 h-16 border-2 border-theme-strong rounded-t-[20px] rounded-b-[4px] overflow-hidden bg-theme-card backdrop-blur-sm">
            {/* Scroll Wheel - Animated */}
            <motion.div
              animate={{ y: [0, 14, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
              className="absolute top-3.5 left-1/2 transform -translate-x-1/2 w-1.5 h-2.5 bg-neon-green rounded-full shadow-lg shadow-neon-green/70"
            />
          </div>
          {/* Mouse Base - Connects to body */}
          <div className="w-14 h-2 border-2 border-theme-strong border-t-0 rounded-b-full mt-[-2px] bg-theme-card"></div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;

