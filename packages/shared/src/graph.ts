import type { RateEdge } from './domain.js'

/** Adjacency map: from -> to -> edge. At most one edge per direction per pair. */
export type RateGraph = Map<string, Map<string, RateEdge>>

export const buildGraph = (edges: RateEdge[]): RateGraph => {
  const graph: RateGraph = new Map()
  for (const edge of edges) {
    if (edge.rate <= 0 || !Number.isFinite(edge.rate)) continue
    let outgoing = graph.get(edge.from)
    if (!outgoing) {
      outgoing = new Map()
      graph.set(edge.from, outgoing)
    }
    outgoing.set(edge.to, edge)
  }
  return graph
}
