-- Add password reset token columns to team_members and admins

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS reset_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS reset_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_team_members_reset_token ON team_members (reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admins_reset_token ON admins (reset_token) WHERE reset_token IS NOT NULL;
