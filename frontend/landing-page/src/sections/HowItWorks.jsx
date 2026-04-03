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
    description: 'Simply describe what you need in natural language. InfraAgent understands your requirements and generates the automation.',
    number: '02',
  },
  {
    icon: Zap,
    title: 'InfraAgent Generates & Executes',
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
    <section id="solutions" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-heading">
            How <span className="text-gradient">InfraAgent</span> Works
          </h2>
          <p className="text-xl text-secondary max-w-2xl mx-auto text-sharp">
            Get started in minutes, automate in seconds
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          {/* Desktop Timeline */}
          <div className="hidden md:block relative">
            {/* Timeline Line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-neon-green via-neon-green-light to-neon-blue opacity-30" />

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
                  {/* Content Card */}
                  <div className={`w-5/12 ${isEven ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                    <div className="glass-effect-hover rounded-xl p-6 transition-all duration-300 card-glow">
                      <div className={`flex items-center space-x-3 mb-4 ${isEven ? 'justify-end' : 'justify-start'}`}>
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center shadow-lg shadow-neon-green/30">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-gradient-green text-heading">{step.number}</span>
                      </div>
                      <h3 className="text-2xl font-bold mb-3 text-heading-color text-heading">{step.title}</h3>
                      <p className="text-secondary leading-relaxed text-sharp">{step.description}</p>
                    </div>
                  </div>

                  {/* Timeline Dot */}
                  <div className="w-2/12 flex justify-center">
                    <motion.div
                      whileHover={{ scale: 1.5 }}
                      className="w-6 h-6 rounded-full bg-gradient-to-br from-neon-green to-neon-blue border-4 border-theme-base z-10 shadow-lg shadow-neon-green/50"
                    />
                  </div>

                  {/* Empty Space */}
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
                  {/* Timeline Line */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-6 top-12 w-0.5 h-full bg-gradient-to-b from-neon-green to-neon-blue opacity-30" />
                  )}

                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-0 w-12 h-12 rounded-full bg-gradient-to-br from-neon-green to-neon-blue flex items-center justify-center border-4 border-theme-base z-10">
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Content Card */}
                  <div className="glass-effect-hover rounded-xl p-6 transition-all duration-300 card-glow">
                    <div className="flex items-center space-x-3 mb-4">
                      <span className="text-xl font-bold text-gradient-green text-heading">{step.number}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-heading-color text-heading">{step.title}</h3>
                    <p className="text-secondary leading-relaxed text-sharp">{step.description}</p>
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

