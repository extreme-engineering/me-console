import { useMutation, useQuery, useQueryClient, type QueryKey, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import api from './api';

// 约定：列表 key 为 [entity] 或 [entity, ...筛选参数]，详情 key 为 [entity, id]；
// 变更后按 entity 整组失效即可覆盖列表与详情。

type Method = 'get' | 'post' | 'patch' | 'delete';

export async function apiRequest<T = unknown>(method: Method, url: string, data?: unknown): Promise<T> {
  if (method === 'get' || method === 'delete') {
    const res = await api[method](url);
    return res.data as T;
  }
  const res = await api[method](url, data);
  return res.data as T;
}

export function useApiQuery<T = unknown>(
  key: QueryKey,
  url: string,
  options?: Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: () => apiRequest<T>('get', url),
    ...options,
  });
}

export function useApiMutation<TData = unknown, TVars = void>(
  mutationFn: (vars: TVars) => Promise<TData>,
  invalidate: QueryKey[] = [],
  options?: Omit<UseMutationOptions<TData, Error, TVars>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVars>({
    ...options,
    mutationFn,
    onSuccess: (...args) => {
      for (const key of invalidate) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      options?.onSuccess?.(...args);
    },
  });
}
