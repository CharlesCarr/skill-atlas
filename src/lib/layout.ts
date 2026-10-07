import dagre from '@dagrejs/dagre';
import type { Workspace } from './types';
export type Direction = 'LR' | 'TB';
export const NODE_W = 244,
  NODE_H = 184;
export function layout(workspace: Workspace, direction: Direction = 'LR') {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep: 58, ranksep: 100, marginx: 30, marginy: 30 });
  workspace.steps.forEach((s) => graph.setNode(s.id, { width: NODE_W, height: NODE_H }));
  workspace.connections
    .filter((e) => e.type === 'handoff' || !workspace.authored)
    .forEach((e) => graph.setEdge(e.from, e.to));
  dagre.layout(graph);
  return workspace.steps.map((s, i) => {
    const p = graph.node(s.id) as { x: number; y: number };
    const skill = workspace.skills.find((skill) => skill.id === s.skill);
    return {
      ...s,
      x: p.x - NODE_W / 2,
      y: p.y - NODE_H / 2,
      index: i,
      title: s.title ?? skill?.title ?? s.id,
      description: s.description ?? skill?.description ?? '',
      path: skill?.path,
    };
  });
}
export const tones = ['sage', 'blue', 'amber', 'violet', 'sage', 'ink'];
export const toneColors: Record<string, string> = {
  sage: '#2d7256',
  blue: '#426a9b',
  amber: '#a26d24',
  violet: '#7b5b98',
  ink: '#3d4652',
};
