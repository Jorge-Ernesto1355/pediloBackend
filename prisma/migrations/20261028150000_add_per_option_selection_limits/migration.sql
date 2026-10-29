ALTER TABLE "ProductOption"
  ADD COLUMN "minSelect" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxSelect" INTEGER NOT NULL DEFAULT 1;

-- Preserve the previous group-level maximum for existing options while the
-- dashboard transitions to per-option limits.
UPDATE "ProductOption" AS option
SET "maxSelect" = group_config."maxSelect"
FROM "ProductOptionGroup" AS group_config
WHERE option."groupId" = group_config."id";
