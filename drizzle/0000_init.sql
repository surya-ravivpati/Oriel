CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`seq` integer NOT NULL,
	`text` text NOT NULL,
	`server_text` text,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`first_word_latency_ms` integer,
	`interrupted` integer DEFAULT false NOT NULL,
	`input_mode` text DEFAULT 'voice' NOT NULL,
	`flags` text,
	`analysis` text,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `answers_session_idx` ON `answers` (`session_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`target` text,
	`ip` text,
	`data` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`answer_id` text NOT NULL,
	`answer_seq` integer NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`normalized` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`answer_id`) REFERENCES `answers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `claims_session_idx` ON `claims` (`session_id`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`version` text NOT NULL,
	`granted` integer NOT NULL,
	`session_id` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `consent_user_idx` ON `consent_records` (`user_id`);--> statement-breakpoint
CREATE TABLE `cost_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`session_id` text,
	`provider` text NOT NULL,
	`category` text NOT NULL,
	`operation` text NOT NULL,
	`units` real NOT NULL,
	`unit_name` text NOT NULL,
	`usd` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cost_session_idx` ON `cost_records` (`session_id`);--> statement-breakpoint
CREATE TABLE `drill_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`drill_id` text NOT NULL,
	`source_session_id` text,
	`prompt_text` text NOT NULL,
	`transcript` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`result` text,
	`feedback` text,
	`baseline_value` real,
	`value` real,
	`passed` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`drill_id`) REFERENCES `drills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `drill_attempts_user_idx` ON `drill_attempts` (`user_id`);--> statement-breakpoint
CREATE TABLE `drills` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`objective` text NOT NULL,
	`instructions` text NOT NULL,
	`prompt` text NOT NULL,
	`target_metric` text NOT NULL,
	`duration_sec` integer NOT NULL,
	`requires_camera` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interview_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`interview_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`phase` text DEFAULT 'INTRO' NOT NULL,
	`controller_state` text,
	`started_at` integer,
	`ended_at` integer,
	`llm_provider` text,
	`stt_provider` text,
	`tts_provider` text,
	`avatar_provider` text,
	`degraded_mode` text,
	`camera_metrics_enabled` integer DEFAULT true NOT NULL,
	`analysis_status` text DEFAULT 'not_started' NOT NULL,
	`analysis_error` text,
	`summary` text,
	`video_expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `interview_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_interview_idx` ON `interview_sessions` (`interview_id`);--> statement-breakpoint
CREATE TABLE `interviewers` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`persona_id` text NOT NULL,
	`panel_role` text,
	`display_name` text NOT NULL,
	`seat` integer DEFAULT 0 NOT NULL,
	`competency_focus` text,
	`memory` text,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`domain` text NOT NULL,
	`level` text NOT NULL,
	`type` text NOT NULL,
	`pressure` integer NOT NULL,
	`mode` text DEFAULT 'single' NOT NULL,
	`resume_id` text,
	`job_description_id` text,
	`ladder_level` integer,
	`target_minutes` integer DEFAULT 15 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`job_description_id`) REFERENCES `job_descriptions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `interviews_user_idx` ON `interviews` (`user_id`);--> statement-breakpoint
CREATE TABLE `job_descriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`raw_text` text NOT NULL,
	`parsed` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jds_user_idx` ON `job_descriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `ladder_levels` (
	`level` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`persona_ids` text NOT NULL,
	`mode` text NOT NULL,
	`pressure` integer NOT NULL,
	`curveballs` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ladder_progress` (
	`user_id` text NOT NULL,
	`level` integer NOT NULL,
	`qualifying_sessions` integer DEFAULT 0 NOT NULL,
	`unlocked_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ladder_progress_pk` ON `ladder_progress` (`user_id`,`level`);--> statement-breakpoint
CREATE TABLE `media_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text,
	`drill_attempt_id` text,
	`kind` text NOT NULL,
	`mime_type` text NOT NULL,
	`storage_key` text NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`segments` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'recording' NOT NULL,
	`duration_ms` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_user_idx` ON `media_objects` (`user_id`);--> statement-breakpoint
CREATE INDEX `media_session_idx` ON `media_objects` (`session_id`);--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`drill_attempt_id` text,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` real,
	`low` real,
	`high` real,
	`unit` text NOT NULL,
	`confidence` text NOT NULL,
	`target_low` real,
	`target_high` real,
	`detail` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `metrics_session_idx` ON `metrics` (`session_id`);--> statement-breakpoint
CREATE INDEX `metrics_user_key_idx` ON `metrics` (`user_id`,`key`);--> statement-breakpoint
CREATE TABLE `panels` (
	`id` text PRIMARY KEY NOT NULL,
	`interview_id` text NOT NULL,
	`size` integer NOT NULL,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `personas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`warmth` real NOT NULL,
	`skepticism` real NOT NULL,
	`pace` real NOT NULL,
	`interruption_rate` real NOT NULL,
	`silence_tolerance` real NOT NULL,
	`specificity_demand` real NOT NULL,
	`expressiveness` real NOT NULL,
	`voice` text NOT NULL,
	`accent` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `playback_clips` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`question_id` text,
	`answer_id` text,
	`rank` integer NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`title` text NOT NULL,
	`question_text` text NOT NULL,
	`transcript` text NOT NULL,
	`observed` text NOT NULL,
	`suggestion` text NOT NULL,
	`signal` text NOT NULL,
	`confidence` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clips_session_idx` ON `playback_clips` (`session_id`);--> statement-breakpoint
CREATE TABLE `processing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`step` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`step_timings` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `processing_jobs` (`status`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_role` text NOT NULL,
	`domain` text DEFAULT 'software' NOT NULL,
	`experience_level` text DEFAULT 'mid' NOT NULL,
	`preferred_interview_type` text DEFAULT 'behavioral' NOT NULL,
	`preferred_persona` text DEFAULT 'hiring_manager' NOT NULL,
	`camera_metrics_enabled` integer DEFAULT true NOT NULL,
	`gaze_metric_enabled` integer DEFAULT true NOT NULL,
	`posture_metric_enabled` integer DEFAULT true NOT NULL,
	`record_video` integer DEFAULT true NOT NULL,
	`video_retention_days` integer DEFAULT 30 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `progress_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text,
	`metrics` text NOT NULL,
	`baseline` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `progress_user_idx` ON `progress_snapshots` (`user_id`);--> statement-breakpoint
CREATE TABLE `provider_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`user_id` text,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`duration_ms` integer,
	`data` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_session_idx` ON `provider_events` (`session_id`);--> statement-breakpoint
CREATE INDEX `events_type_idx` ON `provider_events` (`type`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`interviewer_id` text,
	`seq` integer NOT NULL,
	`kind` text NOT NULL,
	`competency` text,
	`text` text NOT NULL,
	`difficulty` integer DEFAULT 2 NOT NULL,
	`parent_question_id` text,
	`decision_reason` text,
	`asked_at_ms` integer NOT NULL,
	`speech_end_ms` integer,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`interviewer_id`) REFERENCES `interviewers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `questions_session_idx` ON `questions` (`session_id`);--> statement-breakpoint
CREATE TABLE `resumes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text,
	`mime_type` text,
	`raw_text` text NOT NULL,
	`parsed` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `resumes_user_idx` ON `resumes` (`user_id`);--> statement-breakpoint
CREATE TABLE `signal_timelines` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`start_ms` integer NOT NULL,
	`samples` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `signals_session_idx` ON `signal_timelines` (`session_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer,
	`external_ref` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subs_user_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `transcript_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`speaker` text NOT NULL,
	`interviewer_id` text,
	`question_id` text,
	`answer_id` text,
	`text` text NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`source` text NOT NULL,
	`words` text,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `segments_session_idx` ON `transcript_segments` (`session_id`);--> statement-breakpoint
CREATE TABLE `usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text,
	`kind` text NOT NULL,
	`quantity` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `usage_user_idx` ON `usage_records` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`onboarded_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);