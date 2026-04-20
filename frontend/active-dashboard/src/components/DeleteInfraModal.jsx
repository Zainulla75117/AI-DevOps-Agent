import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, ShieldAlert, AlertTriangle, Server, Database, Network, Activity, Info } from 'lucide-react'
import { getResourcesByProject, deleteResource, deleteResourcesByProject } from '../services/infrastructureService'

const DeleteInfraModal = ({ project, onClose, onDeletedAll, onInfraUpdated }) => {
  const [infraData, setInfraData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState(null)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    loadInfra()
  }, [])
  
  const loadInfra = async () => {
    try {
      setIsLoading(true)
      // Fetch from unified resource API using project.id (ObjectId)
      const resources = await getResourcesByProject(project.id)
      setInfraData(resources || [])
      if (onInfraUpdated) onInfraUpdated(resources || [])
    } catch (e) {
      setError(e.message || "Failed to load infrastructure")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteItem = async (type, id) => {
    if (!window.confirm("Are you sure you want to delete this specific infrastructure component?")) return;
    
    setDeletingItemId(id)
    setError(null)
    try {
      await deleteResource(id)
      await loadInfra() // reload
    } catch (e) {
      setError(e.message || "Failed to delete item")
    } finally {
      setDeletingItemId(null)
    }
  }
  
  const handleDeleteAll = async () => {
    if(!window.confirm(`Are you extremely certain you want to delete ALL infrastructure for ${project.project_name}? This action is irreversible.`)) return;
    
    setIsDeletingAll(true)
    setError(null)
    try {
      await deleteResourcesByProject(project.id)
      if (onDeletedAll) onDeletedAll()
      onClose()
    } catch (e) {
      setError(e.message || "Failed to delete all infrastructure")
      setIsDeletingAll(false)
    }
  }

  // Map unified resource type to display properties
  const getTypeDisplay = (type) => {
    switch (type) {
      case 'network': return { _type: 'network', _label: 'VPC Network', _icon: Network, color: 'text-indigo-500', bg: 'bg-indigo-50' }
      case 'compute': return { _type: 'compute', _label: 'Compute Servers', _icon: Server, color: 'text-violet-500', bg: 'bg-violet-50' }
      case 'serverless': return { _type: 'serverless', _label: 'Serverless', _icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' }
      case 'database': return { _type: 'database', _label: 'Cloud Managed', _icon: Database, color: 'text-orange-500', bg: 'bg-orange-50' }
      default: return { _type: type, _label: type || 'Resource', _icon: Server, color: 'text-slate-500', bg: 'bg-slate-50' }
    }
  }

  const flattenInfra = () => {
    if (!infraData || !Array.isArray(infraData)) return []
    return infraData.map(r => ({
      ...r.config,
      id: r.id,
      _id: r.id,
      name: r.name,
      state: r.state,
      version: r.version,
      ...getTypeDisplay(r.type),
    }))
  }

  const items = flattenInfra()
  const hasServers = Array.isArray(infraData) && infraData.some(r => r.type === 'compute');
  const isNetworkDisabled = (itemType) => itemType === 'network' && hasServers;

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shadow-sm border border-red-200">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-display">Manage Infrastructure</h3>
                <p className="text-sm text-slate-500">Selectively delete provisioned resources for {project.project_name}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <span className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></span>
                <p className="text-sm font-medium">Scanning provisioned infrastructure...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                  <Database className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">No Infrastructure Found</h4>
                <p className="text-slate-500 max-w-sm mx-auto text-sm">This project currently has no active infrastructure provisioned. You can safely close this menu.</p>
              </div>
            ) : (
               <div className="space-y-3">
                 {items.map((item, idx) => {
                   const itemId = item.id || item._id;
                   const isDeleting = deletingItemId === itemId;
                   const disabledText = isNetworkDisabled(item._type) 
                     ? "Cannot delete Network while Servers are still active. Delete servers first."
                     : null;

                   return (
                     <div key={itemId || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
                       <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 ${item.bg} rounded-lg flex items-center justify-center ${item.color} flex-shrink-0`}>
                           <item._icon className="w-5 h-5" />
                         </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">{item.name || `${item._label} Resource`}</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                               {item.state && <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${item.state === 'provisioned' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : item.state === 'failed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{item.state}</span>}
                               {item.vpc_name && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">VPC: {item.vpc_name}</span>}
                               {item.instance_type && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">Type: {item.instance_type}</span>}
                               {item.service_name && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">Name: {item.service_name}</span>}
                               {item.runtime && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">Runtime: {item.runtime}</span>}
                               {item.version && <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">v{item.version}</span>}
                               <span className="text-[10px] text-slate-400 px-2 py-1 font-mono">{itemId.substring(0,8)}...</span>
                            </div>
                          </div>
                       </div>
                       
                       <div className="flex items-center flex-shrink-0 gap-3">
                         {disabledText && (
                            <div className="group relative flex items-center">
                              <Info className="w-4 h-4 text-amber-500" />
                              <div className="absolute right-0 bottom-full mb-2 w-64 bg-slate-800 text-white text-[10px] sm:text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                {disabledText}
                              </div>
                            </div>
                         )}
                         <button
                           onClick={() => handleDeleteItem(item._type, itemId)}
                           disabled={isDeleting || !!disabledText || isDeletingAll}
                           className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors border ${
                             disabledText 
                              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300'
                           }`}
                         >
                           {isDeleting ? (
                             <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
                           ) : (
                             <Trash2 className="w-4 h-4" />
                           )}
                           Delete
                         </button>
                       </div>
                     </div>
                   )
                 })}
               </div>
            )}
          </div>

          {/* Footer with Delete All */}
          {items.length > 0 && (
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg max-w-sm">
                <strong>Disclaimer:</strong> Using the <i>Delete All Infrastructure</i> action will permanently destroy all linked dependencies instantaneously. Use with extreme caution.
              </div>
              <button
                onClick={handleDeleteAll}
                disabled={isDeletingAll || deletingItemId}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {isDeletingAll ? (
                   <>
                     <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                     Wiping System...
                   </>
                ) : (
                   <>
                     <ShieldAlert className="w-4 h-4" />
                     Delete All Infrastructure
                   </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default DeleteInfraModal
