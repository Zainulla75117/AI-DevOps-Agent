import { useState, useCallback, useMemo } from 'react';
import { ReactFlow, Controls, Background, applyNodeChanges, applyEdgeChanges, Handle, Position, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Server, Cloud, Database, Network, Activity, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CustomInfraNode = ({ data }) => {
  let IconTag = Cloud;
  let colorStr = "from-blue-500 to-cyan-500 shadow-blue-500/20";
  let labelStr = data.infraType;

  if (data.type === 'network') { IconTag = Network; colorStr = "from-indigo-500 to-purple-500 shadow-indigo-500/20"; labelStr = "VPC Net"; }
  else if (data.type === 'servers' || data.type === 'compute') { IconTag = Server; colorStr = "from-violet-500 to-fuchsia-500 shadow-violet-500/20"; labelStr = "Compute"; }
  else if (data.type === 'serverless') { IconTag = Activity; colorStr = "from-emerald-400 to-teal-500 shadow-emerald-500/20"; labelStr = "Serverless"; }
  else if (data.type === 'cloud-managed' || data.type === 'database') { IconTag = Database; colorStr = "from-amber-400 to-orange-500 shadow-amber-500/20"; labelStr = "Managed Core"; }
  else if (data.type === 'core') { IconTag = Cloud; colorStr = "from-slate-700 to-slate-900 shadow-slate-500/20"; labelStr = "Core System"; }

  const displayName = data.name || labelStr || "Resource";

  return (
    <div className="relative group flex flex-col items-center justify-center p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] min-w-[140px] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
      {/* Decorative top glow */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 rounded-b-full bg-gradient-to-r ${colorStr} opacity-50`} />
      
      <Handle type="target" position={Position.Top} className="w-0 h-0 opacity-0" />
      
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colorStr} text-white mb-3 shadow-lg transition-transform duration-300 group-hover:scale-110`}>
        <IconTag className="w-5 h-5" />
      </div>
      
      <span className="text-[13px] font-semibold text-slate-800 text-center max-w-[120px] truncate tracking-tight">{displayName}</span>
      {data.provider && (
        <span className="text-[9.5px] uppercase font-bold text-slate-400 mt-1 tracking-widest">{data.provider}</span>
      )}
      
      <Handle type="source" position={Position.Bottom} className="w-0 h-0 opacity-0" />
    </div>
  );
};

const InfrastructureTopologyModal = ({ project, projectInfra, onClose }) => {
  const nodeTypes = useMemo(() => ({ customInfraNode: CustomInfraNode }), []);

  // Generate nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!projectInfra || projectInfra.length === 0) return { initialNodes: [], initialEdges: [] };

    const radius = 280;
    const centerX = 450;
    const centerY = 350;

    const nodes = [];
    const edges = [];

    // Center Node (Project Root)
    nodes.push({
      id: 'center-node',
      position: { x: centerX - 70, y: centerY - 50 },
      data: { name: project.project_name, type: 'core' },
      type: 'customInfraNode'
    });

    projectInfra.forEach((infra, index) => {
      const angle = (index / projectInfra.length) * 2 * Math.PI - Math.PI / 2; // start from top
      const x = centerX + radius * Math.cos(angle) - 70;
      const y = centerY + radius * Math.sin(angle) - 50;

      const nodeId = infra.id || String(index);

      nodes.push({
        id: nodeId,
        position: { x, y },
        data: { ...infra },
        type: 'customInfraNode'
      });

      edges.push({
        id: `e-center-${nodeId}`,
        source: 'center-node',
        target: nodeId,
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 1.5, opacity: 0.5 }
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [projectInfra, project]);

  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 md:p-8"
      >
        <motion.div 
          initial={{ scale: 0.96, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="bg-[#FAFAFA] rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full h-full max-w-[1400px] max-h-[900px] overflow-hidden flex flex-col border border-white/60"
        >
          {/* Header */}
          <div className="flex-none flex items-center justify-between px-8 py-6 bg-white/70 backdrop-blur-2xl border-b border-white shadow-sm z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20">
                <Network className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Infrastructure Topology</h2>
                <p className="text-sm text-slate-500 mt-0.5">Interactive architecture map for <span className="font-medium text-slate-700">{project.project_name}</span></p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-black/5 hover:shadow-sm transition-all duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 w-full h-full relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
            >
              <Background color="#94a3b8" gap={24} size={1} />
              <Controls className="bg-white border-white shadow-[0_4px_20px_rgb(0,0,0,0.06)] rounded-xl" />
              <Panel position="bottom-right" className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 mr-6">
                <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-4">Resource Types</h3>
                <div className="flex flex-col gap-3.5">
                  <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-sm shadow-violet-500/30"></div><span className="text-[13px] font-medium text-slate-700">Compute</span></div>
                  <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm shadow-amber-500/30"></div><span className="text-[13px] font-medium text-slate-700">Database</span></div>
                  <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm shadow-emerald-500/30"></div><span className="text-[13px] font-medium text-slate-700">Serverless</span></div>
                  <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shadow-sm shadow-indigo-500/30"></div><span className="text-[13px] font-medium text-slate-700">Network</span></div>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InfrastructureTopologyModal;
