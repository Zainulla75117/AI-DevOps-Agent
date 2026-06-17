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
          className="text-center mb-16"
        >
          <div className="text-[11px] font-mono font-medium uppercase tracking-[0.15em] text-agentic-primary/70 mb-4">Operational Flow</div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-5 font-display text-agentic-text">
            How <span className="text-agentic-primary">InfraX</span> Works
          </h2>
          <p className="text-base md:text-lg text-agentic-text/60 leading-relaxed max-w-2xl mx-auto font-sans">
            Get started in minutes, automate in seconds
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          {/* Desktop Timeline */}
          <div className="hidden md:block relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-agentic-text/10" />

            {steps.map((step, index) => {
              const Icon = step.icon;
              const isEven = index % 2 === 0;

              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  className={`flex items-center mb-16 ${isEven ? 'flex-row' : 'flex-row-reverse'}`}
                >
                  <div className={`w-5/12 ${isEven ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                    <div className="glass-effect p-6 flex flex-col items-start text-left">
                      <div className="flex items-center space-x-3 mb-4 w-full">
                        <div className="w-12 h-12 rounded-lg bg-agentic-surface border border-agentic-text/10 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-agentic-primary" />
                        </div>
                        <span className="text-4xl font-semibold tracking-tighter opacity-50 text-agentic-primary font-mono">{step.number}</span>
                      </div>
                      <h3 className="text-lg md:text-xl font-semibold tracking-tight mb-2 text-agentic-text font-display">{step.title}</h3>
                      <p className="text-sm leading-relaxed text-agentic-text/60 font-sans">{step.description}</p>
                    </div>
                  </div>

                  <div className="w-2/12 flex justify-center">
                    <motion.div
                      whileHover={{ scale: 1.2 }}
                      className="w-4 h-4 rounded-full bg-agentic-primary border-2 border-agentic-secondary z-10"
                    />
                  </div>
                  <div className="w-5/12" />
                </motion.div>
              );
            })}
          </div>

          {/* Mobile Timeline */}
          <div className="md:hidden space-y-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="relative pl-12"
                >
                  {index < steps.length - 1 && (
                    <div className="absolute left-6 top-12 w-0.5 h-full bg-agentic-text/10" />
                  )}

                  <div className="absolute left-2 top-0 w-8 h-8 rounded-full bg-agentic-surface border border-agentic-text/10 flex items-center justify-center z-10 mt-4">
                    <Icon className="w-4 h-4 text-agentic-primary" />
                  </div>

                  <div className="glass-effect p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <span className="text-3xl font-semibold tracking-tighter opacity-50 text-agentic-primary font-mono">{step.number}</span>
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight mb-2 text-agentic-text font-display">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-agentic-text/60 font-sans">{step.description}</p>
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

