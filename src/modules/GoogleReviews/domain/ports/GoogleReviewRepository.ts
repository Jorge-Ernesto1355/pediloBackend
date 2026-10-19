export interface GoogleReviewLink {
  id: string;
  businessId: string;
  qrCode: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoogleReviewScan {
  businessId: string;
  googleReviewLinkId: string;
  visitedAt: Date;
  visitorHash: string;
  dedupeBucket: Date;
}

export interface GoogleReviewStatsRange {
  start: Date;
  end: Date;
}

export interface GoogleReviewStatsResult {
  current: { scans: number; uniqueVisitors: number };
  previous: { scans: number; uniqueVisitors: number };
  daily: Array<{ date: string; scans: number }>;
}

export interface GoogleReviewBusiness {
  id: string;
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
}

export interface GoogleReviewDetails {
  link: GoogleReviewLink | null;
  business: GoogleReviewBusiness;
}

export interface GoogleReviewRepository {
  isOwner(userId: string): Promise<boolean>;
  getDetailsByOwnerUserId(userId: string): Promise<GoogleReviewDetails | null>;
  upsertByOwnerUserId(userId: string, url: string): Promise<GoogleReviewLink>;
  getRedirectByQrCode(qrCode: string): Promise<{ link: GoogleReviewLink } | null>;
  recordScan(scan: GoogleReviewScan): Promise<boolean>;
  getStats(
    businessId: string,
    ranges: { current: GoogleReviewStatsRange; previous: GoogleReviewStatsRange },
    timezone: string,
  ): Promise<GoogleReviewStatsResult>;
  getBusinessForStats(userId: string): Promise<{ id: string; timezone: string } | null>;
}
