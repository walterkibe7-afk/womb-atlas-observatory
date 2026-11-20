import { Lock } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CreateUserButton } from "@/components/CreateUserButton";
import { EditRoleDropdown } from "@/components/EditRoleDropdown";
import { TablePagination } from "@/components/ui";
import { AccessFilters } from "./AccessFilters";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const ROLES = ["participant", "steward", "analyst", "admin"];

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AccessControl(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;

  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const role =
    typeof searchParams.role === "string" && ROLES.includes(searchParams.role) ? searchParams.role : "";
  const requestedPage = Number.parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10);

  const where: Prisma.UserWhereInput = {};
  if (query) {
    where.OR = [
      { email: { contains: query } },
      { name: { contains: query } },
      { id: { contains: query } }
    ];
  }
  if (role) {
    where.role = role;
  }

  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp so a stale ?page= from a wider result set can't land on an empty table.
  const page = Math.min(Math.max(Number.isNaN(requestedPage) ? 1 : requestedPage, 1), totalPages);

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE
  });

  const isFiltered = Boolean(query || role);

  return (
    <div className="p-4 sm:p-8 pb-20 max-w-6xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-serif text-white mb-2">Access Control (RBAC)</h1>
        <p className="text-sm text-gray-400">Manage user roles, grant steward permissions, and enforce security policies.</p>
      </header>

      <AccessFilters>
        <CreateUserButton />
      </AccessFilters>

      <div className="border border-[#3A2B4A] rounded-2xl bg-[#0F0C16] overflow-x-auto">
        <table className="w-full min-w-[760px] text-left border-collapse">
          <thead>
            <tr className="bg-[#1A1325] border-b border-[#3A2B4A]">
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">User / Email</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Current Role</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Created / Login</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Security Status</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A1F36]">
            {users.map((row) => (
              <tr key={row.id} className="hover:bg-[#1A1325] transition-colors">
                <td className="p-4">
                  <p className="text-sm font-medium text-white">{row.name || "Unknown"}</p>
                  <p className="text-xs text-gray-400">{row.email}</p>
                </td>
                <td className="p-4">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium capitalize ${
                    row.role === 'admin' ? 'bg-blue-900/30 text-blue-400 border border-blue-800' :
                    row.role === 'steward' ? 'bg-[var(--color-brand-gold)] bg-opacity-20 text-[var(--color-brand-gold)] border border-[var(--color-brand-gold)] border-opacity-30' :
                    'bg-[#2A1F36] text-gray-300 border border-[#3A2B4A]'
                  }`}>
                    {row.role}
                  </span>
                </td>
                <td className="p-4 text-sm text-gray-300 whitespace-nowrap">
                  {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.createdAt))}
                </td>
                <td className="p-4">
                  <span className={`flex items-center space-x-1 text-xs ${row.password ? 'text-green-400' : 'text-gray-400'}`}>
                    {row.password ? <Lock size={12} /> : null}
                    <span>{row.password ? 'Password Enabled' : 'OAuth Only'}</span>
                  </span>
                </td>
                <td className="p-4 text-right">
                  <EditRoleDropdown userId={row.id} currentRole={row.role} />
                </td>
              </tr>
            ))}
            
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500 text-sm">
                  {isFiltered
                    ? "No users match the current search or role filter."
                    : "No users found in the database."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        itemLabel="user"
      />
    </div>
  );
}
