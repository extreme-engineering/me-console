import { useEffect, useState, useCallback } from 'react';
import { Plus, Target, Trash2, ArrowLeft, Sparkles, Flag, CheckSquare, Repeat } from 'lucide-react';
import type { Goal, Habit, Todo, Vision } from '@meos/shared';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import WorkflowCanvas from '../../components/workflow/WorkflowCanvas';
import { Node, Edge, Connection, NodeChange, EdgeChange } from '@xyflow/react';
import { toast } from '../../stores/toastStore';

interface WorkflowStep {
  id: string;
  workflowId: string;
  entityType: 'vision' | 'goal' | 'keyResult' | 'todo' | 'habit';
  entityId: string;
  label: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

interface WorkflowConnection {
  id: string;
  workflowId: string;
  sourceStepId: string;
  targetStepId: string;
  sourceHandle: string;
  targetHandle: string;
}

interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  connections: WorkflowConnection[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowsResponse {
  workflows?: Workflow[];
}

interface WorkflowDetailResponse {
  workflow?: Workflow;
}

interface ActiveVisionResponse {
  vision?: Vision | null;
}

interface GoalsResponse {
  goals?: Goal[];
}

interface TodosResponse {
  todos?: Todo[];
}

interface HabitsResponse {
  habits?: Habit[];
}

interface ConnectionResponse {
  connection?: { id: string };
}

interface StepResponse {
  step?: WorkflowStep;
}

const entityTypeColors: Record<string, string> = {
  vision: '#8b5cf6',
  goal: '#3b82f6',
  keyResult: '#06b6d4',
  todo: '#22c55e',
  habit: '#f59e0b',
};

const entityTypeLabels: Record<string, string> = {
  vision: '愿景',
  goal: '目标',
  keyResult: '关键结果',
  todo: '待办',
  habit: '习惯',
};

const entityIcons: Record<string, typeof Sparkles> = {
  vision: Sparkles,
  goal: Flag,
  keyResult: Target,
  todo: CheckSquare,
  habit: Repeat,
};

const ENTITY_TYPES = ['vision', 'goal', 'todo', 'habit'] as const;
type EntityType = typeof ENTITY_TYPES[number];

const getNodeStyle = (entityType: string) => ({
  background: entityTypeColors[entityType] || '#6b7280',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: 12,
  minWidth: 120,
});

export default function Workflow() {
  const workflowsQuery = useApiQuery<WorkflowsResponse>(['workflows'], '/workflows');
  const workflows = workflowsQuery.data?.workflows ?? [];
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Entity data for the side panel
  const [activeEntityType, setActiveEntityType] = useState<EntityType>('goal');
  const [showEntityPanel, setShowEntityPanel] = useState(true);
  const entityPanelOpen = !!selectedWorkflow;

  const visionsQuery = useApiQuery<ActiveVisionResponse>(['visions'], '/visions', { enabled: entityPanelOpen && activeEntityType === 'vision' });
  const goalsQuery = useApiQuery<GoalsResponse>(['goals'], '/goals', { enabled: entityPanelOpen && activeEntityType === 'goal' });
  const todosQuery = useApiQuery<TodosResponse>(['todos'], '/todos', { enabled: entityPanelOpen && activeEntityType === 'todo' });
  const habitsQuery = useApiQuery<HabitsResponse>(['habits'], '/habits', { enabled: entityPanelOpen && activeEntityType === 'habit' });
  // 契约：GET /visions 返回当前生效的单条 { vision }（历史走 /visions/history）
  const activeVision = visionsQuery.data?.vision;
  const visions = activeVision ? [activeVision] : [];
  const goals = goalsQuery.data?.goals ?? [];
  const todos = todosQuery.data?.todos ?? [];
  const habits = habitsQuery.data?.habits ?? [];

  const selectedWorkflowId = selectedWorkflow?.id;
  const workflowDetailQuery = useApiQuery<WorkflowDetailResponse>(['workflows', selectedWorkflowId ?? ''], `/workflows/${selectedWorkflowId}`, { enabled: !!selectedWorkflowId });
  const detailWorkflow = workflowDetailQuery.data?.workflow;

  const createWorkflowMutation = useApiMutation((data: Record<string, unknown>) => apiRequest<WorkflowDetailResponse>('post', '/workflows', data), [['workflows']]);
  const deleteWorkflowMutation = useApiMutation((id: string) => apiRequest('delete', `/workflows/${id}`), [['workflows']]);
  const addConnectionMutation = useApiMutation(({ workflowId, data }: { workflowId: string; data: Record<string, unknown> }) => apiRequest<ConnectionResponse>('post', `/workflows/${workflowId}/connections`, data));
  const addStepMutation = useApiMutation(({ workflowId, data }: { workflowId: string; data: Record<string, unknown> }) => apiRequest<StepResponse>('post', `/workflows/${workflowId}/steps`, data));

  useEffect(() => {
    if (selectedWorkflow && detailWorkflow && detailWorkflow.id === selectedWorkflow.id) {
      setSelectedWorkflow(detailWorkflow);
      toNodes(detailWorkflow.steps, detailWorkflow.connections);
    }
  }, [detailWorkflow, selectedWorkflow]);

  const toNodes = (steps: WorkflowStep[], connections: WorkflowConnection[]) => {
    const ns: Node[] = steps.map(s => ({
      id: s.id,
      position: { x: s.positionX, y: s.positionY },
      data: { label: s.label, entityType: s.entityType, entityId: s.entityId },
      style: getNodeStyle(s.entityType),
    }));
    const es: Edge[] = connections.map(c => ({
      id: c.id,
      source: c.sourceStepId,
      target: c.targetStepId,
      sourceHandle: c.sourceHandle,
      targetHandle: c.targetHandle,
    }));
    setNodes(ns);
    setEdges(es);
  };

  const createWorkflow = async () => {
    if (!newName.trim()) return;
    try {
      const res = await createWorkflowMutation.mutateAsync({ name: newName, description: newDesc });
      const wf = res?.workflow;
      if (wf) {
        setSelectedWorkflow(wf);
        setNodes([]);
        setEdges([]);
      }
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm('确定删除此工作流？')) return;
    try {
      await deleteWorkflowMutation.mutateAsync(id);
      if (selectedWorkflow?.id === id) {
        setSelectedWorkflow(null);
        setNodes([]);
        setEdges([]);
      }
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds);
      return updated;
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback(async (connection: Connection) => {
    if (!selectedWorkflow) return;
    try {
      const res = await addConnectionMutation.mutateAsync({
        workflowId: selectedWorkflow.id,
        data: {
          sourceStepId: connection.source,
          targetStepId: connection.target,
          sourceHandle: connection.sourceHandle || 'bottom',
          targetHandle: connection.targetHandle || 'top',
        },
      });
      const conn = res?.connection;
      if (conn) {
        setEdges(eds => addEdge({ ...connection, id: conn.id }, eds));
      }
    } catch {
      toast.error('操作失败，请重试');
    }
  }, [selectedWorkflow, addConnectionMutation]);

  const addNodeToCanvas = async (entityType: EntityType, entity: Vision | Goal | Todo | Habit, label: string) => {
    if (!selectedWorkflow) return;
    const id = 'id' in entity ? entity.id : '';
    const stepData = {
      entityType,
      entityId: id,
      label,
      positionX: Math.random() * 400 + 100,
      positionY: Math.random() * 300 + 100,
    };
    try {
      const res = await addStepMutation.mutateAsync({ workflowId: selectedWorkflow.id, data: stepData });
      const step = res?.step;
      if (step) {
        const newNode: Node = {
          id: step.id,
          position: { x: step.positionX, y: step.positionY },
          data: { label: step.label, entityType: step.entityType, entityId: step.entityId },
          style: getNodeStyle(entityType),
        };
        setNodes((nds) => [...nds, newNode]);
      }
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  if (workflowsQuery.isLoading) {
    return <div className="p-8 text-center">加载中...</div>;
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 bg-[var(--color-surface)] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">工作流</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="p-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {workflows.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">暂无工作流</p>
          ) : (
            <div className="space-y-1">
              {workflows.map(w => (
                <div
                  key={w.id}
                  onClick={() => setSelectedWorkflow(w)}
                  className={`p-3 rounded-lg cursor-pointer group ${
                    selectedWorkflow?.id === w.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800 text-sm">{w.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteWorkflow(w.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{w.steps?.length || 0} 步骤</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Entity Panel */}
      {selectedWorkflow && showEntityPanel && (
        <div className="w-56 border-r border-gray-200 bg-[var(--color-surface)] flex flex-col">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">添加节点</span>
            <button
              onClick={() => setShowEntityPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div className="flex gap-1 p-2 border-b border-gray-100">
            {ENTITY_TYPES.map(type => {
              const Icon = entityIcons[type];
              return (
                <button
                  key={type}
                  onClick={() => setActiveEntityType(type)}
                  className={`p-1.5 rounded ${activeEntityType === type ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                  title={entityTypeLabels[type]}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {activeEntityType === 'vision' && visions.map(v => (
              <div
                key={v.id}
                onClick={() => addNodeToCanvas('vision', v, v.content.slice(0, 20))}
                className="p-2 mb-1 text-xs bg-purple-50 text-purple-700 rounded cursor-pointer hover:bg-purple-100 truncate"
              >
                {v.content.slice(0, 20)}
              </div>
            ))}
            {activeEntityType === 'goal' && goals.map(g => (
              <div
                key={g.id}
                onClick={() => addNodeToCanvas('goal', g, g.title)}
                className="p-2 mb-1 text-xs bg-blue-50 text-blue-700 rounded cursor-pointer hover:bg-blue-100 truncate"
              >
                {g.title}
              </div>
            ))}
            {activeEntityType === 'todo' && todos.map(t => (
              <div
                key={t.id}
                onClick={() => addNodeToCanvas('todo', t, t.title)}
                className="p-2 mb-1 text-xs bg-green-50 text-green-700 rounded cursor-pointer hover:bg-green-100 truncate"
              >
                {t.title}
              </div>
            ))}
            {activeEntityType === 'habit' && habits.map(h => (
              <div
                key={h.id}
                onClick={() => addNodeToCanvas('habit', h, h.title)}
                className="p-2 mb-1 text-xs bg-amber-50 text-amber-700 rounded cursor-pointer hover:bg-amber-100 truncate"
              >
                {h.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {selectedWorkflow ? (
          <>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-[var(--color-surface)]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setSelectedWorkflow(null); setNodes([]); setEdges([]); }}
                  className="p-1.5 hover:bg-gray-100 rounded-md"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="font-semibold text-gray-800">{selectedWorkflow.name}</h2>
                {selectedWorkflow.description && (
                  <span className="text-sm text-gray-500">— {selectedWorkflow.description}</span>
                )}
              </div>
              <div className="flex gap-2">
                {Object.entries(entityTypeLabels).map(([type, label]) => (
                  <span
                    key={type}
                    className="text-xs px-2 py-1 rounded-full text-white"
                    style={{ background: entityTypeColors[type] }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <WorkflowCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>选择一个工作流或创建新的工作流</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">创建工作流</h3>
            <input
              type="text"
              placeholder="工作流名称"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <textarea
              placeholder="描述（可选）"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={createWorkflow}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function applyNodeChanges(changes: NodeChange<Node>[], nodes: Node[]): Node[] {
  return changes.reduce<Node[]>((acc, change) => {
    if (change.type === 'position' && change.position) {
      const position = change.position;
      return acc.map((n) => (n.id === change.id ? { ...n, position } : n));
    }
    if (change.type === 'remove') {
      return acc.filter((n) => n.id !== change.id);
    }
    return acc;
  }, nodes);
}

function applyEdgeChanges(_changes: EdgeChange<Edge>[], edges: Edge[]): Edge[] {
  return edges;
}

function addEdge(edge: Edge, edges: Edge[]): Edge[] {
  return [...edges, edge];
}