import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarkdownDoc from './MarkdownDoc';

const MD = '# 标题\n\n- [ ] 第一项\n- [x] 第二项\n';

describe('MarkdownDoc 任务勾选', () => {
  it('传入 onToggleTask 时复选框可点，回调收到源码行号（1-based）', () => {
    const onToggleTask = vi.fn();
    render(<MarkdownDoc md={MD} onToggleTask={onToggleTask} />);

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toBeEnabled();
    expect(boxes[0]).not.toBeChecked();
    expect(boxes[1]).toBeChecked();

    fireEvent.click(boxes[0]);
    expect(onToggleTask).toHaveBeenCalledTimes(1);
    expect(onToggleTask).toHaveBeenCalledWith(3);
  });

  it('未传 onToggleTask 时保持只读（disabled）', () => {
    render(<MarkdownDoc md={MD} />);
    expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();
  });

  it('嵌套任务列表也能定位到各自源码行', () => {
    const onToggleTask = vi.fn();
    const nested = '- [ ] 父项\n  - [ ] 子项\n';
    render(<MarkdownDoc md={nested} onToggleTask={onToggleTask} />);

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    fireEvent.click(boxes[1]);
    expect(onToggleTask).toHaveBeenCalledWith(2);
  });
});