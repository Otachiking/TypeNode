import React, { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Dagre from '@dagrejs/dagre';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Task, Thread } from '../models/types';
import { RELATIONSHIP_LABELS } from '../models/types';

// ─── Custom Task Node ───
interface TaskNodeData {
  task: Task;
  thread?: Thread;
  [key: string]: unknown;
}

const TaskNode: React.FC<NodeProps<Node<TaskNodeData>>> = ({ data, selected }) => {
  const { task, thread } = data;
  return (
    <div className={`rf-task-node state-${task.state} ${task.isCritical ? 'is-critical' : ''} ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />

      <div className="rf-task-title">{task.title}</div>

      <div className="rf-task-meta">
        {thread && (
          <span
            className="pill pill-thread"
            style={{
              color: thread.color,
              borderColor: thread.color + '40',
              background: thread.color + '15',
              fontSize: '0.5625rem',
              padding: '1px 5px',
            }}
          >
            {thread.name}
          </span>
        )}
        <span className={`pill pill-state ${task.state}`} style={{ fontSize: '0.5625rem', padding: '1px 5px' }}>
          {task.state === 'ready' ? 'To Do' : task.state}
        </span>
        {task.isCritical && task.state !== 'done' && (
          <span className="pill pill-critical" style={{ fontSize: '0.5625rem', padding: '1px 5px' }}>⚡</span>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
};

const nodeTypes = { taskNode: TaskNode };

// ─── Dagre Layout ───
function getLayoutedElements(
  nodes: Node<TaskNodeData>[],
  edges: Edge[],
  direction = 'LR'
): { nodes: Node<TaskNodeData>[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, edgesep: 30 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 200, height: 70 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const position = g.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - 100, // center
        y: position.y - 35,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ─── Map Page ───
export const MapPage: React.FC = () => {
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []);
  const allDeps = useLiveQuery(() => db.dependencies.toArray(), []);
  const allThreads = useLiveQuery(() => db.threads.toArray(), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TaskNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [filterThread, setFilterThread] = useState<number | 'all'>('all');

  const threadMap = useMemo(() => {
    if (!allThreads) return new Map<number, Thread>();
    return new Map(allThreads.map((t) => [t.id!, t]));
  }, [allThreads]);

  // Build graph when data changes
  useEffect(() => {
    if (!allTasks || !allDeps || !allThreads) return;

    // Filter tasks
    let filteredTasks: Task[];
    if (filterThread === 'all') {
      filteredTasks = allTasks.filter((t) => t.state !== 'floating');
    } else {
      filteredTasks = allTasks.filter((t) => t.threadId === filterThread);
    }

    const taskIds = new Set(filteredTasks.map((t) => t.id!));

    // Filter deps
    const filteredDeps = allDeps.filter(
      (d) => taskIds.has(d.predecessorId) && taskIds.has(d.successorId)
    );

    // Build nodes
    const rfNodes: Node<TaskNodeData>[] = filteredTasks.map((task) => ({
      id: String(task.id),
      type: 'taskNode',
      position: { x: 0, y: 0 },
      data: {
        task,
        thread: task.threadId ? threadMap.get(task.threadId) : undefined,
      },
    }));

    // Build edges
    const rfEdges: Edge[] = filteredDeps.map((dep) => {
      const isNonDefault = dep.type !== 'leads_to';
      return {
        id: `e-${dep.id}`,
        source: String(dep.predecessorId),
        target: String(dep.successorId),
        type: 'smoothstep',
        animated: dep.type === 'completes_with',
        style: {
          strokeDasharray: dep.type === 'starts_with' ? '6 3' : dep.type === 'completes_with' ? '3 3' : undefined,
          stroke: dep.type === 'completes_with' ? 'hsl(250, 50%, 60%)' : dep.type === 'starts_with' ? 'hsl(45, 70%, 50%)' : undefined,
        },
        label: isNonDefault ? RELATIONSHIP_LABELS[dep.type].label : undefined,
        labelStyle: { fontSize: 9, fontWeight: 600, fill: 'var(--text-tertiary)' },
        labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      };
    });

    // Layout with dagre
    if (rfNodes.length > 0) {
      const layouted = getLayoutedElements(rfNodes, rfEdges);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [allTasks, allDeps, allThreads, filterThread, threadMap]);

  if (!allTasks || !allDeps || !allThreads) {
    return <div className="map-placeholder"><p className="page-subtitle">Memuat...</p></div>;
  }

  return (
    <div className="map-container">
      {/* Toolbar */}
      <div className="map-toolbar">
        <span className="map-toolbar-title">Node</span>
        <select
          className="select"
          style={{ width: 'auto', minWidth: '140px', fontSize: 'var(--text-xs)' }}
          value={filterThread === 'all' ? 'all' : filterThread}
          onChange={(e) =>
            setFilterThread(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
        >
          <option value="all">Semua Thread</option>
          {allThreads.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {nodes.length === 0 ? (
        <div className="map-placeholder">
          <p className="page-subtitle">
            {filterThread === 'all'
              ? 'Belum ada task dengan dependency. Semua task masih Floating.'
              : 'Thread ini belum punya task.'}
          </p>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          panOnScroll={true}
          zoomOnScroll={false}
          panOnDrag={true}
          nodesDraggable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node: Node<TaskNodeData>) => {
              const state = node.data?.task?.state;
              if (state === 'ready') return 'hsl(155, 65%, 44%)';
              if (state === 'done') return 'hsl(220, 55%, 58%)';
              if (state === 'locked') return 'hsl(225, 8%, 35%)';
              return 'hsl(225, 15%, 45%)';
            }}
            maskColor="hsla(225, 25%, 8%, 0.8)"
          />
        </ReactFlow>
      )}
    </div>
  );
};
