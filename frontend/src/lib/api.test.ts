import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

// Minimal fetch mock
function mockFetch(status: number, body: unknown) {
  const response = {
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  } as Response;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getProjects', () => {
    it('returns project list on success', async () => {
      mockFetch(200, { projects: [{ id: 'p1', name: 'Test', description: '' }] });
      const result = await api.getProjects();
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].id).toBe('p1');
    });

    it('throws on non-ok response', async () => {
      mockFetch(503, { error: 'postgres_disabled' });
      await expect(api.getProjects()).rejects.toThrow('postgres_disabled');
    });
  });

  describe('integrations and profile', () => {
    it('reads the authoritative GitHub connection status', async () => {
      mockFetch(200, {
        connected: true,
        configured: true,
        owner: 'souayb',
        repo: 'kanflow',
        defaultBranch: 'main',
      });
      const result = await api.getGithubStatus();
      expect(result).toMatchObject({ connected: true, repo: 'kanflow' });
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/integrations/github'),
        expect.any(Object),
      );
    });

    it('updates the authenticated app profile', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        statusText: 'OK',
        json: async () => ({
          user: { id: 'u1', name: 'New name', email: 'a@b.com', role: 'member' },
        }),
      } as Response);
      vi.stubGlobal('fetch', fetchSpy);

      await api.updateMe({ name: 'New name' });
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/users/me');
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ name: 'New name' });
    });

    it('configures GitHub without reading the token back', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        statusText: 'OK',
        json: async () => ({ connected: true, configured: true, owner: 'acme', repo: 'app' }),
      } as Response);
      vi.stubGlobal('fetch', fetchSpy);

      await api.configureGithub({ token: 'secret', owner: 'acme', repo: 'app' });
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/integrations/github');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        token: 'secret',
        owner: 'acme',
        repo: 'app',
      });
    });
  });

  describe('createProject', () => {
    it('posts to /api/v1/projects with name', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        status: 201, ok: true, statusText: 'Created',
        json: async () => ({ project: { id: 'p2', name: 'New', description: '' } }),
      } as Response);
      vi.stubGlobal('fetch', fetchSpy);

      const result = await api.createProject({ name: 'New' });
      expect(result.project.name).toBe('New');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/projects');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ name: 'New' });
    });
  });

  describe('project members', () => {
    it('persists an added teammate', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        status: 204, ok: true, statusText: 'No Content', json: async () => undefined,
      } as Response);
      vi.stubGlobal('fetch', fetchSpy);

      await api.addProjectMember('p1', 'u1');
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/projects/p1/members');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ userId: 'u1' });
    });
  });

  describe('updateTask', () => {
    it('patches /api/v1/tasks/:id', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        status: 200, ok: true, statusText: 'OK',
        json: async () => ({ task: { id: 't1', title: 'Updated' } }),
      } as Response);
      vi.stubGlobal('fetch', fetchSpy);

      await api.updateTask('t1', { title: 'Updated' } as any);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/tasks/t1');
      expect(init.method).toBe('PATCH');
    });
  });

  describe('deleteTask', () => {
    it('sends DELETE to /api/v1/tasks/:id and handles 204', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          status: 204,
          ok: true,
          statusText: 'No Content',
          json: async () => {
            throw new Error('no body');
          },
        } as unknown as Response),
      );

      // 204 returns undefined without throwing
      const result = await api.deleteTask('t99');
      expect(result).toBeUndefined();
    });
  });

  describe('addComment', () => {
    it('posts to /api/v1/tasks/:id/comments', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        status: 201, ok: true, statusText: 'Created',
        json: async () => ({
          comment: { id: 'c1', userId: 'u1', userName: 'Alice', content: 'LGTM', createdAt: 1000 },
        }),
      } as Response);
      vi.stubGlobal('fetch', fetchSpy);

      const result = await api.addComment('t1', {
        user_id: 'u1', user_name: 'Alice', content: 'LGTM',
      });
      expect(result.comment.content).toBe('LGTM');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/tasks/t1/comments');
      expect(init.method).toBe('POST');
    });
  });
});
