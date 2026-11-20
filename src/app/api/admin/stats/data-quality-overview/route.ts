import { auth } from '@/auth'
import { getDataQualityOverview } from '@/lib/admin/data-quality-stats'

export async function GET() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role

  if (!session || role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await getDataQualityOverview()
    return Response.json(stats)
  } catch (error) {
    console.error('Data quality overview error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
