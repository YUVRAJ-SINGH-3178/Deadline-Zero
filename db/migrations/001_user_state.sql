CREATE TABLE IF NOT EXISTS user_state (
  user_id text PRIMARY KEY,
  state jsonb NOT NULL DEFAULT '{"tasks":[],"availability":[],"history":[]}'::jsonb,
  revision bigint NOT NULL DEFAULT 0,
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_state_shape CHECK (jsonb_typeof(state) = 'object')
);
ALTER TABLE user_state ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
ALTER TABLE user_state ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS user_state_updated_at_idx ON user_state(updated_at);
