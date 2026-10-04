import { describe, expect, it } from 'vitest';
import { toggleTaskAtLine } from './okrDoc';

describe('toggleTaskAtLine', () => {
  it('勾选未完成项，其余行原样保留', () => {
    expect(toggleTaskAtLine('- [ ] a\n- [ ] b', 1)).toBe('- [x] a\n- [ ] b');
  });

  it('取消已完成项（含大写 X）', () => {
    expect(toggleTaskAtLine('- [x] a', 1)).toBe('- [ ] a');
    expect(toggleTaskAtLine('- [X] a', 1)).toBe('- [ ] a');
  });

  it('支持嵌套缩进、* / + 与有序列表', () => {
    expect(toggleTaskAtLine('  - [ ] nest', 1)).toBe('  - [x] nest');
    expect(toggleTaskAtLine('\t* [ ] star', 1)).toBe('\t* [x] star');
    expect(toggleTaskAtLine('+ [x] plus', 1)).toBe('+ [ ] plus');
    expect(toggleTaskAtLine('1. [ ] ordered', 1)).toBe('1. [x] ordered');
    expect(toggleTaskAtLine('12) [ ] ordered', 1)).toBe('12) [x] ordered');
  });

  it('非任务行返回 null', () => {
    expect(toggleTaskAtLine('# 标题', 1)).toBeNull();
    expect(toggleTaskAtLine('- 普通列表项', 1)).toBeNull();
    expect(toggleTaskAtLine('| KR | 判定 |', 1)).toBeNull();
    expect(toggleTaskAtLine('文本 - [ ] 不在行首', 1)).toBeNull();
  });

  it('越界与非法行号返回 null', () => {
    const md = '- [ ] a';
    expect(toggleTaskAtLine(md, 0)).toBeNull();
    expect(toggleTaskAtLine(md, -1)).toBeNull();
    expect(toggleTaskAtLine(md, 2)).toBeNull();
    expect(toggleTaskAtLine(md, 1.5)).toBeNull();
    expect(toggleTaskAtLine(md, Number.NaN)).toBeNull();
  });

  it('保留 CRLF 行尾', () => {
    expect(toggleTaskAtLine('- [ ] a\r\n- [ ] b', 1)).toBe('- [x] a\r\n- [ ] b');
  });
});