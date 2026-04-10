import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'DevOps Lead',
    company: 'TechCorp',
    avatar: 'SC',
    content: 'InfraX has transformed how we manage infrastructure. What used to take days now happens in minutes. The AI truly understands our needs.',
  },
  {
    name: 'Michael Rodriguez',
    role: 'Platform Engineer',
    company: 'CloudScale',
    avatar: 'MR',
    content: 'The Kubernetes automation is incredible. We\'ve reduced deployment time by 80% and eliminated manual errors. This is the future of DevOps.',
  },
  {
    name: 'Emily Watson',
    role: 'CTO',
    company: 'StartupXYZ',
    avatar: 'EW',
    content: 'As a small team, InfraX gives us enterprise-grade infrastructure automation without the complexity. It\'s like having a senior DevOps engineer on autopilot.',
  },
  {
    name: 'David Kim',
    role: 'Infrastructure Architect',
    company: 'GlobalTech',
    avatar: 'DK',
    content: 'The cost optimization features alone have saved us thousands. InfraX continuously monitors and optimizes our cloud spend automatically.',
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 relative overflow-hidden bg-agentic-surface">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 font-display text-agentic-text">
            Loved by <span className="text-agentic-primary">DevOps Teams</span>
          </h2>
          <p className="text-xl text-agentic-text/70 max-w-2xl mx-auto font-sans">
            See what teams are saying about InfraX
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-effect rounded-xl p-8 transition-all duration-300 relative border border-agentic-text/10 hover:border-agentic-text/20"
            >
              <Quote className="w-8 h-8 text-agentic-primary/40 mb-4" />
              <p className="text-agentic-text/80 leading-relaxed mb-6 text-lg font-sans">
                "{testimonial.content}"
              </p>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-agentic-primary flex items-center justify-center text-white font-bold shadow-sm">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-agentic-text text-lg font-sans">{testimonial.name}</div>
                  <div className="text-sm text-agentic-text/60 font-sans">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
