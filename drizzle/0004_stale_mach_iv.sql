ALTER TABLE `applications` ADD `profile_id` integer REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `profiles` ADD `profile_name` text DEFAULT 'Default Profile' NOT NULL;