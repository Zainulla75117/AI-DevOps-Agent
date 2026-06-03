import { motion } from 'framer-motion';
import { ArrowRight, Play, Github } from 'lucide-react';

const GoogleIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-20 bg-agentic-secondary">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-dashed-grid mask-vertical-fade opacity-60"></div>

      <div className="container mx-auto px-6 relative z-10 pt-12 md:pt-12">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-8 flex flex-col items-center"
          >
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-agentic-surface border border-agentic-text/10 rounded-full">
              <span className="w-2 h-2 bg-agentic-primary rounded-full animate-pulse" />
              <span className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-agentic-text">AI-First Infrastructure Engine</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight font-display leading-tight text-agentic-text">
              Delegate Your <span className="text-shimmer-anim font-semibold inline-block pb-2">DevOps</span> Workflows
            </h1>

            <p className="text-lg md:text-xl text-agentic-text/70 leading-relaxed max-w-2xl font-sans mx-auto">
              <span className="font-semibold italic">InfraX</span> builds cloud infrastructure and configures pipelines autonomously. Think of it as your AI-powered DevOps guy. Just describe what you need, and consider it done.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
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

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="mt-12 flex flex-col items-center justify-center space-y-4 text-agentic-text/60 text-sm font-medium"
            >
              <span className="opacity-60 uppercase tracking-[0.2em] text-xs">Seamless access via</span>
              <div className="flex items-center space-x-4">
                <GoogleIcon className="w-5 h-5 opacity-80 hover:opacity-100 transition-opacity" />
                <Github className="w-5 h-5 opacity-80 hover:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

    </section>
  );
};

export default Hero;

