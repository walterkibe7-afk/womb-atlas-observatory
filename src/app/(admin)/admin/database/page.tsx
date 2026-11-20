import { Database, HardDrive, Cpu, Activity } from "lucide-react";
import { getDatabaseStats } from "@/lib/admin/database-stats";
export const dynamic = "force-dynamic";

function formatStorage(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default async function DatabaseManagement() {
  const stats = await getDatabaseStats();

  const statCards = [
    { label: "Total Records", value: formatNumber(stats.totalRecords), icon: Database, color: "text-blue-400" },
    { label: "MySQL Storage", value: formatStorage(stats.totalStorage), icon: HardDrive, color: "text-purple-400" },
    { label: "Total Tables", value: String(stats.totalTables), icon: Cpu, color: "text-green-400" },
    { label: "Active Connections", value: String(stats.activeConnections), icon: Activity, color: "text-yellow-400" },
  ];

  return (
    <div className="p-8 pb-20 max-w-6xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-serif text-white mb-2">Database Management</h1>
        <p className="text-sm text-gray-400">Monitor storage capacity, table sizes, and infrastructure health.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-[#1A1325] border border-[#3A2B4A] rounded-2xl p-6 relative overflow-hidden">
            <stat.icon className={`absolute right-4 top-4 opacity-20 ${stat.color}`} size={48} />
            <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
            <p className="text-3xl font-serif text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="border border-[#3A2B4A] rounded-2xl bg-[#0F0C16] overflow-hidden">
        <div className="p-6 border-b border-[#3A2B4A]">
          <h2 className="text-xl font-serif text-white">Table Size Distribution</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1A1325] border-b border-[#3A2B4A]">
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Table Name</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Row Count</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Size (MB)</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A1F36]">
            {stats.tables.map((row) => (
              <tr key={row.name} className="hover:bg-[#1A1325] transition-colors">
                <td className="p-4 text-sm text-blue-400 font-mono">{row.name}</td>
                <td className="p-4 text-sm text-gray-300">{formatNumber(row.rows)}</td>
                <td className="p-4 text-sm text-gray-300">{row.size} MB</td>
                <td className="p-4">
                  <span className={`text-xs font-medium ${
                    row.health === 'Optimal' ? 'text-green-400' :
                    row.health === 'Warning' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {row.health}
                  </span>
                </td>
              </tr>
            ))}
            {stats.tables.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500 text-sm">
                  No tables found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
