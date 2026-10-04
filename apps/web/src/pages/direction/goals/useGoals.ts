import type { Domain, Goal } from '@meos/shared';
import { apiRequest, useApiMutation, useApiQuery } from '../../../lib/api-queries';

interface GoalsResponse {
  goals: Goal[];
}

interface DomainsResponse {
  domains: Domain[];
}

export function useGoalsQuery() {
  return useApiQuery<GoalsResponse>(['goals'], '/goals');
}

export function useDomainsQuery() {
  return useApiQuery<DomainsResponse>(['domains'], '/domains');
}

export function useCreateGoal() {
  return useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/goals', data), [['goals']]);
}

export function useUpdateGoal() {
  return useApiMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/goals/${id}`, data),
    [['goals']]
  );
}

export function useDeleteGoal() {
  return useApiMutation((id: string) => apiRequest('delete', `/goals/${id}`), [['goals']]);
}

export function useAddKeyResult() {
  return useApiMutation(
    ({ goalId, data }: { goalId: string; data: Record<string, unknown> }) =>
      apiRequest('post', `/goals/${goalId}/key-results`, data),
    [['goals']]
  );
}

export function useUpdateKeyResult() {
  return useApiMutation(
    ({ goalId, krId, data }: { goalId: string; krId: string; data: Record<string, unknown> }) =>
      apiRequest('patch', `/goals/${goalId}/key-results/${krId}`, data),
    [['goals']]
  );
}

export function useDeleteKeyResult() {
  return useApiMutation(
    ({ goalId, krId }: { goalId: string; krId: string }) =>
      apiRequest('delete', `/goals/${goalId}/key-results/${krId}`),
    [['goals']]
  );
}

export function getProgress(goal: Goal): number {
  if (!goal.keyResults || goal.keyResults.length === 0) return 0;
  const total = goal.keyResults.reduce((sum, kr) => {
    const pct = kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0;
    return sum + Math.min(pct, 100);
  }, 0);
  return Math.round(total / goal.keyResults.length);
}

export function formatDate(dateStr?: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
