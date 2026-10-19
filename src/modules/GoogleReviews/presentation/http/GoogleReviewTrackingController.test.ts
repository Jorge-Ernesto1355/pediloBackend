import { describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { GoogleReviewTrackingController } from './GoogleReviewTrackingController.js';
import type { TrackGoogleReviewScan } from '../../application/useCases/TrackGoogleReviewScan.js';
import type { GetGoogleReviewStats } from '../../application/useCases/GetGoogleReviewStats.js';

describe('GoogleReviewTrackingController', () => {
  it('responds with a temporary redirect to the stored Google Reviews URL', async () => {
    const trackScan = { execute: vi.fn().mockResolvedValue('https://g.page/r/review') };
    const controller = new GoogleReviewTrackingController(
      trackScan as unknown as TrackGoogleReviewScan,
      {} as GetGoogleReviewStats,
    );
    const response = { redirect: vi.fn() } as unknown as Response;
    const request = {
      params: { qrCode: 'c12345678901234567890123' },
      ip: '192.0.2.8',
      get: vi.fn().mockReturnValue('Mozilla Chrome'),
    } as unknown as Request;
    const next = vi.fn() as NextFunction;

    controller.redirect(request, response, next);
    await vi.waitFor(() =>
      expect(response.redirect).toHaveBeenCalledWith(302, 'https://g.page/r/review'),
    );
    expect(trackScan.execute).toHaveBeenCalledWith('c12345678901234567890123', {
      ipAddress: '192.0.2.8',
      userAgent: 'Mozilla Chrome',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
