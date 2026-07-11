CREATE TABLE `twitch_snapshots` (
	`game` text PRIMARY KEY NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `twitch_streams` (
	`game` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`title` text NOT NULL,
	`viewer_count` integer NOT NULL,
	`started_at` text NOT NULL,
	`tags` text NOT NULL,
	FOREIGN KEY (`game`) REFERENCES `twitch_snapshots`(`game`) ON UPDATE no action ON DELETE cascade
);
