CREATE TABLE `board_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`theme` varchar(255) NOT NULL DEFAULT '2026優良護理人員',
	`department` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`achievement` text NOT NULL,
	`photoUrl` text,
	`templateId` int NOT NULL DEFAULT 1,
	`boardImageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `board_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `theme_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `theme_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `theme_settings_key_unique` UNIQUE(`key`)
);
