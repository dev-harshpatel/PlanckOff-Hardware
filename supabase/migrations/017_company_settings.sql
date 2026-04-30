-- 017_company_settings.sql
-- One row per user storing their company branding & contact details.
-- Security is enforced at the API layer (withAuth); admin client bypasses RLS.

CREATE TABLE IF NOT EXISTS company_settings (
  user_id      UUID        PRIMARY KEY,
  company_name TEXT        NOT NULL DEFAULT '',
  website_url  TEXT        NOT NULL DEFAULT '',
  address      TEXT        NOT NULL DEFAULT '',
  country      TEXT        NOT NULL DEFAULT '',
  province     TEXT        NOT NULL DEFAULT '',
  phone        TEXT        NOT NULL DEFAULT '',
  email        TEXT        NOT NULL DEFAULT '',
  logo_url     TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_settings_user_idx ON company_settings (user_id);
