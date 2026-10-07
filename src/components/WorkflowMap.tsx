import { useMemo, useEffect, useCallback, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type NodeProps,
  type Node,
  type Edge,
  type ReactFlowInstance,
  MarkerType,
} from '@xyflow/react';
import {
  ArrowUpRight,
  UserRound,
  FileText,
  Maximize2,
  Columns3,
  Rows3,
  Eye,
  EyeOff,
} from 'lucide-react';
import { layout, tones, toneColors, type Direction } from '../lib/layout';
import { connectionStatus } from '../lib/trust';
import type { Workspace } from '../lib/types';
import '@xyflow/react/dist/style.css';
type SkillNodeData = {
  title: string;
  description: string;
  phase: string;
  skill: string;
  tone: string;
  index: number;
  human: boolean;
  direction: Direction;
  open: () => void;
};
type SkillNode = Node<SkillNodeData, 'skill'>;
function SkillCard({ data, selected }: NodeProps<SkillNode>) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Read ${data.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          data.open();
        }
      }}
      className={`skill-node tone-${data.tone} ${selected ? 'is-selected' : ''}`}
    >
      <Handle type="target" position={data.direction === 'LR' ? Position.Left : Position.Top} />
      <div className="node-phase">
        <span className="node-number">{String(data.index + 1).padStart(2, '0')}</span>
        <span>{data.phase}</span>
        {data.human ? <UserRound size={14} /> : <FileText size={14} />}
      </div>
      <h3>{data.title}</h3>
      <p>{data.description}</p>
      <div className="node-bottom">
        <code>{data.human ? 'human decision' : data.skill}</code>
        <ArrowUpRight size={14} />
      </div>
      <Handle type="source" position={data.direction === 'LR' ? Position.Right : Position.Bottom} />
    </div>
  );
}
const nodeTypes = { skill: SkillCard };
export function WorkflowMap({
  workspace,
  selected,
  onSelect,
  onConnection,
  direction,
  setDirection,
}: {
  workspace: Workspace;
  selected: string;
  onSelect: (id: string) => void;
  onConnection: (index: number) => void;
  direction: Direction;
  setDirection: (v: Direction) => void;
}) {
  const [showReferences, setShowReferences] = useState(true);
  const [instance, setInstance] = useState<ReactFlowInstance<SkillNode> | null>(null);
  const initial = useMemo(() => {
    const nodes: SkillNode[] = layout(workspace, direction).map((s) => ({
      id: s.id,
      type: 'skill',
      position: { x: s.x, y: s.y },
      selected: s.id === selected,
      data: {
        title: s.title,
        description: s.description,
        phase: s.phase ?? 'Skill reference',
        skill: s.skill ?? '',
        index: s.index,
        tone: s.kind === 'human' ? 'ink' : tones[s.index % tones.length],
        human: s.kind === 'human',
        direction,
        open: () => onSelect(s.id),
      },
    }));
    const edges: Edge[] = workspace.connections
      .filter((e) => showReferences || e.type !== 'reference')
      .map((e, i) => ({
        id: `${e.from}-${e.to}-${i}`,
        source: e.from,
        target: e.to,
        label: e.label,
        type: 'smoothstep',
        data: { connectionIndex: workspace.connections.indexOf(e) },
        ariaLabel: `${e.label}. ${connectionStatus(workspace.bundle.files, e)}. Open source evidence.`,
        interactionWidth: 24,
        style: {
          stroke: e.type === 'handoff' ? '#a3a3a3' : e.type === 'feedback' ? '#8e8e8e' : '#b3b3b3',
          strokeWidth: 1.5,
          strokeDasharray: e.type === 'handoff' ? undefined : '5 5',
        },
        labelStyle: { fill: '#707070', fontSize: 12, fontFamily: 'inherit' },
        labelBgStyle: { fill: '#f6f6f6', fillOpacity: 0.95 },
        labelBgPadding: [8, 5],
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: e.type === 'handoff' ? '#a3a3a3' : '#b3b3b3',
          width: 14,
          height: 14,
        },
      }));
    return { nodes, edges };
    // Selection is updated separately to preserve dragged positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, direction, showReferences]);
  const [nodes, setNodes, onNodesChange] = useNodesState<SkillNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
  }, [initial, setNodes, setEdges]);
  useEffect(() => {
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === selected })));
  }, [selected, setNodes]);
  useEffect(() => {
    if (!instance) return;
    const id = setTimeout(() => void instance.fitView({ padding: 0.12, duration: 350 }), 70);
    return () => clearTimeout(id);
  }, [initial, instance]);
  const init = useCallback((flow: ReactFlowInstance<SkillNode>) => setInstance(flow), []);
  return (
    <section className="map-panel" aria-label="Interactive workflow diagram">
      <div className="canvas-top">
        <span>
          <span className="status-dot" />
          {workspace.authored ? 'Authored workflow' : 'Markdown reference map'}
        </span>
        <span>
          {workspace.steps.length} steps · {workspace.connections.length} connections
        </span>
      </div>
      <div className="map-toolbar">
        <button
          onClick={() => setDirection(direction === 'LR' ? 'TB' : 'LR')}
          title="Change diagram direction"
          aria-label="Change diagram direction"
        >
          {direction === 'LR' ? <Columns3 size={16} /> : <Rows3 size={16} />}
        </button>
        <button
          onClick={() => setShowReferences((v) => !v)}
          title="Toggle reference connections"
          aria-label="Toggle reference connections"
          aria-pressed={showReferences}
        >
          {showReferences ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <button
          onClick={() => void instance?.fitView({ padding: 0.12, duration: 350 })}
          title="Fit diagram"
          aria-label="Fit diagram"
        >
          <Maximize2 size={16} />
        </button>
      </div>
      <ReactFlow<SkillNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, n) => onSelect(n.id)}
        onEdgeClick={(_, e) => onConnection(Number(e.data?.connectionIndex))}
        onInit={init}
        fitView
        minZoom={0.18}
        maxZoom={1.8}
        nodesConnectable={false}
        nodesFocusable={false}
        deleteKeyCode={null}
        aria-label="Skills and their connections"
        onNodeDragStop={(_, node) => onSelect(node.id)}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d8d8d8" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => toneColors[(n.data as SkillNodeData).tone] ?? '#616161'}
          maskColor="rgba(245,245,245,.75)"
          zoomable
          pannable
        />
      </ReactFlow>
      <div className="map-legend">
        <span>
          <i className="line-solid" />
          Handoff
        </span>
        <span>
          <i className="line-dashed" />
          Reference / feedback
        </span>
        <span className="legend-hint">Click a skill to read · click a connection for evidence</span>
      </div>
    </section>
  );
}
