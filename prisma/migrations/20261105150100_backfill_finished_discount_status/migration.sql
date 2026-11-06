UPDATE "discounts"
SET "status" = 'FINISHED'
WHERE "status" = 'ACTIVE' AND "endsAt" <= CURRENT_TIMESTAMP;
