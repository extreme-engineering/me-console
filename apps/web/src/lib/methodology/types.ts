export interface MethodologyEntry {
  title: string;
  philosophy: string;
  principles: string[];
  background?: string;
  guide?: string[];
  pitfalls?: { trap: string; remedy: string }[];
  notes?: string[];
  practice?: string;
}

export type MethodologyMap = Record<string, MethodologyEntry>;
