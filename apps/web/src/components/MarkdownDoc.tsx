import { createContext, useContext, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components, ExtraProps } from 'react-markdown';

type HastElement = NonNullable<ExtraProps['node']>;

// react-markdown 给自定义组件透传 hast node；task item 的 li 上保留
// position（mdast-util-to-hast 的 state.patch），可借它定位源码行
const TaskToggleContext = createContext<((line: number) => void) | null>(null);
const TaskLineContext = createContext<{ line: number; checked: boolean } | null>(null);

function findTaskChecked(node: HastElement): boolean {
  for (const child of node.children ?? []) {
    if (child.type !== 'element') continue;
    if (child.tagName === 'input' && child.properties?.type === 'checkbox') {
      return child.properties.checked === true;
    }
    if (findTaskChecked(child)) return true;
  }
  return false;
}

function TaskListItem(props: ComponentProps<'li'> & ExtraProps) {
  const { node, children, ...rest } = props;
  const className = node?.properties?.className;
  const isTaskItem = Array.isArray(className) && className.includes('task-list-item');
  const line = node?.position?.start.line;
  if (!node || !isTaskItem || typeof line !== 'number') {
    return <li {...rest}>{children}</li>;
  }
  return (
    <TaskLineContext.Provider value={{ line, checked: findTaskChecked(node) }}>
      <li {...rest}>{children}</li>
    </TaskLineContext.Provider>
  );
}

function TaskCheckboxInput(props: ComponentProps<'input'> & ExtraProps) {
  // node 不能透传给 DOM，剥掉后再展开
  const rest = { ...props };
  delete rest.node;
  const task = useContext(TaskLineContext);
  const onToggleTask = useContext(TaskToggleContext);
  if (task && onToggleTask) {
    return (
      <input
        {...rest}
        disabled={false}
        checked={task.checked}
        onChange={() => onToggleTask(task.line)}
      />
    );
  }
  return <input {...rest} />;
}

const COMPONENTS: Components = { li: TaskListItem, input: TaskCheckboxInput };

export default function MarkdownDoc({
  md,
  className,
  onToggleTask,
}: {
  md: string;
  className?: string;
  /** 传入后 GFM 任务列表的复选框可点击，回调参数为源码行号（1-based） */
  onToggleTask?: (line: number) => void;
}) {
  return (
    <div className={`md-doc ${className ?? ''}`}>
      <TaskToggleContext.Provider value={onToggleTask ?? null}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
          {md}
        </ReactMarkdown>
      </TaskToggleContext.Provider>
    </div>
  );
}