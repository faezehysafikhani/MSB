import { User, Department, Organization, ApiResponse, AppNotification } from '../types';
import { mockUsers, mockDepartments, mockOrganizations, mockNotifications } from '../mock/data';
import { apiClient } from './api/apiClient';
import { loadLocalCollection, saveLocalCollection } from './localStore';

/**
 * Managing a user's signature IMAGE is an administrative action, never a
 * self-service one: a normal user cannot upload or replace a signature —
 * their own included — no matter what the client sends. This is the single
 * gate every signature write goes through.
 */
export const canManageUserSignatures = (actor?: User): boolean =>
  Boolean(actor && (actor.role === 'ADMIN' || (actor.permissions || []).includes('MANAGE_USER_SIGNATURES')));

export interface IUserService {
  getUsers(): Promise<ApiResponse<User[]>>;
  getUserById(id: string): Promise<ApiResponse<User | null>>;
  createUser(dto: Omit<User, 'id'>): Promise<ApiResponse<User>>;
  updateUser(id: string, dto: Omit<User, 'id'>, actor?: User): Promise<ApiResponse<User>>;
  // The one write path for a signature image; always bound to a real user id.
  updateUserSignature(userId: string, signatureUrl: string | undefined, actor: User): Promise<ApiResponse<User>>;
  deleteUser(id: string): Promise<ApiResponse<boolean>>;
  getDepartments(): Promise<ApiResponse<Department[]>>;
  getOrganizations(): Promise<ApiResponse<Organization[]>>;
  getNotifications(userId?: string): Promise<ApiResponse<AppNotification[]>>;
  markNotificationAsRead(id: string): Promise<ApiResponse<boolean>>;
}

class MockUserService implements IUserService {
  private users: User[] = loadLocalCollection('users', mockUsers);
  private departments: Department[] = mockDepartments;
  private organizations: Organization[] = mockOrganizations;
  private notifications: AppNotification[] = loadLocalCollection('notifications', mockNotifications);

  public async getUsers(): Promise<ApiResponse<User[]>> {
    return apiClient.simulateNetwork(this.users, 100);
  }

  public async getUserById(id: string): Promise<ApiResponse<User | null>> {
    const user = this.users.find((u) => u.id === id) || null;
    return apiClient.simulateNetwork(user, 80);
  }

  public async createUser(dto: Omit<User, 'id'>): Promise<ApiResponse<User>> {
    const newUser: User = {
      id: `user-${Date.now()}`,
      ...dto,
    };
    this.users.unshift(newUser);
    saveLocalCollection('users', this.users);
    return apiClient.simulateNetwork(newUser, 100);
  }

  public async updateUser(id: string, dto: Omit<User, 'id'>, actor?: User): Promise<ApiResponse<User>> {
    const index = this.users.findIndex((user) => user.id === id);
    if (index === -1) throw new Error('کاربر یافت نشد');

    // A general user edit must never become a back door for changing a
    // signature image: if this save would alter it, it needs the signature
    // permission, whoever the target user is.
    const existingSignature = this.users[index].signatureUrl;
    const nextSignature = dto.signatureUrl;
    if (existingSignature !== nextSignature && !canManageUserSignatures(actor)) {
      throw new Error('تغییر تصویر امضا فقط توسط مدیر سیستم امکان‌پذیر است.');
    }

    this.users[index] = { id, ...dto };
    saveLocalCollection('users', this.users);
    return apiClient.simulateNetwork(this.users[index], 100);
  }

  public async updateUserSignature(userId: string, signatureUrl: string | undefined, actor: User): Promise<ApiResponse<User>> {
    if (!canManageUserSignatures(actor)) throw new Error('شما مجاز به مدیریت تصویر امضای کاربران نیستید.');
    if (!userId) throw new Error('امضا باید به یک کاربر مشخص متصل باشد.');
    const user = this.users.find((item) => item.id === userId);
    if (!user) throw new Error('کاربر یافت نشد');
    user.signatureUrl = signatureUrl?.trim() || undefined;
    saveLocalCollection('users', this.users);
    return apiClient.simulateNetwork(user, 100);
  }

  public async deleteUser(id: string): Promise<ApiResponse<boolean>> {
    const user = this.users.find((item) => item.id === id);
    if (!user) return apiClient.simulateNetwork(false, 100);
    user.isActive = false;
    user.archivedAt = new Date().toISOString();
    saveLocalCollection('users', this.users);
    return apiClient.simulateNetwork(true, 100);
  }

  public async getDepartments(): Promise<ApiResponse<Department[]>> {
    return apiClient.simulateNetwork(this.departments, 80);
  }

  public async getOrganizations(): Promise<ApiResponse<Organization[]>> {
    return apiClient.simulateNetwork(this.organizations, 80);
  }

  public async getNotifications(userId?: string): Promise<ApiResponse<AppNotification[]>> {
    return apiClient.simulateNetwork(this.notifications, 80);
  }

  public async markNotificationAsRead(id: string): Promise<ApiResponse<boolean>> {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) notif.isRead = true;
    saveLocalCollection('notifications', this.notifications);
    return apiClient.simulateNetwork(true, 50);
  }
}

export const userService: IUserService = new MockUserService();
