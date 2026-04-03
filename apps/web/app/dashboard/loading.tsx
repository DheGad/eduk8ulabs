export default function DashboardLoading() {
  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Sidebar Skeleton */}
      <aside className="w-64 border-r border-white/5 bg-[#111111]/50 p-6 space-y-8 hidden md:block">
        <div className="h-8 w-32 bg-[#1a1a1a] rounded-lg animate-pulse" />
        
        <div className="space-y-4 pt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-full bg-[#1a1a1a] rounded-xl animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>

        <div className="pt-20 space-y-4">
          <div className="h-10 w-full bg-[#1a1a1a] rounded-xl animate-pulse opacity-50" />
          <div className="h-10 w-full bg-[#1a1a1a] rounded-xl animate-pulse opacity-30" />
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <main className="flex-1 p-8 md:p-12 space-y-10 overflow-y-auto">
        <header className="flex justify-between items-center">
          <div className="space-y-3">
            <div className="h-8 w-48 bg-[#1a1a1a] rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-[#1a1a1a] rounded-md animate-pulse opacity-60" />
          </div>
          <div className="h-10 w-10 bg-[#1a1a1a] rounded-full animate-pulse" />
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4 animate-pulse" style={{ animationDelay: `${i * 150}ms` }}>
              <div className="h-4 w-16 bg-[#1a1a1a] rounded" />
              <div className="h-8 w-24 bg-[#1a1a1a] rounded-lg" />
            </div>
          ))}
        </div>

        {/* Large Content Areas */}
        <div className="space-y-6 pt-4">
          <div className="h-[400px] w-full bg-[#111111] border border-white/5 rounded-3xl animate-pulse flex flex-col p-8 space-y-6">
            <div className="h-6 w-40 bg-[#1a1a1a] rounded-md" />
            <div className="flex-1 w-full bg-[#1a1a1a]/50 rounded-2xl" />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="h-[300px] bg-[#111111] border border-white/5 rounded-3xl animate-pulse p-8 space-y-6">
                <div className="h-6 w-32 bg-[#1a1a1a] rounded-md" />
                <div className="space-y-4">
                  <div className="h-4 w-full bg-[#1a1a1a] rounded" />
                  <div className="h-4 w-full bg-[#1a1a1a] rounded" />
                  <div className="h-4 w-3/4 bg-[#1a1a1a] rounded" />
                </div>
             </div>
             <div className="h-[300px] bg-[#111111] border border-white/5 rounded-3xl animate-pulse p-8 space-y-6">
                <div className="h-6 w-32 bg-[#1a1a1a] rounded-md" />
                <div className="space-y-4">
                  <div className="h-4 w-full bg-[#1a1a1a] rounded" />
                  <div className="h-4 w-full bg-[#1a1a1a] rounded" />
                  <div className="h-4 w-3/4 bg-[#1a1a1a] rounded" />
                </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
