import { prisma } from "@/lib/prisma";
import { ActionType, Prisma } from "@prisma/client";
import { TablePagination } from "@/components/ui";
import { AuditFilter } from "./AuditFilter";
import { AuditDataModal } from "./AuditDataModal";
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const PAGE_SIZE = 25;

export default async function AuditLogsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;

  const whereClause: Prisma.AuditLogWhereInput = {};

  if (typeof searchParams.actionType === 'string' && searchParams.actionType) {
    whereClause.actionType = searchParams.actionType as ActionType;
  }
  if (typeof searchParams.entityType === 'string' && searchParams.entityType) {
    whereClause.entityType = { contains: searchParams.entityType };
  }
  if (typeof searchParams.userEmail === 'string' && searchParams.userEmail) {
    whereClause.user = { email: { contains: searchParams.userEmail } };
  }

  const requestedPage = Number.parseInt(
    typeof searchParams.page === 'string' ? searchParams.page : '1',
    10
  );

  const total = await prisma.auditLog.count({ where: whereClause });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp so a stale ?page= from a wider result set can't land on an empty table.
  const page = Math.min(Math.max(Number.isNaN(requestedPage) ? 1 : requestedPage, 1), totalPages);

  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    orderBy: { timestamp: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { user: true }
  });

  return (
    <div className="p-8 pb-20 max-w-6xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-serif text-white mb-2">Audit Logs</h1>
        <p className="text-sm text-gray-400">View system-wide entity changes and actions.</p>
      </header>

      <AuditFilter />

      <div className="border border-[#3A2B4A] rounded-2xl bg-[#0F0C16] overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-[#1A1325] border-b border-[#3A2B4A]">
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Timestamp</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Entity Type</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Entity ID</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A1F36]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500 text-sm">
                  No audit logs found matching the filters.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#1A1325] transition-colors">
                  <td className="p-4 text-sm text-gray-400 whitespace-nowrap">
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "short",
                      timeStyle: "medium"
                    }).format(new Date(log.timestamp))}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      log.actionType === 'CREATE' ? 'bg-green-500/10 text-green-400' :
                      log.actionType === 'UPDATE' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {log.actionType}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-300">{log.entityType}</td>
                  <td className="p-4 text-sm text-gray-400 font-mono text-xs">{log.entityId}</td>
                  <td className="p-4 text-sm text-gray-300">
                    {log.user?.email || log.userId || "System"}
                  </td>
                  <td className="p-4 text-sm text-gray-400">
                    <AuditDataModal dataBefore={log.dataBefore} dataAfter={log.dataAfter} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        itemLabel="log entry"
        itemLabelPlural="log entries"
      />
    </div>
  );
}
