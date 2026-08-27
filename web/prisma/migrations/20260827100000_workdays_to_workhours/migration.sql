-- Rename Post.workDays → workHours (workload unit is now person-hours)
ALTER TABLE "Post" RENAME COLUMN "workDays" TO "workHours";
