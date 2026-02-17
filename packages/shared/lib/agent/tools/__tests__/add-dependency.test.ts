import { getArtifact, updateArtifact } from '../../../db/index.js';
import { createAddDependencyTool } from '../add-dependency.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../types.js';

vi.mock('../../../db/index.js', () => ({
  getArtifact: vi.fn(),
  updateArtifact: vi.fn(),
}));

const createMockToolContext = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  extensionId: 'test-ext',
  tabId: 123,
  sendToContentScript: vi.fn().mockResolvedValue({}),
  waitForMessage: vi.fn().mockResolvedValue({}),
  sendToServiceWorker: vi.fn().mockResolvedValue({}),
  ...overrides,
});

describe('add_dependency tool', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
    vi.restoreAllMocks();
    (getArtifact as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'art-1',
      extensionId: 'test-ext',
      type: 'react-component',
      name: 'Test',
      code: '',
      codeVersions: [],
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
    });
    (updateArtifact as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('resolves a package version from esm.sh and updates artifact', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://esm.sh/recharts@2.15.0',
      status: 200,
    });

    const tool = createAddDependencyTool(ctx);
    const result = await tool.invoke({ artifactId: 'art-1', packageName: 'recharts' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.packageName).toBe('recharts');
    expect(parsed.version).toBe('2.15.0');
    expect(updateArtifact).toHaveBeenCalledWith('art-1', {
      dependencies: { recharts: '2.15.0' },
    });
  });

  it('uses explicit version when provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://esm.sh/recharts@2.12.0',
      status: 200,
    });

    const tool = createAddDependencyTool(ctx);
    const result = await tool.invoke({ artifactId: 'art-1', packageName: 'recharts', version: '2.12.0' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.version).toBe('2.12.0');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://esm.sh/recharts@2.12.0',
      expect.objectContaining({ method: 'HEAD', redirect: 'follow' }),
    );
  });

  it('returns error when artifact not found', async () => {
    (getArtifact as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const tool = createAddDependencyTool(ctx);
    const result = await tool.invoke({ artifactId: 'not-found', packageName: 'recharts' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('not found');
  });

  it('returns error when package not found on esm.sh', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      url: 'https://esm.sh/nonexistent-package-xyz',
    });

    const tool = createAddDependencyTool(ctx);
    const result = await tool.invoke({ artifactId: 'art-1', packageName: 'nonexistent-package-xyz' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('not found');
  });

  it('returns error when fetch fails (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const tool = createAddDependencyTool(ctx);
    const result = await tool.invoke({ artifactId: 'art-1', packageName: 'recharts' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Network error');
  });

  it('preserves existing dependencies when adding new one', async () => {
    (getArtifact as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'art-1',
      extensionId: 'test-ext',
      type: 'react-component',
      name: 'Test',
      code: '',
      codeVersions: [],
      dependencies: { 'lodash-es': '4.17.21' },
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://esm.sh/recharts@2.15.0',
      status: 200,
    });

    const tool = createAddDependencyTool(ctx);
    const result = await tool.invoke({ artifactId: 'art-1', packageName: 'recharts' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(updateArtifact).toHaveBeenCalledWith('art-1', {
      dependencies: { 'lodash-es': '4.17.21', recharts: '2.15.0' },
    });
  });
});
