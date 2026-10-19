import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { GetPublicBusinessCatalog } from '../../application/useCases/GetPublicBusinessCatalog.js';
import { RecordPublicStoreVisit } from '../../application/useCases/RecordPublicStoreVisit.js';
import { PublicBusinessController } from './PublicBusinessController.js';

describe('PublicBusinessController catalog visit recording', () => {
  const catalog = { business: { id: 'business-1', slug: 'tacos' }, menus: [] };

  function setup(result: unknown) {
    const getCatalog = { execute: vi.fn().mockResolvedValue(result) };
    const recordVisit = { execute: vi.fn().mockResolvedValue(true) };
    const controller = new PublicBusinessController(
      getCatalog as unknown as GetPublicBusinessCatalog,
      recordVisit as unknown as RecordPublicStoreVisit,
    );
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const request = {
      params: { slug: 'tacos' },
      ip: '192.0.2.17',
      get: vi.fn().mockReturnValue('Mozilla/5.0 Chrome'),
    } as unknown as Request;
    return { controller, getCatalog, recordVisit, response, request };
  }

  it('records one visit for a successfully loaded public catalog', async () => {
    const { controller, recordVisit, response, request } = setup(catalog);
    await controller.getCatalog(request, response);
    expect(recordVisit.execute).toHaveBeenCalledWith('business-1', {
      ipAddress: '192.0.2.17',
      userAgent: 'Mozilla/5.0 Chrome',
    });
    expect(response.json).toHaveBeenCalledWith(catalog);
  });

  it('does not record an unknown store or any other route traffic', async () => {
    const { controller, recordVisit, response, request } = setup(null);
    await controller.getCatalog(request, response);
    expect(recordVisit.execute).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it('serves the catalog if visit tracking is temporarily unavailable', async () => {
    const { controller, recordVisit, response, request } = setup(catalog);
    recordVisit.execute.mockRejectedValue(new Error('database unavailable'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await controller.getCatalog(request, response);
    expect(response.json).toHaveBeenCalledWith(catalog);
    expect(errorLog).toHaveBeenCalledWith('public_store_visit_record_failed', 'Error');
    errorLog.mockRestore();
  });
});
