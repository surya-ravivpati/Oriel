CREATE TABLE `training_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`loop_id` text NOT NULL,
	`user_id` text NOT NULL,
	`stage` text NOT NULL,
	`question_id` text NOT NULL,
	`question_text` text NOT NULL,
	`question_source` text NOT NULL,
	`response` text NOT NULL,
	`input_mode` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`client_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`loop_id`) REFERENCES `training_loops`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `training_attempts_loop_idx` ON `training_attempts` (`loop_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `training_attempts_key_idx` ON `training_attempts` (`user_id`,`client_key`);--> statement-breakpoint
CREATE TABLE `training_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`user_id` text NOT NULL,
	`competency_id` text NOT NULL,
	`rubric_version` integer NOT NULL,
	`evaluator` text NOT NULL,
	`criteria` text NOT NULL,
	`enough_evidence` integer NOT NULL,
	`confidence` text NOT NULL,
	`primary_weakness` text,
	`secondary` text NOT NULL,
	`limitations` text,
	`insufficient_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `training_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_evaluations_attempt_idx` ON `training_evaluations` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `training_loops` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`competency_id` text NOT NULL,
	`rubric_version` integer NOT NULL,
	`stage` text NOT NULL,
	`target_criterion` text,
	`scaffold` integer DEFAULT 0 NOT NULL,
	`retries` integer DEFAULT 0 NOT NULL,
	`insufficient_streak` integer DEFAULT 0 NOT NULL,
	`question` text NOT NULL,
	`review_of_loop_id` text,
	`outcome` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `training_loops_user_idx` ON `training_loops` (`user_id`);--> statement-breakpoint
CREATE TABLE `training_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`competency_id` text NOT NULL,
	`category` text NOT NULL,
	`source_loop_id` text NOT NULL,
	`target_criterion` text,
	`due_at` integer NOT NULL,
	`started_loop_id` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_loop_id`) REFERENCES `training_loops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `training_reviews_user_due_idx` ON `training_reviews` (`user_id`,`due_at`);