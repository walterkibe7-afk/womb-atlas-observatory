import { auth } from '@/auth'
import { getObservationReturnRateStats } from '@/lib/admin/observation-return-rate-stats'

export async function GET() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role

  if (!session || role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await getObservationReturnRateStats()
    return Response.json(stats)
  } catch (error) {
    console.error('Observation return rate error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
