import { motion } from 'framer-motion';

const integrations = [
  { name: 'AWS', icon: '/tool_icons/icons8-aws-logo-480.png', description: 'Cloud infrastructure provisioning & management' },
  { name: 'Azure', icon: '/tool_icons/icons8-azure-48.png', description: 'Enterprise cloud services deployment' },
  { name: 'GCP', icon: '/tool_icons/icons8-google-cloud-48.png', description: 'Google Cloud Platform environments' },
  { name: 'Kubernetes', icon: '/tool_icons/icons8-kubernetes-480.png', description: 'Container orchestration automation' },
  { name: 'Docker', icon: '/tool_icons/icons8-docker-96.png', description: 'Container image building & registry' },
  { name: 'Jenkins', icon: '/tool_icons/icons8-jenkins-480.png', description: 'CI/CD pipeline configuration' },
  { name: 'GitHub', icon: '/tool_icons/icons8-github-96.png', description: 'Version control & Actions automation' },
  { name: 'GitLab', icon: '/tool_icons/icons8-gitlab-96.png', description: 'Source management & CI workflows' },
  { name: 'ArgoCD', icon: '/tool_icons/Argo_cd.png', description: 'Declarative GitOps deployment' },
  { name: 'Terraform', icon: '/tool_icons/icons8-terraform-96.png', description: 'Infrastructure as Code generation' },
  { name: 'Prometheus', icon: '/tool_icons/icons8-prometheus-96.png', description: 'Metrics & observability setup' },
  { name: 'Grafana', icon: '/tool_icons/icons8-grafana-96.png', description: 'Monitoring dashboards creation' },
];

const Integrations = () => {
  return (
    <section className="py-24 relative overflow-hidden bg-agentic-secondary">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 font-display text-agentic-text">
            Seamless <span className="text-agentic-primary">Integrations</span>
          </h2>
          <p className="text-xl text-agentic-text/80 max-w-2xl mx-auto font-sans">
            Works with all your favorite DevOps tools and cloud providers
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto flex flex-col items-center">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 w-full">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.name}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="glass-effect p-6 flex flex-col items-center justify-center space-y-3 cursor-pointer group relative"
              >
                <div className="w-12 h-12 flex items-center justify-center mb-2 group-hover:-translate-y-1 transition-transform">
                  <img src={integration.icon} alt={`${integration.name} logo`} className="w-10 h-10 object-contain hover:brightness-110 transition-all opacity-80 group-hover:opacity-100" />
                </div>
                <span className="text-sm font-medium text-agentic-text/80 group-hover:text-agentic-text transition-colors">
                  {integration.name}
                </span>

                {/* Tooltip */}
                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -top-2 translate-y-[-100%] w-48 bg-agentic-text text-agentic-surface text-xs rounded-md p-3 text-center shadow-lg z-20 left-1/2 -translate-x-1/2">
                  <p className="font-sans leading-relaxed">{integration.description}</p>
                  {/* Tooltip Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-[50%] border-[6px] border-transparent border-t-agentic-text"></div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center mt-12"
          >
            <p className="text-agentic-text/80 mb-6 font-sans">
              And many more integrations available
            </p>
            <motion.a
              href="#integrations"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-block px-6 py-3 bg-agentic-surface border border-agentic-text/10 text-agentic-text rounded-md font-medium shadow-sm hover:border-agentic-text/20 transition-all font-sans"
            >
              View All Integrations
            </motion.a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Integrations;

