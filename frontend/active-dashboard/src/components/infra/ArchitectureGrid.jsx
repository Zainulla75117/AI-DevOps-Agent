import { Network, Server, Cloud, Database, Activity } from 'lucide-react'

/**
 * ArchitectureGrid — Horizontal chain of infrastructure nodes with icons and connecting lines.
 * @param {{ infraItems: Array }} props
 */
const ArchitectureGrid = ({ infraItems }) => {
  return (
    <div className="flex items-center overflow-x-auto pb-2 scrollbar-hide relative z-10">
      {infraItems.map((infra, idx) => {
        let IconTag = Cloud;
        let colorStr = "text-blue-600 bg-blue-50";
        let bgStr = "bg-white border-slate-200";
        let labelStr = infra.infraType;

        if (infra.infraType === 'network') { IconTag = Network; colorStr = "text-indigo-600 bg-indigo-50"; labelStr = "VPC Net"; }
        else if (infra.infraType === 'servers') { IconTag = Server; colorStr = "text-violet-600 bg-violet-50"; labelStr = "Compute"; }
        else if (infra.infraType === 'serverless') { IconTag = Activity; colorStr = "text-emerald-600 bg-emerald-50"; labelStr = "Serverless"; }
        else if (infra.infraType === 'cloud-managed') { IconTag = Database; colorStr = "text-amber-600 bg-amber-50"; labelStr = "Managed Core"; }
        else { labelStr = "AI Stack"; }

        return (
          <div key={idx} className="flex items-center flex-shrink-0 group/node">
            <div className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border ${bgStr} min-w-[96px] shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-300 bg-white hover:-translate-y-1 cursor-default`}>
              <div className={`p-2 rounded-lg ${colorStr}`}>
                <IconTag className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[80px]">{labelStr}</span>
            </div>
            {idx < infraItems.length - 1 && (
              <div className="w-8 flex items-center justify-center relative">
                <div className="w-full h-px bg-slate-300 border-t border-dashed border-slate-300"></div>
                <div className="absolute w-1.5 h-1.5 rounded-full bg-slate-200 border border-slate-300 right-[-3px]"></div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ArchitectureGrid
