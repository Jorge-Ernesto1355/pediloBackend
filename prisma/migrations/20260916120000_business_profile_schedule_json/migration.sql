ALTER TABLE "Business"
ADD COLUMN "ubicationMaps" TEXT;

ALTER TABLE "Business"
ALTER COLUMN "scheduleId" DROP NOT NULL;

ALTER TABLE "BusinessSchedule"
ADD COLUMN "days" JSONB NOT NULL DEFAULT '[]';

UPDATE "BusinessSchedule" AS schedule
SET "days" = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'key', day.key,
        'label', day.label,
        'enabled', day."isEnabled"
      )
      ORDER BY day.id
    )
    FROM "dayWeek" AS day
    WHERE day."businessScheduleId" = schedule.id
  ),
  '[]'::jsonb
);

DROP TABLE "dayWeek";
