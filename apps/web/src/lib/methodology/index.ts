import type { MethodologyMap } from './types';
import { direction } from './direction';
import { action } from './action';
import { cognition } from './cognition';
import { reflection } from './reflection';
import { resources } from './resources';
import { brand } from './brand';
import { opportunity } from './opportunity';
import { melog } from './melog';

export type { MethodologyEntry } from './types';

export const METHODOLOGY: MethodologyMap = {
  ...direction,
  ...action,
  ...cognition,
  ...reflection,
  ...resources,
  ...brand,
  ...opportunity,
  ...melog,
};
