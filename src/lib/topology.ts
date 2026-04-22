import { LZ_CHAINS, findChainByEid } from './oft';

export type PeerMap = Record<string, Set<number>>;

export interface TopologyGraph {
  edges: Map<string, Set<string>>;
}

export function buildGraph(peerMap: PeerMap): TopologyGraph {
  const edges = new Map<string, Set<string>>();
  for (const chain of LZ_CHAINS) {
    const eids = peerMap[chain.key];
    if (!eids) continue;
    const dests = new Set<string>();
    for (const eid of eids) {
      const c = findChainByEid(eid);
      if (c) dests.add(c.key);
    }
    edges.set(chain.key, dests);
  }
  return { edges };
}

export function shortestPath(
  graph: TopologyGraph,
  srcKey: string,
  dstKey: string,
): string[] | null {
  if (srcKey === dstKey) return [srcKey];
  const visited = new Set<string>([srcKey]);
  const queue: Array<[string, string[]]> = [[srcKey, [srcKey]]];
  while (queue.length) {
    const [node, path] = queue.shift()!;
    const neighbors = graph.edges.get(node) ?? new Set<string>();
    for (const n of neighbors) {
      if (visited.has(n)) continue;
      const newPath = [...path, n];
      if (n === dstKey) return newPath;
      visited.add(n);
      queue.push([n, newPath]);
    }
  }
  return null;
}

export function directPeer(peerMap: PeerMap, srcKey: string, dstEid: number): boolean {
  return peerMap[srcKey]?.has(dstEid) ?? false;
}
