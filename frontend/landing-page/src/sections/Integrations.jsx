import { motion } from 'framer-motion';
import { useState } from 'react';

const integrations = [
  { name: 'AWS', icon: '/tool_icons/icons8-aws-logo-480.png', description: 'Cloud infrastructure provisioning & management', category: 'cloud' },
  { name: 'Azure', icon: '/tool_icons/icons8-azure-48.png', description: 'Enterprise cloud services deployment', category: 'cloud' },
  { name: 'GCP', icon: '/tool_icons/icons8-google-cloud-48.png', description: 'Google Cloud Platform environments', category: 'cloud' },
  { name: 'Kubernetes', icon: '/tool_icons/icons8-kubernetes-480.png', description: 'Container orchestration automation', category: 'iac' },
  { name: 'Docker', icon: '/tool_icons/icons8-docker-96.png', description: 'Container image building & registry', category: 'iac' },
  { name: 'Jenkins', icon: '/tool_icons/icons8-jenkins-480.png', description: 'CI/CD pipeline configuration', category: 'cicd' },
  { name: 'GitHub', icon: '/tool_icons/icons8-github-96.png', description: 'Version control & Actions automation', category: 'cicd' },
  { name: 'GitLab', icon: '/tool_icons/icons8-gitlab-96.png', description: 'Source management & CI workflows', category: 'cicd' },
  { name: 'ArgoCD', icon: '/tool_icons/Argo_cd.png', description: 'Declarative GitOps deployment', category: 'cicd' },
  { name: 'Terraform', icon: '/tool_icons/icons8-terraform-96.png', description: 'Infrastructure as Code generation', category: 'iac' },
  { name: 'Prometheus', icon: '/tool_icons/icons8-prometheus-96.png', description: 'Metrics & observability setup', category: 'monitoring' },
  { name: 'Grafana', icon: '/tool_icons/icons8-grafana-96.png', description: 'Monitoring dashboards creation', category: 'monitoring' },
];

const categories = [
  { id: 'all', name: 'All Tools' },
  { id: 'cloud', name: 'Clouds' },
  { id: 'cicd', name: 'CI/CD & Git' },
  { id: 'iac', name: 'IaC & Kubernetes' },
  { id: 'monitoring', name: 'Observability' }
];

const Integrations = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredIntegrations = activeCategory === 'all'
    ? integrations
    : integrations.filter(item => item.category === activeCategory);

  // Divide into two rows for the marquee
  const halfLength = Math.ceil(integrations.length / 2);
  const marqueeRow1 = integrations.slice(0, halfLength);
  const marqueeRow2 = integrations.slice(halfLength);

  return (
    <section id="integrations" className="py-24 relative overflow-hidden bg-agentic-secondary">
      {/* Self-contained marquee style */}
      <style>{`
        @keyframes marquee-left {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .animate-marquee-left {
          animation: marquee-left 35s linear infinite;
        }
        .animate-marquee-right {
          animation: marquee-right 35s linear infinite;
        }
      `}</style>

      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-dashed-grid mask-radial-fade"></div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="text-[11px] font-mono font-medium uppercase tracking-[0.15em] text-agentic-primary/70 mb-4">Ecosystem</div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-5 font-display text-agentic-text">
            Seamless <span className="text-agentic-primary dark:text-shimmer-anim font-semibold">Integrations</span>
          </h2>
          <p className="text-base md:text-lg text-agentic-text/60 leading-relaxed max-w-2xl mx-auto font-sans">
            Works with all your favorite DevOps tools and cloud providers
          </p>
        </motion.div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-16 max-w-3xl mx-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold font-sans tracking-wide transition-all duration-200 border ${
                activeCategory === cat.id
                  ? 'bg-agentic-primary text-white border-agentic-primary shadow-sm'
                  : 'bg-agentic-surface text-agentic-text/60 border-agentic-text/10 hover:text-agentic-text hover:border-agentic-text/20'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Dynamic Display Area */}
        <div className="max-w-6xl mx-auto min-h-[300px]">
          {activeCategory === 'all' ? (
            <div className="flex flex-col space-y-8 relative overflow-hidden py-4">
              {/* Fade gradients on side of marquee */}
              <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-agentic-secondary to-transparent z-20 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-agentic-secondary to-transparent z-20 pointer-events-none" />

              {/* Row 1 - Left Marquee */}
              <div className="flex overflow-hidden w-full">
                <div className="flex animate-marquee-left hover:[animation-play-state:paused] whitespace-nowrap min-w-[200%]">
                  {/* Copy 1 */}
                  <div className="flex justify-around items-center w-full">
                    {marqueeRow1.map((item) => (
                      <IntegrationCard key={`${item.name}-m1`} item={item} />
                    ))}
                  </div>
                  {/* Copy 2 */}
                  <div className="flex justify-around items-center w-full">
                    {marqueeRow1.map((item) => (
                      <IntegrationCard key={`${item.name}-m2`} item={item} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2 - Right Marquee */}
              <div className="flex overflow-hidden w-full">
                <div className="flex animate-marquee-right hover:[animation-play-state:paused] whitespace-nowrap min-w-[200%]">
                  {/* Copy 1 */}
                  <div className="flex justify-around items-center w-full">
                    {marqueeRow2.map((item) => (
                      <IntegrationCard key={`${item.name}-m3`} item={item} />
                    ))}
                  </div>
                  {/* Copy 2 */}
                  <div className="flex justify-around items-center w-full">
                    {marqueeRow2.map((item) => (
                      <IntegrationCard key={`${item.name}-m4`} item={item} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Category Filter Grid View
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8"
            >
              {filteredIntegrations.map((item) => (
                <motion.div
                  layout
                  key={item.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center p-6 border border-agentic-text/5 hover:border-agentic-primary/20 rounded-xl cursor-pointer group relative transition-all duration-300"
                >
                  <div className="w-16 h-16 flex items-center justify-center relative mb-3">
                    <div className="absolute inset-0 bg-agentic-primary/10 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <img
                      src={item.icon}
                      alt={item.name}
                      className="w-10 h-10 object-contain grayscale group-hover:grayscale-0 opacity-70 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-110"
                    />
                  </div>
                  <span className="text-sm font-semibold tracking-wide font-sans text-agentic-text/80 group-hover:text-agentic-text transition-colors">
                    {item.name}
                  </span>

                  {/* Tooltip */}
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -top-2 translate-y-[-100%] w-48 bg-[#090d16] text-white text-[11px] rounded-lg p-3 text-center shadow-xl border border-white/5 z-30 left-1/2 -translate-x-1/2">
                    <p className="font-sans leading-relaxed">{item.description}</p>
                    <div className="absolute top-full left-1/2 -translate-x-[50%] border-[5px] border-transparent border-t-[#090d16]"></div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mt-16"
          >
            <p className="text-agentic-text/50 mb-6 font-sans text-xs tracking-wider uppercase font-medium">
              Enterprise integrations built-in out of the box
            </p>
            <motion.a
              href="https://github.com/Zainulla75117/AI-DevOps-Agent"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-block px-7 py-3 bg-agentic-surface border border-agentic-text/10 text-agentic-text rounded-full font-semibold tracking-wide shadow-sm hover:border-agentic-text/25 transition-all font-sans text-sm"
            >
              View API Documentation
            </motion.a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// Reusable Inner Marquee Card component
const IntegrationCard = ({ item }) => {
  return (
    <div className="w-36 md:w-44 flex flex-col items-center justify-center py-6 px-4 group cursor-pointer relative transition-all duration-300">
      <div className="w-16 h-16 flex items-center justify-center relative mb-2">
        <div className="absolute inset-0 bg-agentic-primary/10 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <img
          src={item.icon}
          alt={item.name}
          className="w-10 h-10 object-contain grayscale group-hover:grayscale-0 opacity-70 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-110"
        />
      </div>
      <span className="text-xs font-semibold tracking-wider font-sans text-agentic-text/50 group-hover:text-agentic-text transition-colors">
        {item.name}
      </span>

      {/* Tooltip */}
      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-350 pointer-events-none -top-2 translate-y-[-100%] w-48 bg-[#090d16] text-white text-[11px] rounded-lg p-3 text-center shadow-xl border border-white/5 z-30 left-1/2 -translate-x-1/2">
        <p className="font-sans leading-relaxed whitespace-normal">{item.description}</p>
        <div className="absolute top-full left-1/2 -translate-x-[50%] border-[5px] border-transparent border-t-[#090d16]"></div>
      </div>
    </div>
  );
};

export default Integrations;
