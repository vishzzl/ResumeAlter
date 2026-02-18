CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_url` text NOT NULL,
	`job_title` text,
	`company_name` text,
	`job_description` text NOT NULL,
	`job_details` text,
	`base_resume` text,
	`tailored_resume` text,
	`status` text DEFAULT 'draft',
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
