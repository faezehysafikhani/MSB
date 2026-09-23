import { getCurrentJalaliDate } from '../utils/date';
import { Task, ApiResponse, ApiFilterParams, PagedResult, User, Attachment, ResolutionProgressReport } from '../types';
import { mockTasks } from '../mock/data';
import { apiClient } from './api/apiClient';
import { resolutionService } from './resolutionService';
import { loadLocalCollection, saveLocalCollection } from './localStore';

export interface ITaskService {
  getMyTasks(userId?: string, params?: ApiFilterParams): Promise<ApiResponse<PagedResult<Task>>>;
  getTaskById(id: string): Promise<ApiResponse<Task | null>>;
  submitTaskCompletion(taskId: string, completionNotes: string, attachments?: Task['attachments']): Promise<ApiResponse<Task>>;
  updateTaskStatus(taskId: string, status: Task['status']): Promise<ApiResponse<Task>>;
  submitProgressReport(taskId: string, dto: { progressPercent: number; status: ResolutionProgressReport['status']; actionDescription: string; obstacles?: string; attachments?: Attachment[] }, actor: User): Promise<ApiResponse<Task>>;
}

class MockTaskService implements ITaskService {
  private getTasksData = () => loadLocalCollection('tasks', mockTasks);

  public async getMyTasks(userId?: string, params?: ApiFilterParams): Promise<ApiResponse<PagedResult<Task>>> {
    let filtered = this.getTasksData();

    // A personal cartable always contains only tasks assigned to the active user.
    if (userId) {
      filtered = filtered.filter((t) => t.assignedToUserId === userId);
    }

    if (params?.searchTerm) {
      const term = params.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.resolutionTitle.toLowerCase().includes(term) ||
          t.resolutionNumber.toLowerCase().includes(term) ||
          t.meetingTitle.toLowerCase().includes(term) ||
          t.assignedToName.toLowerCase().includes(term)
      );
    }

    if (params?.status && params.status !== 'ALL') {
      filtered = filtered.filter((t) => t.status === params.status);
    }

    if (params?.priority && params.priority !== 'ALL') {
      filtered = filtered.filter((t) => t.priority === params.priority);
    }

    const pageIndex = params?.pageIndex || 1;
    const pageSize = params?.pageSize || 10;
    const totalCount = filtered.length;
    const startIndex = (pageIndex - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return apiClient.simulateNetwork<PagedResult<Task>>({
      items,
      totalCount,
      pageIndex,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    }, 120);
  }

  public async getTaskById(id: string): Promise<ApiResponse<Task | null>> {
    const task = this.getTasksData().find((t) => t.id === id) || null;
    return apiClient.simulateNetwork(task, 100);
  }

  public async submitTaskCompletion(taskId: string, completionNotes: string, attachments?: Task['attachments']): Promise<ApiResponse<Task>> {
    const tasks = this.getTasksData();
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) throw new Error('وظیفه یافت نشد');

    const task = tasks[taskIndex];
    task.completionNotes = completionNotes;
    task.completionDateJalali = getCurrentJalaliDate();
    if (attachments) {
      task.attachments = [...task.attachments, ...attachments];
    }

    // Call resolution service to advance workflow and determine whether it enters verification or closes directly
    await resolutionService.completeResolutionTask(task.resolutionId, completionNotes, attachments);

    // Refresh task status based on whether verification was required
    task.status = task.requiresVerification ? 'PENDING_APPROVAL' : 'CLOSED';
    if (!task.requiresVerification) task.progressPercent = 100;
    saveLocalCollection('tasks', tasks);

    return apiClient.simulateNetwork(task, 200);
  }

  public async updateTaskStatus(taskId: string, status: Task['status']): Promise<ApiResponse<Task>> {
    const tasks = this.getTasksData();
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) throw new Error('وظیفه یافت نشد');

    tasks[taskIndex].status = status;
    saveLocalCollection('tasks', tasks);
    return apiClient.simulateNetwork(tasks[taskIndex], 120);
  }

  public async submitProgressReport(taskId: string, dto: { progressPercent: number; status: ResolutionProgressReport['status']; actionDescription: string; obstacles?: string; attachments?: Attachment[] }, actor: User): Promise<ApiResponse<Task>> {
    const tasks = this.getTasksData();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error('وظیفه یافت نشد');
    if (task.assignedToUserId !== actor.id && actor.role !== 'ADMIN') throw new Error('فقط مسئول اجرای این مصوبه می‌تواند گزارش پیشرفت ثبت کند');
    if (!['NEW', 'IN_PROGRESS', 'WAITING_RESPONSE', 'NEEDS_FOLLOW_UP', 'RETURNED', 'OVERDUE'].includes(task.status)) throw new Error('وضعیت فعلی وظیفه امکان ثبت گزارش پیشرفت ندارد');
    if (!Number.isFinite(dto.progressPercent) || dto.progressPercent < 0 || dto.progressPercent > 100) throw new Error('درصد پیشرفت باید بین صفر تا صد باشد');
    if (!dto.actionDescription.trim()) throw new Error('شرح آخرین اقدام الزامی است');
    const now = new Date();
    const reportDateJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replace(/[\u200e\u200f]/g, '');
    const report: ResolutionProgressReport = {
      id: `progress-${Date.now()}`,
      taskId: task.id,
      resolutionId: task.resolutionId,
      reporterUserId: actor.id,
      reporterName: actor.fullName,
      progressPercent: dto.progressPercent,
      status: dto.status,
      actionDescription: dto.actionDescription.trim(),
      obstacles: dto.obstacles?.trim(),
      reportDateJalali,
      reportTimeString: now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      attachments: dto.attachments || [],
    };
    await resolutionService.updateExecutionProgress(task.resolutionId, report);
    task.executionStartDateJalali = task.executionStartDateJalali || reportDateJalali;
    task.progressPercent = report.progressPercent;
    task.lastAction = report.actionDescription;
    task.obstacles = report.obstacles;
    task.progressReports = [...(task.progressReports || []), report];
    task.status = report.status;
    if (report.attachments.length > 0) task.attachments = [...task.attachments, ...report.attachments];
    saveLocalCollection('tasks', tasks);
    return apiClient.simulateNetwork(task, 160);
  }
}

export const taskService: ITaskService = new MockTaskService();
