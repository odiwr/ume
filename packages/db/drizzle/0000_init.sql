CREATE TYPE "public"."danger_action" AS ENUM('reset', 'purge');--> statement-breakpoint
CREATE TYPE "public"."invite_kind" AS ENUM('link', 'email');--> statement-breakpoint
CREATE TYPE "public"."membership_source" AS ENUM('owner', 'manual', 'invite_link', 'email_invite', 'discord_role_map', 'default_role');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'plus', 'pro', 'studio');--> statement-breakpoint
CREATE TYPE "public"."system_role" AS ENUM('owner', 'master', 'servant', 'peon');--> statement-breakpoint
CREATE TYPE "public"."workspace_status" AS ENUM('unclaimed', 'connected', 'disconnected', 'purging', 'purged');--> statement-breakpoint
CREATE TYPE "public"."added_via" AS ENUM('web', 'discord');--> statement-breakpoint
CREATE TYPE "public"."track_source" AS ENUM('upload', 'link');--> statement-breakpoint
CREATE TYPE "public"."track_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."activity_kind" AS ENUM('voice_join', 'voice_leave', 'command', 'play', 'web_action', 'bot_moved');--> statement-breakpoint
CREATE TYPE "public"."dmca_status" AS ENUM('received', 'actioned', 'counter_noticed', 'restored', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'discord_dm', 'discord_channel');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('inactivity_30d', 'inactivity_48h', 'purged', 'token_rotated', 'invite', 'quota_warning');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"discord_user_id" text,
	"discord_username" text,
	"discord_avatar" text,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_discord_user_id_unique" UNIQUE("discord_user_id")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"issued_to_discord_id" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by_user_id" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "claim_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "danger_confirmations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"action" "danger_action" NOT NULL,
	"code_hash" text NOT NULL,
	"requested_by_discord_id" text,
	"requested_by_user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_role_maps" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"discord_role_id" text NOT NULL,
	"discord_role_name" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" "invite_kind" NOT NULL,
	"token" text NOT NULL,
	"email" text,
	"role_id" text NOT NULL,
	"label" text,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"membership_expires_at" timestamp with time zone,
	"require_guild_member" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" text,
	"last_used_at" timestamp with time zone,
	"email_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"source" "membership_source" DEFAULT 'manual' NOT NULL,
	"invite_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#B3B3B3' NOT NULL,
	"capabilities" integer DEFAULT 0 NOT NULL,
	"system_key" "system_role",
	"position" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"ume_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"guild_name" text NOT NULL,
	"guild_icon" text,
	"guild_owner_discord_id" text,
	"owner_user_id" text,
	"status" "workspace_status" DEFAULT 'unclaimed' NOT NULL,
	"claimed_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"home_voice_channel_id" text,
	"notice_text_channel_id" text,
	"bot_connected" boolean DEFAULT false NOT NULL,
	"bot_last_seen_at" timestamp with time zone,
	"bot_voice_channel_id" text,
	"bot_in_guild" boolean DEFAULT false NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inactivity_notice_30d_sent_at" timestamp with time zone,
	"inactivity_notice_48h_sent_at" timestamp with time zone,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"storage_used_bytes" bigint DEFAULT 0 NOT NULL,
	"storage_quota_override_bytes" bigint,
	"track_count" integer DEFAULT 0 NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_status" text,
	"plan_renews_at" timestamp with time zone,
	"discord_role_sync_enabled" boolean DEFAULT true NOT NULL,
	"default_role_id" text,
	"link_extract_enabled" boolean DEFAULT true NOT NULL,
	"link_extract_accepted_at" timestamp with time zone,
	"link_extract_accepted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_ume_id_unique" UNIQUE("ume_id"),
	CONSTRAINT "workspaces_guild_id_unique" UNIQUE("guild_id"),
	CONSTRAINT "workspaces_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "workspaces_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "playlist_tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"playlist_id" text NOT NULL,
	"track_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"added_by_user_id" text,
	"added_by_discord_id" text,
	"added_via" "added_via" DEFAULT 'web' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"emoji" text,
	"color" text,
	"cover_storage_key" text,
	"position" integer DEFAULT 0 NOT NULL,
	"track_count" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" bigint DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"source" "track_source" NOT NULL,
	"status" "track_status" DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"album" text,
	"duration_ms" integer,
	"cover_storage_key" text,
	"cover_url" text,
	"storage_key" text,
	"original_storage_key" text,
	"original_filename" text,
	"original_mime_type" text,
	"original_size_bytes" bigint,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"sha256" text,
	"source_site" text,
	"source_id" text,
	"source_url" text,
	"source_author" text,
	"uploaded_by_user_id" text,
	"uploaded_by_discord_id" text,
	"added_via" "added_via" DEFAULT 'web' NOT NULL,
	"error_message" text,
	"play_count" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"discord_user_id" text,
	"user_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"actor_user_id" text,
	"actor_discord_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_hashes" (
	"sha256" text PRIMARY KEY NOT NULL,
	"reason" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dmca_notices" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"track_id" text,
	"claimant_name" text NOT NULL,
	"claimant_email" text NOT NULL,
	"claimant_address" text,
	"work_description" text NOT NULL,
	"infringing_url" text NOT NULL,
	"good_faith_statement" boolean DEFAULT false NOT NULL,
	"accuracy_statement" boolean DEFAULT false NOT NULL,
	"signature" text NOT NULL,
	"status" "dmca_status" DEFAULT 'received' NOT NULL,
	"notes" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"user_id" text,
	"kind" "notification_kind" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"recipient" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_tokens" ADD CONSTRAINT "claim_tokens_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_tokens" ADD CONSTRAINT "claim_tokens_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "danger_confirmations" ADD CONSTRAINT "danger_confirmations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_role_maps" ADD CONSTRAINT "discord_role_maps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_role_maps" ADD CONSTRAINT "discord_role_maps_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_link_extract_accepted_by_user_id_users_id_fk" FOREIGN KEY ("link_extract_accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_hashes" ADD CONSTRAINT "blocked_hashes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dmca_notices" ADD CONSTRAINT "dmca_notices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dmca_notices" ADD CONSTRAINT "dmca_notices_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accounts_provider_account_idx" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_discord_user_id_idx" ON "users" USING btree ("discord_user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "claim_tokens_guild_id_idx" ON "claim_tokens" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "danger_confirmations_workspace_idx" ON "danger_confirmations" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discord_role_maps_uq" ON "discord_role_maps" USING btree ("workspace_id","discord_role_id");--> statement-breakpoint
CREATE INDEX "invites_workspace_id_idx" ON "invites" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "invites_email_idx" ON "invites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_workspace_user_uq" ON "memberships" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_role_id_idx" ON "memberships" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "roles_workspace_id_idx" ON "roles" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_workspace_system_key_uq" ON "roles" USING btree ("workspace_id","system_key");--> statement-breakpoint
CREATE INDEX "workspaces_owner_user_id_idx" ON "workspaces" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "workspaces_status_idx" ON "workspaces" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workspaces_last_activity_idx" ON "workspaces" USING btree ("last_activity_at");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_tracks_uq" ON "playlist_tracks" USING btree ("playlist_id","track_id");--> statement-breakpoint
CREATE INDEX "playlist_tracks_track_id_idx" ON "playlist_tracks" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "playlist_tracks_workspace_idx" ON "playlist_tracks" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_workspace_slug_uq" ON "playlists" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "playlists_workspace_id_idx" ON "playlists" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "tracks_workspace_id_idx" ON "tracks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "tracks_status_idx" ON "tracks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_workspace_sha256_uq" ON "tracks" USING btree ("workspace_id","sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_workspace_source_uq" ON "tracks" USING btree ("workspace_id","source_site","source_id");--> statement-breakpoint
CREATE INDEX "activity_events_workspace_created_idx" ON "activity_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_workspace_created_idx" ON "audit_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "dmca_notices_status_idx" ON "dmca_notices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_workspace_kind_idx" ON "notifications" USING btree ("workspace_id","kind");