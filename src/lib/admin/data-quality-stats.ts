import { prisma } from '@/lib/prisma'

export interface DataQualityOverview {
  completeness: number
  consistency: number
  validity: number
  duplicationRate: number
  missingData: number
}

function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim() !== ''
  return true
}

function isValidValue(
  value: unknown,
  fieldType: string,
  options: { value: string }[],
): boolean {
  switch (fieldType) {
    case 'single_select':
    case 'multi_select': {
      if (value === null || value === undefined) return false
      const validValues = new Set(options.map((o) => o.value))
      if (Array.isArray(value)) {
        return value.length > 0 && value.every((v) => validValues.has(String(v)))
      }
      return validValues.has(String(value))
    }
    case 'boolean':
      return value === true || value === false || value === 'true' || value === 'false'
    case 'text':
    case 'country':
      return value !== null && value !== undefined && String(value).trim() !== ''
    case 'text_audio':
      return value !== null && value !== undefined
    default:
      return value !== null && value !== undefined
  }
}

export async function getDataQualityOverview(): Promise<DataQualityOverview> {
  const allQuestions = await prisma.formQuestion.findMany({
    include: { options: { select: { value: true } } },
  })

  const totalFields = allQuestions.length
  const requiredFieldIds = new Set(
    allQuestions.filter((q) => q.required === 'Required').map((q) => q.fieldId),
  )
  const totalRequiredFields = requiredFieldIds.size

  const observations = await prisma.observation.findMany({
    where: { completedAt: { not: null } },
    select: {
      id: true,
      userId: true,
      responses: {
        select: { fieldId: true, value: true },
      },
      reproductive: {
        select: { ever_pregnant: true, pregnancy_count: true },
      },
      atlasRecord: { select: { id: true } },
    },
  })

  const totalCompletedObservations = observations.length

  if (totalCompletedObservations === 0) {
    return {
      completeness: 100,
      consistency: 100,
      validity: 100,
      duplicationRate: 0,
      missingData: 0,
    }
  }

  let filledRequiredResponses = 0
  let filledResponses = 0
  let validResponses = 0
  let totalResponses = 0

  for (const obs of observations) {
    const responseMap = new Map(obs.responses.map((r) => [r.fieldId, r]))

    for (const question of allQuestions) {
      const response = responseMap.get(question.fieldId)
      const value = response?.value ?? null
      const filled = isNonEmpty(value)

      if (filled) {
        filledResponses++
        if (requiredFieldIds.has(question.fieldId)) {
          filledRequiredResponses++
        }
      }

      if (response) {
        totalResponses++
        if (isValidValue(value, question.fieldType, question.options)) {
          validResponses++
        }
      }
    }
  }

  const totalRequiredPairs = totalRequiredFields * totalCompletedObservations
  const totalPossibleResponses = totalFields * totalCompletedObservations

  const completeness =
    totalRequiredPairs > 0
      ? Math.round((filledRequiredResponses / totalRequiredPairs) * 100 * 10) / 10
      : 100

  const missingData =
    totalPossibleResponses > 0
      ? Math.round(
          ((totalPossibleResponses - filledResponses) / totalPossibleResponses) *
            100 *
            10,
        ) / 10
      : 0

  const validity =
    totalResponses > 0
      ? Math.round((validResponses / totalResponses) * 100 * 10) / 10
      : 100

  let consistentObservations = 0

  for (const obs of observations) {
    let consistent = true

    if (obs.reproductive?.ever_pregnant === 'No') {
      const pc = obs.reproductive.pregnancy_count
      if (pc !== null && pc !== undefined && pc !== '') {
        consistent = false
      }
    }

    if (!obs.atlasRecord) {
      consistent = false
    }

    if (consistent) {
      consistentObservations++
    }
  }

  const consistency = Math.round((consistentObservations / totalCompletedObservations) * 100 * 10) / 10

  const userObsMap = new Map<string, typeof observations>()
  for (const obs of observations) {
    const group = userObsMap.get(obs.userId) || []
    group.push(obs)
    userObsMap.set(obs.userId, group)
  }

  let duplicateCount = 0
  for (const [, userObs] of userObsMap) {
    if (userObs.length < 2) continue

    const signatures = userObs.map((obs) =>
      JSON.stringify(
        [...obs.responses]
          .map((r) => [r.fieldId, JSON.stringify(r.value)])
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    )

    const seen = new Set<string>()
    for (const sig of signatures) {
      if (seen.has(sig)) {
        duplicateCount++
      } else {
        seen.add(sig)
      }
    }
  }

  const duplicationRate = Math.round((duplicateCount / totalCompletedObservations) * 100 * 10) / 10

  return {
    completeness,
    consistency,
    validity,
    duplicationRate,
    missingData,
  }
}
