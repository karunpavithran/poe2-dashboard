import type { DbTransaction } from '../../../db/client.js'
import type { AtlasStrategyRowWithChildren } from '../atlas.dto.js'

/**
 * All strategies with their children: most recently updated first (id tiebreak
 * for determinism), tablets in user-authored order, tags alphabetical.
 */
export const selectStrategyRows = (tx: DbTransaction): AtlasStrategyRowWithChildren[] =>
  tx.query.atlasStrategies
    .findMany({
      with: {
        tablets: { orderBy: (tablets, { asc }) => [asc(tablets.sortOrder)] },
        tags: { orderBy: (tags, { asc }) => [asc(tags.tag)] },
      },
      orderBy: (strategies, { asc, desc }) => [desc(strategies.updatedAt), asc(strategies.id)],
    })
    .sync()
