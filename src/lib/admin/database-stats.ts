import { prisma } from "@/lib/prisma";

export interface TableStats {
  name: string;
  rows: number;
  size: number;
  health: "Optimal" | "Warning" | "Critical";
}

export interface DatabaseStats {
  totalRecords: number;
  totalStorage: number;
  totalTables: number;
  activeConnections: number;
  tables: TableStats[];
}

function formatHealth(rows: number, sizeMB: number): "Optimal" | "Warning" | "Critical" {
  if (rows > 100000 || sizeMB > 1500) return "Critical";
  if (rows > 50000 || sizeMB > 1000) return "Warning";
  return "Optimal";
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const databaseName = process.env.DATABASE_URL?.split("/").pop()?.split("?")[0] || "wombatlas_db";

  const tableStats = await prisma.$queryRaw<Array<{
    TABLE_NAME: string;
    TABLE_ROWS: bigint;
    DATA_LENGTH: bigint;
    INDEX_LENGTH: bigint;
  }>>`
    SELECT 
      TABLE_NAME,
      TABLE_ROWS,
      DATA_LENGTH,
      INDEX_LENGTH
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ${databaseName}
    ORDER BY TABLE_ROWS DESC
  `;

  const connectionStatus = await prisma.$queryRaw<Array<{ Variable_name: string; Value: string }>>`
    SHOW STATUS LIKE 'Threads_connected'
  `;

  const tables: TableStats[] = tableStats.map((table) => {
    const sizeMB = Math.round((Number(table.DATA_LENGTH) + Number(table.INDEX_LENGTH)) / 1024 / 1024);
    return {
      name: table.TABLE_NAME,
      rows: Number(table.TABLE_ROWS),
      size: sizeMB,
      health: formatHealth(Number(table.TABLE_ROWS), sizeMB),
    };
  });

  const totalRecords = tables.reduce((sum, t) => sum + t.rows, 0);
  const totalStorage = tables.reduce((sum, t) => sum + t.size, 0);

  return {
    totalRecords,
    totalStorage,
    totalTables: tables.length,
    activeConnections: parseInt(connectionStatus[0]?.Value || "0", 10),
    tables,
  };
}
