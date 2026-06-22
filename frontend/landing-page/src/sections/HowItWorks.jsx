import { motion } from 'framer-motion';
import { Link, Code, Zap, Eye } from 'lucide-react';

const steps = [
  {
    icon: Link,
    title: 'Connect Your Cloud & Repos',
    description: 'Securely connect your cloud accounts (AWS, Azure, GCP) and repository providers. One-time setup with OAuth integration.',
    number: '01',
  },
  {
    icon: Code,
    title: 'Describe the Task',
    description: 'Simply describe what you need in natural language. InfraX understands your requirements and generates the automation.',
    number: '02',
  },
  {
    icon: Zap,
    title: 'InfraX Generates & Executes',
    description: 'AI generates infrastructure code, CI/CD pipelines, and configurations. Review and approve, then watch it deploy automatically.',
    number: '03',
  },
  {
    icon: Eye,
    title: 'Monitor Everything in Real-Time',
    description: 'Track deployments, monitor performance, and receive alerts. All metrics and logs in one unified dashboard.',
    number: '04',
  },
];

const HowItWorks = () => {
  return (
    <section id="solutions" className="py-24 relative overflow-hidden bg-agentic-secondary">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-dashed-grid mask-radial-fade"></div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="text-[11px] font-mono font-medium uppercase tracking-[0.15em] text-agentic-primary/70 mb-4">Operational Flow</div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-5 font-display text-agentic-text">
            How <span className="text-agentic-primary dark:text-shimmer-anim font-semibold">InfraX</span> Works
          </h2>
          <p className="text-base md:text-lg text-agentic-text/60 leading-relaxed max-w-2xl mx-auto font-sans">
            Get started in minutes, automate in seconds
          </p>
        </motion.div>

        {/* Horizontal Timeline Container */}
        <div className="max-w-6xl mx-auto relative mt-12">
          {/* Horizontal connecting line on desktop with flowing light beam */}
          <div className="absolute top-[28px] left-[6%] right-[6%] h-[1px] bg-agentic-text/10 dark:bg-white/10 hidden md:block z-0 overflow-hidden">
            <motion.div
              initial={{ left: '-30%' }}
              animate={{ left: '100%' }}
              transition={{
                repeat: Infinity,
                duration: 4,
                ease: 'linear',
              }}
              className="absolute top-0 bottom-0 w-[30%] bg-gradient-to-r from-transparent via-agentic-primary to-transparent"
            />
          </div>

          {/* Desktop Timeline */}
          <div className="hidden md:grid md:grid-cols-4 gap-8 relative z-10">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  className="flex flex-col items-start group relative"
                >
                  {/* Icon Circle Sitting on Timeline Line */}
                  <div className="w-14 h-14 rounded-full bg-agentic-secondary border border-agentic-text/10 flex items-center justify-center mb-6 relative group-hover:border-agentic-primary transition-all duration-300">
                    <div className="absolute inset-0 bg-agentic-primary/5 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Icon className="w-6 h-6 text-agentic-primary relative z-10 group-hover:scale-110 transition-transform duration-300" />
                  </div>

                  {/* Huge Background Step Number */}
                  <div className="absolute top-10 right-0 text-[6.5rem] font-light leading-none tracking-tighter text-agentic-text/[0.1] group-hover:text-agentic-primary/[0.22] transition-colors duration-500 font-mono select-none pointer-events-none">
                    {step.number}
                  </div>

                  <h3 className="text-lg md:text-xl font-semibold tracking-tight mb-3 text-agentic-text font-display group-hover:text-agentic-primary transition-colors duration-300">
                    {step.title}
                  </h3>
                  
                  <p className="text-sm leading-relaxed text-agentic-text/60 font-sans pr-4">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Mobile Timeline */}
          <div className="md:hidden space-y-12 relative pl-6">
            {/* Vertical Line with flowing light beam */}
            <div className="absolute left-10 top-2 bottom-2 w-[1px] bg-agentic-text/10 dark:bg-white/10 overflow-hidden">
              <motion.div
                initial={{ top: '-30%' }}
                animate={{ top: '100%' }}
                transition={{
                  repeat: Infinity,
                  duration: 4,
                  ease: 'linear',
                }}
                className="absolute left-0 right-0 h-[30%] bg-gradient-to-b from-transparent via-agentic-primary to-transparent"
              />
            </div>

            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex items-start space-x-6 relative group"
                >
                  {/* Circular Icon */}
                  <div className="w-10 h-10 rounded-full bg-agentic-secondary border border-agentic-text/10 flex items-center justify-center relative z-10 flex-shrink-0">
                    <Icon className="w-5 h-5 text-agentic-primary" />
                  </div>

                  {/* Step details */}
                  <div className="flex-1 pt-1">
                    <div className="flex items-baseline justify-between mb-1">
                      <h3 className="text-lg font-semibold tracking-tight text-agentic-text font-display">
                        {step.title}
                      </h3>
                      <span className="text-2xl font-semibold opacity-25 text-agentic-text font-mono ml-4">{step.number}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-agentic-text/60 font-sans">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

