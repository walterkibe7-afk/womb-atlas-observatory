import { prisma } from '@/lib/prisma'

export interface ObservationReturnRateStats {
  returnRate30Days: number
  returnRate90Days: number
  returnRate180Days: number
  trend30Days: number
  trend90Days: number
  trend180Days: number
  totalReturningObservers: number
  newObserversThisWeek: number
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0
    return 100
  }
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export async function getObservationReturnRateStats(): Promise<ObservationReturnRateStats> {
  const now = new Date()
  const weekStart = getWeekStart(now)

  const users = await prisma.user.findMany({
    where: {
      observations: {
        some: {
          completedAt: { not: null },
        },
      },
    },
    select: {
      id: true,
      observations: {
        where: {
          completedAt: { not: null },
        },
        orderBy: { completedAt: 'asc' },
        select: {
          completedAt: true,
        },
        take: 2,
      },
    },
  })

  const userObsList = users
    .map((u) => u.observations)
    .filter((obs) => obs.length >= 1)

  const usersWithTwo = userObsList.filter((obs) => obs.length >= 2)

  const totalReturningObservers = usersWithTwo.length

  function rateForWindow(days: number): number {
    let count = 0
    for (const obs of usersWithTwo) {
      const first = obs[0].completedAt!
      const second = obs[1].completedAt!
      const diffDays =
        (second.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays <= days) count++
    }
    return usersWithTwo.length > 0
      ? Math.round((count / usersWithTwo.length) * 1000) / 10
      : 0
  }

  function trendForWindow(days: number): number {
    const currentMonthStart = getMonthStart(now)
    const prevMonthStart = new Date(
      currentMonthStart.getFullYear(),
      currentMonthStart.getMonth() - 1,
      1,
    )

    let currentCount = 0
    let currentTotal = 0
    let prevCount = 0
    let prevTotal = 0

    for (const obs of userObsList) {
      const firstDate = obs[0].completedAt
      if (!firstDate) continue

      if (firstDate >= currentMonthStart) {
        currentTotal++
        if (obs.length >= 2) {
          const secondDate = obs[1].completedAt!
          const diffDays =
            (secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
          if (diffDays <= days) currentCount++
        }
      } else if (firstDate >= prevMonthStart && firstDate < currentMonthStart) {
        prevTotal++
        if (obs.length >= 2) {
          const secondDate = obs[1].completedAt!
          const diffDays =
            (secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
          if (diffDays <= days) prevCount++
        }
      }
    }

    const currentRate = currentTotal > 0
      ? Math.round((currentCount / currentTotal) * 1000) / 10
      : 0
    const prevRate = prevTotal > 0
      ? Math.round((prevCount / prevTotal) * 1000) / 10
      : 0

    return calcChange(currentRate, prevRate)
  }

  const newObserversThisWeek = users.filter((u) => {
    const firstObs = u.observations[0]
    return firstObs && firstObs.completedAt && firstObs.completedAt >= weekStart
  }).length

  return {
    returnRate30Days: rateForWindow(30),
    returnRate90Days: rateForWindow(90),
    returnRate180Days: rateForWindow(180),
    trend30Days: trendForWindow(30),
    trend90Days: trendForWindow(90),
    trend180Days: trendForWindow(180),
    totalReturningObservers,
    newObserversThisWeek,
  }
}
