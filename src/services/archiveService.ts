/**
 * Folder-based archive for پیشنهاد مصوبات (proposals).
 *
 * Entirely separate from the CEO's "بایگانی" (CLOSED status) action in
 * proposalService — a folder here only groups *references* to existing
 * Proposal records for easier retrieval. It never reads or changes a
 * proposal's status/workflow.
 *
 * Two independent scopes, matching two different audiences:
 *  - PERSONAL: one per organizational department. Any user in that
 *    department can create folders and file their own department's
 *    proposals into them — no special permission required.
 *  - ORGANIZATION: a single shared, org-wide archive. Viewing it requires
 *    VIEW_ORGANIZATION_ARCHIVE; creating/deleting folders in it additionally
 *    requires MANAGE_ARCHIVE_FOLDERS. Each organizational folder can further
 *    restrict itself to named users and/or organizational positions.
 *
 * Resolutions are archived through the same infrastructure (no parallel
 * system): a personal archive entry is owned by one user and carries no
 * folder, an organizational entry is filed into a folder. Archiving only ever
 * sets the resolution's archive state — the entity is never deleted, and
 * restoring puts its pre-archive working status back.
 */
import { ArchiveFolder, ArchiveFolderAccess, ArchiveItem, ApiResponse, Resolution, User } from '../types';
import { apiClient } from './api/apiClient';
import { loadLocalValue, saveLocalValue } from './localStore';
import { mockArchiveFolders, mockArchiveItems } from '../mock/data';
import { resolutionService } from './resolutionService';

const FOLDERS_KEY = 'archiveFolders';
const ITEMS_KEY = 'archiveItems';

const getFoldersData = (): ArchiveFolder[] => loadLocalValue<ArchiveFolder[]>(FOLDERS_KEY, mockArchiveFolders);
const saveFoldersData = (folders: ArchiveFolder[]) => saveLocalValue(FOLDERS_KEY, folders);
const getItemsData = (): ArchiveItem[] => loadLocalValue<ArchiveItem[]>(ITEMS_KEY, mockArchiveItems);
const saveItemsData = (items: ArchiveItem[]) => saveLocalValue(ITEMS_KEY, items);

export interface CreateFolderDto {
  name: string;
  description?: string;
  scope: 'PERSONAL' | 'ORGANIZATION';
  ownerDepartmentId?: string;
  access?: ArchiveFolderAccess;
}

export interface IArchiveService {
  getFolders(scope: 'PERSONAL' | 'ORGANIZATION', actor: User, ownerDepartmentId?: string): Promise<ApiResponse<ArchiveFolder[]>>;
  createFolder(dto: CreateFolderDto, actor: User): Promise<ApiResponse<ArchiveFolder>>;
  deleteFolder(id: string, actor: User): Promise<ApiResponse<void>>;
  getItems(folderId: string, actor: User): Promise<ApiResponse<ArchiveItem[]>>;
  archiveProposal(folderId: string, proposalId: string, proposalTitle: string, actor: User): Promise<ApiResponse<ArchiveItem>>;
  removeItem(itemId: string): Promise<ApiResponse<void>>;
  getArchivedProposalIds(): Promise<ApiResponse<Set<string>>>;
  // Resolution archive — «حذف از بایگانی» is restoreResolution, never a delete.
  archiveResolution(resolution: Resolution, scope: 'PERSONAL' | 'ORGANIZATION', actor: User, folderId?: string): Promise<ApiResponse<ArchiveItem>>;
  restoreResolution(resolutionId: string, actor: User): Promise<ApiResponse<void>>;
  getPersonalResolutionItems(actor: User): Promise<ApiResponse<ArchiveItem[]>>;
  getFolderResolutionItems(folderId: string, actor: User): Promise<ApiResponse<ArchiveItem[]>>;
}

/**
 * Whether `user` may open `folder` — the single rule every listing and every
 * service call goes through, so the UI can never be more permissive than the
 * service layer.
 *
 * A folder's own access rules ARE the grant: naming a person or a position on
 * an organizational folder lets exactly those people in, whether or not they
 * hold the blanket organization-archive permission. A folder with no rules
 * falls back to that blanket permission, which is how every folder created
 * before access rules existed keeps behaving.
 */
export const canAccessFolder = (folder: ArchiveFolder, user: User): boolean => {
  if (user.role === 'ADMIN') return true;
  if (folder.createdByUserId === user.id) return true;

  const access = folder.access;
  const hasRules = Boolean(access && (access.userIds.length > 0 || access.positions.length > 0));
  if (hasRules) {
    return Boolean(
      access!.userIds.includes(user.id) ||
      access!.positions.some((position) => position.trim() === user.title.trim())
    );
  }

  return folder.scope === 'ORGANIZATION'
    ? Boolean(user.permissions?.includes('VIEW_ORGANIZATION_ARCHIVE'))
    : true;
};

class MockArchiveService implements IArchiveService {
  /** Rejects a folder the actor is not allowed to open, wherever it is used. */
  private requireFolderAccess(folderId: string, actor: User): ArchiveFolder {
    const folder = getFoldersData().find((item) => item.id === folderId);
    if (!folder) throw new Error('پوشه یافت نشد.');
    if (!canAccessFolder(folder, actor)) throw new Error('شما مجوز دسترسی به این پوشه را ندارید.');
    return folder;
  }

  public async getFolders(scope: 'PERSONAL' | 'ORGANIZATION', actor: User, ownerDepartmentId?: string): Promise<ApiResponse<ArchiveFolder[]>> {
    const folders = getFoldersData()
      .filter((f) => (scope === 'ORGANIZATION' ? f.scope === 'ORGANIZATION' : f.scope === 'PERSONAL' && f.ownerDepartmentId === ownerDepartmentId))
      // A folder the actor cannot open is not listed at all, so counts and
      // listings only ever reflect what that user is really allowed to see.
      .filter((f) => canAccessFolder(f, actor));
    return apiClient.simulateNetwork(folders, 100);
  }

  public async createFolder(dto: CreateFolderDto, actor: User): Promise<ApiResponse<ArchiveFolder>> {
    const { name, scope, ownerDepartmentId } = dto;
    if (!name.trim()) throw new Error('نام پوشه الزامی است.');
    if (scope === 'ORGANIZATION' && !(actor.role === 'ADMIN' || actor.permissions?.includes('MANAGE_ARCHIVE_FOLDERS'))) {
      throw new Error('برای ایجاد پوشه در بایگانی سازمانی دسترسی لازم را ندارید.');
    }
    const folders = getFoldersData();
    const scopedSiblings = folders.filter((f) => f.scope === scope && (scope === 'PERSONAL' ? f.ownerDepartmentId === ownerDepartmentId : true));
    if (scopedSiblings.some((f) => f.name.trim() === name.trim())) {
      throw new Error('پوشه‌ای با همین نام از قبل وجود دارد.');
    }
    const folder: ArchiveFolder = {
      id: `arch-folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      description: dto.description?.trim() || undefined,
      scope,
      ownerDepartmentId: scope === 'PERSONAL' ? ownerDepartmentId : undefined,
      access: {
        userIds: [...new Set(dto.access?.userIds || [])],
        positions: [...new Set((dto.access?.positions || []).map((position) => position.trim()).filter(Boolean))],
      },
      createdByUserId: actor.id,
      createdByName: actor.fullName,
      createdAt: new Date().toISOString(),
    };
    folders.unshift(folder);
    saveFoldersData(folders);
    return apiClient.simulateNetwork(folder, 100);
  }

  public async deleteFolder(id: string, actor: User): Promise<ApiResponse<void>> {
    const folders = getFoldersData();
    const folder = folders.find((f) => f.id === id);
    if (!folder) throw new Error('پوشه یافت نشد.');
    if (folder.scope === 'ORGANIZATION' && !(actor.role === 'ADMIN' || actor.permissions?.includes('MANAGE_ARCHIVE_FOLDERS'))) {
      throw new Error('برای حذف پوشه در بایگانی سازمانی دسترسی لازم را ندارید.');
    }
    saveFoldersData(folders.filter((f) => f.id !== id));
    saveItemsData(getItemsData().filter((item) => item.folderId !== id));
    return apiClient.simulateNetwork(undefined as unknown as void, 100);
  }

  public async getItems(folderId: string, actor: User): Promise<ApiResponse<ArchiveItem[]>> {
    // Service-layer enforcement: knowing a folder id is never enough.
    this.requireFolderAccess(folderId, actor);
    const items = getItemsData().filter((item) => item.folderId === folderId);
    return apiClient.simulateNetwork(items, 80);
  }

  public async getFolderResolutionItems(folderId: string, actor: User): Promise<ApiResponse<ArchiveItem[]>> {
    this.requireFolderAccess(folderId, actor);
    const items = getItemsData().filter((item) => item.folderId === folderId && item.itemType === 'RESOLUTION');
    return apiClient.simulateNetwork(items, 80);
  }

  /** A user's own personal archive, visible to nobody else but an admin. */
  public async getPersonalResolutionItems(actor: User): Promise<ApiResponse<ArchiveItem[]>> {
    const items = getItemsData().filter((item) => item.itemType === 'RESOLUTION' && item.ownerUserId === actor.id);
    return apiClient.simulateNetwork(items, 80);
  }

  public async archiveResolution(resolution: Resolution, scope: 'PERSONAL' | 'ORGANIZATION', actor: User, folderId?: string): Promise<ApiResponse<ArchiveItem>> {
    const items = getItemsData();
    if (items.some((item) => item.itemType === 'RESOLUTION' && item.resolutionId === resolution.id)) {
      throw new Error('این مصوبه از قبل بایگانی شده است.');
    }

    let folder: ArchiveFolder | undefined;
    if (scope === 'ORGANIZATION') {
      if (!folderId) throw new Error('برای بایگانی سازمانی انتخاب پوشه مقصد الزامی است.');
      folder = this.requireFolderAccess(folderId, actor);
    }

    // The archive state on the resolution is what removes it from the active
    // list; this entry is only the archive's own index of it.
    await resolutionService.setResolutionArchiveState(resolution.id, {
      scope,
      folderId: folder?.id,
      folderName: folder?.name,
      ownerUserId: scope === 'PERSONAL' ? actor.id : undefined,
      archivedByUserId: actor.id,
      archivedByName: actor.fullName,
    });

    const item: ArchiveItem = {
      id: `arch-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      folderId: folder?.id || '',
      itemType: 'RESOLUTION',
      ownerUserId: scope === 'PERSONAL' ? actor.id : undefined,
      resolutionId: resolution.id,
      resolutionTitle: resolution.topicTitle,
      resolutionNumber: resolution.resolutionNumber,
      movedByUserId: actor.id,
      movedByName: actor.fullName,
      movedAt: new Date().toISOString(),
    };
    items.unshift(item);
    saveItemsData(items);
    return apiClient.simulateNetwork(item, 120);
  }

  /**
   * «حذف از بایگانی» — takes the resolution out of the archive and back into
   * the resolution list. It deliberately does NOT call deleteResolution or
   * anything like it: the entity, its attachments and its timeline are kept,
   * and only the archive state changes.
   */
  public async restoreResolution(resolutionId: string, actor: User): Promise<ApiResponse<void>> {
    const items = getItemsData();
    const entry = items.find((item) => item.itemType === 'RESOLUTION' && item.resolutionId === resolutionId);
    if (!entry) throw new Error('این مصوبه در بایگانی یافت نشد.');
    if (entry.ownerUserId) {
      if (entry.ownerUserId !== actor.id && actor.role !== 'ADMIN') throw new Error('فقط صاحب بایگانی شخصی می‌تواند این مصوبه را از بایگانی خارج کند.');
    } else if (entry.folderId) {
      this.requireFolderAccess(entry.folderId, actor);
    }

    await resolutionService.clearResolutionArchiveState(resolutionId, actor.fullName);
    saveItemsData(items.filter((item) => item.id !== entry.id));
    return apiClient.simulateNetwork(undefined as unknown as void, 100);
  }

  public async archiveProposal(folderId: string, proposalId: string, proposalTitle: string, actor: User): Promise<ApiResponse<ArchiveItem>> {
    const items = getItemsData();
    if (items.some((item) => item.folderId === folderId && item.proposalId === proposalId)) {
      throw new Error('این پیشنهاد از قبل در این پوشه بایگانی شده است.');
    }
    const item: ArchiveItem = {
      id: `arch-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      folderId,
      itemType: 'PROPOSAL',
      proposalId,
      proposalTitle,
      movedByUserId: actor.id,
      movedByName: actor.fullName,
      movedAt: new Date().toISOString(),
    };
    items.unshift(item);
    saveItemsData(items);
    return apiClient.simulateNetwork(item, 100);
  }

  public async removeItem(itemId: string): Promise<ApiResponse<void>> {
    saveItemsData(getItemsData().filter((item) => item.id !== itemId));
    return apiClient.simulateNetwork(undefined as unknown as void, 80);
  }

  public async getArchivedProposalIds(): Promise<ApiResponse<Set<string>>> {
    const ids = new Set(getItemsData().filter((item) => item.proposalId).map((item) => item.proposalId!));
    return apiClient.simulateNetwork(ids, 60);
  }
}

export const archiveService: IArchiveService = new MockArchiveService();
