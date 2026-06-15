import { motion } from 'framer-motion';
import { ArrowRight, Play, Github } from 'lucide-react';
import DevOpsScene from '../components/DevOpsScene';

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
    <section className="relative min-h-screen flex items-center overflow-hidden bg-agentic-secondary">
      {/* 3D Scene Background taking up the entire screen */}
      <div className="absolute inset-0 z-0">
        <DevOpsScene />
      </div>

      <div className="container mx-auto px-8 lg:px-16 relative z-10 pt-8 md:pt-10 lg:pt-12 pointer-events-none">
        <div className="max-w-3xl pointer-events-auto">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6 flex flex-col items-start text-left"
          >
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white/80 dark:bg-agentic-surface border border-gray-200 dark:border-agentic-text/10 rounded-full shadow-sm backdrop-blur-sm">
              <span className="w-1.5 h-1.5 bg-agentic-primary rounded-full animate-pulse" />
              <span className="text-[10px] sm:text-xs font-mono font-semibold uppercase tracking-[0.2em] text-gray-800 dark:text-agentic-text drop-shadow-sm dark:drop-shadow-md">AI-First Infrastructure Engine</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight font-display leading-tight text-gray-900 dark:text-white drop-shadow-sm dark:drop-shadow-lg">
              Delegate Your <br className="hidden sm:block" /> <span className="text-agentic-primary dark:text-shimmer-anim font-semibold inline-block pb-1 md:pb-2">DevOps</span> Workflows
            </h1>

            <p className="text-base md:text-lg text-gray-600 dark:text-white/80 leading-relaxed max-w-2xl font-sans drop-shadow-sm dark:drop-shadow-md">
              <span className="font-semibold italic text-gray-900 dark:text-white">InfraX</span> builds cloud infrastructure and configures pipelines autonomously. Think of it as your AI-powered DevOps guy. Just describe what you need, and consider it done.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto pt-2">
              <motion.a
                href="https://infraxai.vercel.app"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group px-6 py-3 bg-agentic-primary text-white rounded-md font-medium text-sm md:text-base flex items-center justify-center space-x-2 hover:bg-[#265A4B] transition-colors shadow-lg"
              >
                <span>Product Site</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </motion.a>
              <motion.a
                href="#demo"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-md font-medium text-sm md:text-base flex items-center justify-center space-x-2 hover:border-gray-300 dark:hover:border-white/20 transition-colors shadow-lg"
              >
                <Play className="w-4 h-4" />
                <span>Watch Product Demo</span>
              </motion.a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Centered Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="absolute inset-x-0 bottom-8 flex flex-col items-center justify-center space-y-4 text-gray-500 dark:text-white/60 text-sm font-medium w-full pointer-events-auto z-10"
      >
        <span className="opacity-80 uppercase tracking-[0.2em] text-xs text-gray-400 dark:text-white/60">Seamless access via</span>
        <div className="flex items-center justify-center space-x-4">
          <GoogleIcon className="w-5 h-5 opacity-90 hover:opacity-100 transition-opacity" />
          <Github className="w-5 h-5 opacity-90 hover:opacity-100 transition-opacity text-gray-900 dark:text-white" />
        </div>
      </motion.div>

    </section>
  );
};

export default Hero;

