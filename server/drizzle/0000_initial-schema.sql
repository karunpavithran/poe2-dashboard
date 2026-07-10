CREATE TABLE `atlas_strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source_url` text,
	`profit_per_hour` real,
	`master_name` text NOT NULL,
	`master_nodes` text NOT NULL,
	`notes` text,
	`warning` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atlas_tablets` (
	`strategy_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`mods` text NOT NULL,
	`trade_url` text,
	PRIMARY KEY(`strategy_id`, `sort_order`),
	FOREIGN KEY (`strategy_id`) REFERENCES `atlas_strategies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `atlas_tags` (
	`strategy_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`strategy_id`, `tag`),
	FOREIGN KEY (`strategy_id`) REFERENCES `atlas_strategies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `economy_currencies` (
	`league` text NOT NULL,
	`name` text NOT NULL,
	`value` real,
	`icon` text,
	PRIMARY KEY(`league`, `name`),
	FOREIGN KEY (`league`) REFERENCES `economy_snapshots`(`league`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `economy_edges` (
	`league` text NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`rate` real NOT NULL,
	`volume` real NOT NULL,
	`category` text NOT NULL,
	FOREIGN KEY (`league`) REFERENCES `economy_snapshots`(`league`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `economy_edges_league_idx` ON `economy_edges` (`league`);--> statement-breakpoint
CREATE TABLE `economy_snapshots` (
	`league` text PRIMARY KEY NOT NULL,
	`fetched_at` integer NOT NULL,
	`hub_divine` text NOT NULL,
	`hub_exalted` text NOT NULL,
	`hub_chaos` text NOT NULL
);
