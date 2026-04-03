const InfrastructureView = ({ infrastructureList }) => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Infrastructure List</h2>
        <div className="text-sm text-slate-600">
          Total: <span className="font-semibold text-blue-600">{infrastructureList.length}</span>
        </div>
      </div>

      {infrastructureList.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-8 sm:p-12 shadow-lg border border-blue-200/50 text-center">
          <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📦</div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">No Infrastructure Created</h3>
          <p className="text-sm sm:text-base text-slate-600">Create your first infrastructure to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {infrastructureList.map((infra) => (
            <div
              key={infra.id}
              className="bg-white/80 backdrop-blur-lg rounded-xl p-4 sm:p-6 shadow-lg border border-blue-200/50 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">
                    {infra.provider === 'aws' ? '☁️' : '🏢'}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-slate-800 capitalize">{infra.provider}</span>
                </div>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                  {infra.service}
                </span>
              </div>

              {infra.type === 'network' && (
                <div className="space-y-1.5 sm:space-y-2">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-800">{infra.data.vpcName}</h3>
                  <div className="text-xs sm:text-sm text-slate-600 space-y-1">
                    <p><span className="font-medium">CIDR:</span> {infra.data.vpcCidr}</p>
                    <p><span className="font-medium">Public Subnets:</span> {infra.data.publicSubnets}</p>
                    <p><span className="font-medium">Private Subnets:</span> {infra.data.privateSubnets}</p>
                    <p><span className="font-medium">NAT Gateways:</span> {infra.data.natGateways}</p>
                    <p><span className="font-medium">Internet Gateways:</span> {infra.data.internetGateways}</p>
                  </div>
                </div>
              )}

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-blue-200/50">
                <p className="text-xs text-slate-500">
                  Created: {new Date(infra.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default InfrastructureView

