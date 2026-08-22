import { apiClient } from "@/lib/api-client";

// apiClient does NOT prepend a base URL — every caller passes an absolute one (see users.api.ts).
// Relative paths silently resolve against the Vite dev server instead of the gateway and 404.
const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/teams`;

export interface TeamMemberDto {
  userId: string;
  fullName: string;
  email: string;
  isLead: boolean;
  /**
   * Every team this user belongs to. Many-to-many, so a picker grouping by team must expect the
   * same user under more than one heading. Absent/empty when they are in no team, or on responses
   * where team context doesn't apply (e.g. a single team's own member list).
   */
  teams?: { teamId: string; name: string }[];
}

export interface TeamDto {
  id: string;
  name: string;
  description: string | null;
  teamLeadUserId: string | null;
  teamLeadName: string | null;
  isActive: boolean;
  members: TeamMemberDto[];
}

export interface CreateTeamRequest {
  name: string;
  description?: string | null;
  teamLeadUserId?: string | null;
  memberUserIds?: string[];
}

export interface UpdateTeamRequest {
  name: string;
  description?: string | null;
  teamLeadUserId?: string | null;
  isActive: boolean;
}

/** Identity service — uses the enveloped apiClient, not rawApiClient. */
export const teamsApi = {
  getAll: (search?: string): Promise<TeamDto[]> =>
    apiClient.get(`${BASE}${search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`),

  getById: (id: string): Promise<TeamDto> => apiClient.get(`${BASE}/${id}`),

  create: (body: CreateTeamRequest): Promise<TeamDto> => apiClient.post(BASE, body),

  update: (id: string, body: UpdateTeamRequest): Promise<TeamDto> => apiClient.put(`${BASE}/${id}`, body),

  addMember: (teamId: string, userId: string): Promise<TeamDto> =>
    apiClient.post(`${BASE}/${teamId}/members`, { userId }),

  removeMember: (teamId: string, userId: string): Promise<TeamDto> =>
    apiClient.delete(`${BASE}/${teamId}/members/${userId}`),

  remove: (id: string): Promise<void> => apiClient.delete(`${BASE}/${id}`),

  /**
   * Who the current user may hand a lead to — every active user for an admin, only their own team
   * members for a team lead, nobody for a plain member. Resolved server-side so the client never
   * has to know which tier it is on.
   */
  assignableUsers: (): Promise<TeamMemberDto[]> => apiClient.get(`${BASE}/assignable-users`),

  /**
   * Users who may be made a team lead — those whose permissions actually grant the CRM team tier.
   * Picking anyone else would produce a lead who can see nothing of their own team.
   */
  leadCandidates: (): Promise<TeamMemberDto[]> => apiClient.get(`${BASE}/lead-candidates`),
};
