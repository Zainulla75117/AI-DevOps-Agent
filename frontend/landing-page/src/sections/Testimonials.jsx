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
    content: "The Kubernetes automation is incredible. We've reduced deployment time by 80% and eliminated manual errors. This is the future of DevOps.",
  },
  {
    name: 'Emily Watson',
    role: 'CTO',
    company: 'StartupXYZ',
    avatar: 'EW',
    content: "As a small team, InfraX gives us enterprise-grade infrastructure automation without the complexity. It's like having a senior DevOps engineer on autopilot.",
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
    <section className="py-24 relative overflow-hidden bg-agentic-secondary">
      {/* Background grid accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-br from-agentic-primary/5 to-blue-500/5 rounded-full blur-[140px] pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="text-[11px] font-mono font-medium uppercase tracking-[0.15em] text-agentic-primary/70 mb-4">Customer Success</div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-5 font-display text-agentic-text">
            Loved by <span className="text-agentic-primary dark:text-shimmer-anim font-semibold">DevOps Teams</span>
          </h2>
          <p className="text-base md:text-lg text-agentic-text/60 leading-relaxed max-w-2xl mx-auto font-sans">
            See what teams are saying about their automation experience
          </p>
        </motion.div>

        {/* Editorial Divided Grid */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 border-t border-b border-agentic-text/10">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`p-10 md:p-12 flex flex-col justify-between group relative transition-all duration-300 ${
                index === 0 ? 'border-b md:border-r border-agentic-text/10' :
                index === 1 ? 'border-b border-agentic-text/10' :
                index === 2 ? 'border-b md:border-b-0 md:border-r border-agentic-text/10' :
                'scale-100'
              }`}
            >
              {/* Quote Mark Icon */}
              <div className="relative mb-6">
                <Quote className="w-8 h-8 text-agentic-primary/30 group-hover:text-agentic-primary transition-colors duration-300" />
              </div>

              {/* Quote Body */}
              <p className="text-lg md:text-xl font-light italic leading-relaxed tracking-tight font-sans text-agentic-text/80 mb-8 group-hover:text-agentic-text transition-colors duration-300 flex-grow">
                "{testimonial.content}"
              </p>

              {/* Client Info */}
              <div className="flex items-center space-x-4">
                {/* Custom Avatar ring */}
                <div className="w-11 h-11 rounded-full border border-agentic-text/10 flex items-center justify-center text-xs font-semibold tracking-wider font-mono text-agentic-primary bg-agentic-primary/5 group-hover:border-agentic-primary/45 transition-all duration-300 flex-shrink-0">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="text-xs font-bold tracking-wider font-mono text-agentic-text group-hover:text-agentic-primary transition-colors duration-300">
                    {testimonial.name}
                  </div>
                  <div className="text-[10px] font-semibold tracking-widest uppercase text-agentic-text/45 font-sans mt-0.5">
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
