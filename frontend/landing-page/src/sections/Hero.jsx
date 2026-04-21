import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-agentic-secondary">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-dashed-grid mask-vertical-fade opacity-60"></div>

      <div className="container mx-auto px-6 relative z-10">
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
              <span className="text-sm font-medium text-agentic-text">AI-First Infrastructure Engine</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-display leading-tight text-agentic-text">
              Delegate Your <span className="text-agentic-primary">DevOps</span> Workflows
            </h1>

            <p className="text-xl text-agentic-text/80 leading-relaxed max-w-2xl font-sans mx-auto">
              <span className="font-semibold italic">InfraX</span> builds cloud infrastructure, configures pipelines, and acts as your autonomous SRE. Tell it what you need, and consider it done.
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

