CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`email` text,
	`phone` text,
	`linkedin` text,
	`website` text,
	`summary` text,
	`skills` text,
	`experience` text,
	`education` text,
	`projects` text,
	`certifications` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`user_id` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `applications` ADD `cover_letter` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `analysis` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `selected_certifications` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `date_applied` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `user_id` integer REFERENCES users(id);