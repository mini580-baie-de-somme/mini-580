-- Post: optional work days produced
ALTER TABLE "Post" ADD COLUMN "workDays" INTEGER;

-- Milestone: optional end date + workload forecast
ALTER TABLE "Milestone" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "Milestone" ADD COLUMN "workloadForecast" INTEGER;

-- Media: crop aspect format (existing rows keep 3:4 portrait behaviour)
ALTER TABLE "Media" ADD COLUMN "cropAspectFormat" TEXT NOT NULL DEFAULT 'PORTRAIT_3_4';
