import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schemaUpload } from '../commands/schema-upload.js';

// Mock fs/promises and fetch
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

import { readdir, readFile } from 'fs/promises';

describe('schemaUpload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws if no YAML files found', async () => {
    vi.mocked(readdir).mockResolvedValue([] as never);

    await expect(
      schemaUpload({ schemaDir: '/schemas', apiUrl: 'http://localhost:3000', token: 'tok' })
    ).rejects.toThrow('No YAML files found');
  });

  it('sends YAML contents to API and logs success', async () => {
    vi.mocked(readdir).mockResolvedValue(['customer.object-type.yaml'] as never);
    vi.mocked(readFile).mockResolvedValue('objectType:\n  apiName: Customer' as never);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'reloaded',
        objectTypes: 1,
        linkTypes: 0,
        actionTypes: 0,
        uploadedBy: 'admin',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await schemaUpload({
      schemaDir: '/schemas',
      apiUrl: 'http://localhost:3000',
      token: 'my-token',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/schema/upload',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
        body: JSON.stringify({ files: ['objectType:\n  apiName: Customer'] }),
      })
    );
  });

  it('throws on API error response', async () => {
    vi.mocked(readdir).mockResolvedValue(['x.yaml'] as never);
    vi.mocked(readFile).mockResolvedValue('bad yaml' as never);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'Schema parse errors' }),
    }));

    await expect(
      schemaUpload({ schemaDir: '/schemas', apiUrl: 'http://api', token: 'tok' })
    ).rejects.toThrow('Upload failed (422)');
  });

  it('uploads multiple YAML files as array', async () => {
    vi.mocked(readdir).mockResolvedValue([
      'customer.object-type.yaml',
      'shipment.object-type.yaml',
    ] as never);
    vi.mocked(readFile)
      .mockResolvedValueOnce('objectType:\n  apiName: Customer' as never)
      .mockResolvedValueOnce('objectType:\n  apiName: Shipment' as never);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ objectTypes: 2, linkTypes: 0, actionTypes: 0, uploadedBy: 'u' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await schemaUpload({ schemaDir: '/schemas', apiUrl: 'http://api', token: 'tok' });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.files).toHaveLength(2);
  });
});
