CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lesson_key` text NOT NULL,
	`track` text NOT NULL,
	`status` text NOT NULL,
	`priority` real DEFAULT 0 NOT NULL,
	`source_session_id` text,
	`metric_key` text NOT NULL,
	`start_value` real,
	`latest_value` real,
	`evidence` text NOT NULL,
	`content` text NOT NULL,
	`practice_passes` integer DEFAULT 0 NOT NULL,
	`practice_attempts` integer DEFAULT 0 NOT NULL,
	`viewed_at` integer,
	`mastered_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_user_key_idx` ON `lessons` (`user_id`,`lesson_key`);