import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Activity,
  Deal,
  DealDetail,
  DealDocument,
  DealFilters,
  FunnelStep,
  Milestone,
  Page,
  Stage,
  StageBucket,
  StageHistory,
  Summary,
  Task,
  TaskWithDeal,
  TeamMember,
  Trends,
  User,
} from '../types'
import { api } from './client'

/** Anything that changes a deal can move a dashboard number, so refetch broadly. */
function useInvalidateDealData() {
  const queryClient = useQueryClient()
  return (dealId?: number) => {
    queryClient.invalidateQueries({ queryKey: ['deals'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    if (dealId) queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
  }
}

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') })
}

export function useStages() {
  return useQuery({ queryKey: ['stages'], queryFn: () => api.get<Stage[]>('/stages') })
}

export function useMarkets() {
  return useQuery({ queryKey: ['markets'], queryFn: () => api.get<string[]>('/deals/markets') })
}

export function useDeals(filters: DealFilters) {
  return useQuery({
    queryKey: ['deals', filters],
    queryFn: () => api.get<Page<Deal>>('/deals', filters as Record<string, unknown>),
    placeholderData: (previous) => previous,
  })
}

export function useDeal(dealId: number | undefined) {
  return useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => api.get<DealDetail>(`/deals/${dealId}`),
    enabled: dealId !== undefined,
  })
}

export function useDealHistory(dealId: number | undefined) {
  return useQuery({
    queryKey: ['deal', dealId, 'history'],
    queryFn: () => api.get<StageHistory[]>(`/deals/${dealId}/history`),
    enabled: dealId !== undefined,
  })
}

export function useCreateDeal() {
  const invalidate = useInvalidateDealData()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<DealDetail>('/deals', body),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateDeal(dealId: number) {
  const invalidate = useInvalidateDealData()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch<DealDetail>(`/deals/${dealId}`, body),
    onSuccess: () => invalidate(dealId),
  })
}

export function useDeleteDeal() {
  const invalidate = useInvalidateDealData()
  return useMutation({
    mutationFn: (dealId: number) => api.delete<void>(`/deals/${dealId}`),
    onSuccess: () => invalidate(),
  })
}

export function useMoveStage() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDealData()
  return useMutation({
    mutationFn: ({ dealId, stageId, note }: { dealId: number; stageId: number; note?: string }) =>
      api.post<DealDetail>(`/deals/${dealId}/stage`, { stage_id: stageId, note }),
    // Move the card the moment it is dropped; roll back if the server disagrees.
    onMutate: async ({ dealId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: ['deals'] })
      const snapshots = queryClient.getQueriesData<Page<Deal>>({ queryKey: ['deals'] })
      const stages = queryClient.getQueryData<Stage[]>(['stages'])
      const target = stages?.find((s) => s.id === stageId)
      if (target) {
        for (const [key, page] of snapshots) {
          if (!page) continue
          queryClient.setQueryData<Page<Deal>>(key, {
            ...page,
            items: page.items.map((deal) =>
              deal.id === dealId
                ? { ...deal, stage_id: stageId, stage: target, days_in_stage: 0 }
                : deal,
            ),
          })
        }
      }
      return { snapshots }
    },
    onError: (_error, _variables, context) => {
      context?.snapshots.forEach(([key, page]) => queryClient.setQueryData(key, page))
    },
    onSettled: (_data, _error, variables) => invalidate(variables.dealId),
  })
}

export function useDealTasks(dealId: number | undefined) {
  return useQuery({
    queryKey: ['deal', dealId, 'tasks'],
    queryFn: () => api.get<Task[]>(`/deals/${dealId}/tasks`),
    enabled: dealId !== undefined,
  })
}

export function useAllTasks(params: { assignee_id?: number; overdue?: boolean } = {}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.get<TaskWithDeal[]>('/tasks', params),
  })
}

export function useCreateTask(dealId: number) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDealData()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Task>(`/deals/${dealId}/tasks`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'activities'] })
      invalidate(dealId)
    },
  })
}

export function useUpdateTask(dealId: number) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDealData()
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: number; body: Record<string, unknown> }) =>
      api.patch<Task>(`/tasks/${taskId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'activities'] })
      invalidate(dealId)
    },
  })
}

export function useDeleteTask(dealId: number) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDealData()
  return useMutation({
    mutationFn: (taskId: number) => api.delete<void>(`/tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'tasks'] })
      invalidate(dealId)
    },
  })
}

export function useMilestones(dealId: number | undefined) {
  return useQuery({
    queryKey: ['deal', dealId, 'milestones'],
    queryFn: () => api.get<Milestone[]>(`/deals/${dealId}/milestones`),
    enabled: dealId !== undefined,
  })
}

export function useCreateMilestone(dealId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<Milestone>(`/deals/${dealId}/milestones`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'milestones'] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'activities'] })
    },
  })
}

export function useUpdateMilestone(dealId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ milestoneId, body }: { milestoneId: number; body: Record<string, unknown> }) =>
      api.patch<Milestone>(`/milestones/${milestoneId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'milestones'] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'activities'] })
    },
  })
}

export function useDocuments(dealId: number | undefined) {
  return useQuery({
    queryKey: ['deal', dealId, 'documents'],
    queryFn: () => api.get<DealDocument[]>(`/deals/${dealId}/documents`),
    enabled: dealId !== undefined,
  })
}

export function useCreateDocument(dealId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<DealDocument>(`/deals/${dealId}/documents`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'documents'] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'activities'] })
    },
  })
}

export function useDeleteDocument(dealId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: number) => api.delete<void>(`/documents/${documentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'documents'] }),
  })
}

export function useActivities(dealId: number | undefined) {
  return useQuery({
    queryKey: ['deal', dealId, 'activities'],
    queryFn: () => api.get<Activity[]>(`/deals/${dealId}/activities`),
    enabled: dealId !== undefined,
  })
}

export function useAddNote(dealId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => api.post<Activity>(`/deals/${dealId}/notes`, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'activities'] }),
  })
}

export function useTeam(dealId: number | undefined) {
  return useQuery({
    queryKey: ['deal', dealId, 'team'],
    queryFn: () => api.get<TeamMember[]>(`/deals/${dealId}/team`),
    enabled: dealId !== undefined,
  })
}

export function useAddTeamMember(dealId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { user_id: number; role: string }) =>
      api.post<TeamMember>(`/deals/${dealId}/team`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'team'] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
    },
  })
}

export function useRemoveTeamMember(dealId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memberId: number) => api.delete<void>(`/team/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId, 'team'] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
    },
  })
}

export function useSummary() {
  return useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => api.get<Summary>('/analytics/summary'),
  })
}

export function useStageBuckets() {
  return useQuery({
    queryKey: ['analytics', 'by-stage'],
    queryFn: () => api.get<StageBucket[]>('/analytics/by-stage'),
  })
}

export function useFunnel() {
  return useQuery({
    queryKey: ['analytics', 'funnel'],
    queryFn: () => api.get<FunnelStep[]>('/analytics/funnel'),
  })
}

export function useTrends(months = 12) {
  return useQuery({
    queryKey: ['analytics', 'trends', months],
    queryFn: () => api.get<Trends>('/analytics/trends', { months }),
  })
}

export function useCreateStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Stage>('/stages', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stages'] }),
  })
}

export function useUpdateStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stageId, body }: { stageId: number; body: Record<string, unknown> }) =>
      api.patch<Stage>(`/stages/${stageId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useReorderStages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stageIds: number[]) => api.post<Stage[]>('/stages/reorder', { stage_ids: stageIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useDeleteStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stageId: number) => api.delete<void>(`/stages/${stageId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stages'] }),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; email: string; title?: string }) =>
      api.post<User>('/users', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}
