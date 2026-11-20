import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { getSystemStatus } from "@/lib/admin/system-status";
export const dynamic = "force-dynamic";

function formatUptime(seconds: number): string {
  if (seconds === 0) return "N/A";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function StatusIcon({ status }: { status: "Operational" | "Degraded" | "Down" }) {
  if (status === "Operational") return <CheckCircle2 className="text-green-400" size={16} />;
  if (status === "Degraded") return <AlertTriangle className="text-yellow-400" size={16} />;
  return <XCircle className="text-red-400" size={16} />;
}

function statusColor(status: "Operational" | "Degraded" | "Down"): string {
  if (status === "Operational") return "text-green-400 bg-green-900/20";
  if (status === "Degraded") return "text-yellow-400 bg-yellow-900/20";
  return "text-red-400 bg-red-900/20";
}

function overallStatusColor(status: "Operational" | "Degraded" | "Down"): string {
  if (status === "Operational") return "bg-green-900/30 border-green-800";
  if (status === "Degraded") return "bg-yellow-900/30 border-yellow-800";
  return "bg-red-900/30 border-red-800";
}

export default async function SystemStatus() {
  const status = await getSystemStatus();

  return (
    <div className="p-8 pb-20 max-w-6xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-serif text-white mb-2">System Status</h1>
        <p className="text-sm text-gray-400">Real-time health monitoring for the Womb Atlas Observatory API and services.</p>
      </header>

      <div className="bg-[#1A1325] border border-[#3A2B4A] rounded-2xl p-6 flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className={`w-12 h-12 rounded-full border flex items-center justify-center ${overallStatusColor(status.overallStatus)}`}>
            <StatusIcon status={status.overallStatus} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-white">
              {status.overallStatus === "Operational" ? "All Systems Operational" :
               status.overallStatus === "Degraded" ? "Systems Degraded" : "Systems Down"}
            </h2>
            <p className="text-sm text-gray-400">
              Uptime: {formatUptime(status.uptimeSeconds)} | Last checked: Just now
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-serif text-white">{status.uptimePercent}%</p>
          <p className="text-sm text-gray-400">Uptime (30 days)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-[#3A2B4A] rounded-2xl bg-[#0F0C16] overflow-hidden">
          <div className="p-6 border-b border-[#3A2B4A]">
            <h3 className="text-lg font-medium text-white">API Endpoints</h3>
          </div>
          <div className="divide-y divide-[#2A1F36]">
            {status.endpoints.map((service, i) => (
              <div key={i} className="p-4 flex justify-between items-center hover:bg-[#1A1325] transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{service.name}</p>
                  <p className="text-xs text-gray-500">Latency: {service.latency}ms</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded ${statusColor(service.status)}`}>
                  {service.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-[#3A2B4A] rounded-2xl bg-[#0F0C16] overflow-hidden">
          <div className="p-6 border-b border-[#3A2B4A]">
            <h3 className="text-lg font-medium text-white">Infrastructure</h3>
          </div>
          <div className="divide-y divide-[#2A1F36]">
            {status.infrastructure.map((infra, i) => (
              <div key={i} className="p-4 flex justify-between items-center hover:bg-[#1A1325] transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{infra.name}</p>
                  <p className="text-xs text-gray-500">{infra.usage}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded ${statusColor(infra.status)}`}>
                  {infra.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
