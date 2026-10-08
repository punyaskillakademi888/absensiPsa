import {
  User, Kejuruan, AttendanceRecord, LeaveRequest, AttendanceSettings,
  Mission, MissionSubmission, DailyReport, TraineeHallOfFameEntry, MentorHallOfFameEntry
} from '../types';

function resolveApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw);
  if (
    isLoopback &&
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return '';
  }
  return raw;
}

const API_BASE_URL = resolveApiBaseUrl();

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

export interface MeResponse {
  success: boolean;
  user?: User;
  tokenPayload?: any;
  message?: string;
}

export interface HealthResponse {
  status: string;
  database: string;
  jwt: string;
  timestamp: string;
  error?: string;
}

export interface AppDataSnapshot {
  kejuruanList: Kejuruan[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  settings: AttendanceSettings | null;
  missions: Mission[];
  missionSubmissions: MissionSubmission[];
  dailyReports: DailyReport[];
}

export const api = {
  getToken(): string | null {
    try {
      return window.sessionStorage.getItem('hadirku_session_token');
    } catch {
      return null;
    }
  },

  setToken(token: string | null): void {
    try {
      if (token) window.sessionStorage.setItem('hadirku_session_token', token);
      else window.sessionStorage.removeItem('hadirku_session_token');
    } catch {
      // The HttpOnly cookie remains the primary session mechanism.
    }
  },

  // Helper for authenticated fetch
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        response.status === 404
          ? 'API Vercel tidak ditemukan. Redeploy project setelah perubahan folder api/.'
          : `API tidak merespons JSON (HTTP ${response.status}). Function backend mungkin gagal start.`
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.error
        ? `${data?.message || `HTTP ${response.status}: Terjadi kesalahan server`} (${data.error})`
        : data?.message || `HTTP ${response.status}: Terjadi kesalahan server`;
      throw new Error(errorMsg);
    }

    return data as T;
  },

  // Check health and TiDB connection
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/health');
  },

  // Login with 8-digit code or NIM + password
  async login(credentials: {
    code?: string;
    identifier?: string;
    password?: string;
  }): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.token) this.setToken(res.token);
    return res;
  },

  async logoutSession(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  },

  // Get current authenticated user profile via JWT
  async getMe(): Promise<MeResponse> {
    return this.request<MeResponse>('/api/auth/me');
  },

  async getAppData(): Promise<{ success: boolean } & AppDataSnapshot> {
    return this.request<{ success: boolean } & AppDataSnapshot>('/api/app-data');
  },

  async getTraineeHallOfFame(): Promise<{ success: boolean; trainees: TraineeHallOfFameEntry[] }> {
    return this.request<{ success: boolean; trainees: TraineeHallOfFameEntry[] }>('/api/app-data/hall-of-fame/trainees');
  },

  async getMentorHallOfFame(): Promise<{ success: boolean; mentors: MentorHallOfFameEntry[] }> {
    return this.request<{ success: boolean; mentors: MentorHallOfFameEntry[] }>('/api/app-data/hall-of-fame/mentors');
  },

  async resetTraineeHallOfFamePoints(): Promise<{ success: boolean; count: number; message: string }> {
    return this.request<{ success: boolean; count: number; message: string }>('/api/app-data/hall-of-fame/reset-trainee-points', {
      method: 'POST',
    });
  },

  async resetMentorMissionData(): Promise<{ success: boolean; missions: number; submissions: number; message: string }> {
    return this.request<{ success: boolean; missions: number; submissions: number; message: string }>('/api/app-data/missions/reset', {
      method: 'POST',
    });
  },

  async saveAppData(data: AppDataSnapshot): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/app-data', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async reviewDailyReport(id: string, status: 'approved' | 'rejected', reviewNotes: string): Promise<{ success: boolean; message: string; report: DailyReport }> {
    return this.request(`/api/app-data/daily-reports/${encodeURIComponent(id)}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reviewNotes }),
    });
  },

  async saveAttendanceSettings(settings: AttendanceSettings): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/app-data/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async saveAttendanceRecord(record: AttendanceRecord): Promise<{ success: boolean; message: string; duplicate?: boolean; attendanceRecord: AttendanceRecord }> {
    return this.request<{ success: boolean; message: string; duplicate?: boolean; attendanceRecord: AttendanceRecord }>('/api/app-data/attendance', {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  },

  async resetAttendanceRecords(): Promise<{ success: boolean; count: number; message: string }> {
    return this.request<{ success: boolean; count: number; message: string }>('/api/attendance/reset', {
      method: 'DELETE',
    });
  },

  async deleteAppData(collection: string, id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/app-data/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Get all users from TiDB (Admin / Mentor only)
  async getUsers(): Promise<{ success: boolean; users: User[] }> {
    return this.request<{ success: boolean; users: User[] }>('/api/users');
  },

  // Create user (Mentor or Trainee by Admin)
  async createUser(userData: Omit<User, 'id'>): Promise<{ success: boolean; message: string; user: User }> {
    return this.request<{ success: boolean; message: string; user: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Batch import users (Excel Trainee Import)
  async batchImportUsers(users: Partial<User>[]): Promise<{ success: boolean; count: number; message: string; createdUsers?: User[] }> {
    return this.request<{ success: boolean; count: number; message: string; createdUsers?: User[] }>('/api/users/batch', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });
  },

  // Update user
  async updateUser(id: string, updates: Partial<User>): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async updateMyAvatar(avatar: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/profile/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar }),
    });
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async uploadImageToCloudinary(payload: { file: File; folder: string }): Promise<{ success: boolean; url?: string; publicId?: string; message: string }> {
    const signedUpload = await this.request<{
      success: boolean;
      cloudName: string;
      apiKey: string;
      folder: string;
      timestamp: number;
      signature: string;
    }>('/api/upload/signature', {
      method: 'POST',
      body: JSON.stringify({ folder: payload.folder }),
    });

    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('api_key', signedUpload.apiKey);
    formData.append('folder', signedUpload.folder);
    formData.append('timestamp', String(signedUpload.timestamp));
    formData.append('signature', signedUpload.signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signedUpload.cloudName)}/image/upload`,
      { method: 'POST', body: formData }
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.secure_url) {
      throw new Error(result.error?.message || 'Gagal mengupload gambar ke Cloudinary.');
    }

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      message: 'Gambar berhasil diupload.',
    };
  },

  // Delete user
  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Clear all users by role (admin only)
  async clearUsersByRole(
    role: 'trainee' | 'mentor' | 'all'
  ): Promise<{ success: boolean; count: number; message: string }> {
    return this.request<{ success: boolean; count: number; message: string }>(`/api/users/clear/${role}`, {
      method: 'DELETE',
    });
  },

  async deleteTraineesByIds(ids: string[]): Promise<{ success: boolean; count: number; message: string }> {
    return this.request<{ success: boolean; count: number; message: string }>('/api/users/batch-delete-trainees', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  async getLeaveRequests(): Promise<{ success: boolean; requests: LeaveRequest[] }> {
    return this.request<{ success: boolean; requests: LeaveRequest[] }>('/api/leaves');
  },

  async createLeaveRequest(data: {
    type: 'izin' | 'sakit';
    startDate: string;
    endDate: string;
    reason: string;
    attachmentUrl: string;
  }): Promise<{ success: boolean; request: LeaveRequest; message: string }> {
    return this.request<{ success: boolean; request: LeaveRequest; message: string }>('/api/leaves', { method: 'POST', body: JSON.stringify(data) });
  },

  async reviewLeaveRequest(id: string, status: 'approved' | 'rejected', reviewNotes?: string): Promise<{ success: boolean; request: LeaveRequest; message: string }> {
    return this.request<{ success: boolean; request: LeaveRequest; message: string }>(`/api/leaves/${encodeURIComponent(id)}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reviewNotes })
    });
  },

  async getMissions(): Promise<{ success: boolean; missions: Mission[] }> {
    return this.request<{ success: boolean; missions: Mission[] }>('/api/missions');
  },

  async createMission(mission: Mission): Promise<{ success: boolean; mission: Mission }> {
    return this.request<{ success: boolean; mission: Mission }>('/api/missions', {
      method: 'POST',
      body: JSON.stringify(mission),
    });
  },

  async updateMission(id: string, updates: Partial<Mission>): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/missions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteMission(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/missions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async reviewMissionSubmission(id: string, review: {
    status: 'approved' | 'rejected';
    feedback: string;
    points: number;
  }): Promise<{ success: boolean; message: string; submission: MissionSubmission }> {
    return this.request<{ success: boolean; message: string; submission: MissionSubmission }>(`/api/missions/submissions/${encodeURIComponent(id)}/review`, {
      method: 'PATCH',
      body: JSON.stringify(review),
    });
  },
};
