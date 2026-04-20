-- Monthly video quota for the Solo (free) tier.
--
-- Solo users get exactly 1 video generation per calendar month (UTC).
-- Videos are exempt from the daily credit cap (a single video costs more
-- than the 3-credits/day allowance) and are instead governed by this
-- separate counter that resets on the first day of each UTC month.
--
-- Paid plans ignore these fields.
ALTER TABLE user_profile ADD COLUMN monthly_videos_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_profile ADD COLUMN monthly_video_reset_at INTEGER NOT NULL DEFAULT 0;
