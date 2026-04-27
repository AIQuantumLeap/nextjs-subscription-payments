-- OutreachOS: AI-powered email outreach platform

CREATE TABLE outreach_personas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  company_name          TEXT NOT NULL,
  product_description   TEXT NOT NULL,
  industry              TEXT NOT NULL,
  tone                  TEXT NOT NULL CHECK (tone IN ('formal','conversational','technical')),
  value_propositions    TEXT[]  NOT NULL DEFAULT '{}',
  objections            JSONB   NOT NULL DEFAULT '[]',
  icp                   JSONB   NOT NULL DEFAULT '{}',
  qualification_criteria JSONB  NOT NULL DEFAULT '[]',
  is_active             BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gmail_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email         TEXT NOT NULL,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outreach_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id     UUID REFERENCES outreach_personas(id) ON DELETE SET NULL,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  company        TEXT,
  job_title      TEXT,
  context_fields JSONB DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'not_contacted' CHECK (
    status IN ('not_contacted','in_conversation','qualified','disqualified','handed_off','unsubscribed')
  ),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE TABLE outreach_conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID NOT NULL REFERENCES outreach_leads(id) ON DELETE CASCADE,
  gmail_thread_id     TEXT,
  exchange_count      INTEGER DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active','completed','paused','handed_off')
  ),
  qualification_answers JSONB DEFAULT '{}',
  last_processed_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outreach_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES outreach_conversations(id) ON DELETE CASCADE,
  direction         TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  subject           TEXT,
  body              TEXT NOT NULL,
  gmail_message_id  TEXT,
  sent_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outreach_handoffs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID NOT NULL REFERENCES outreach_leads(id) ON DELETE CASCADE,
  conversation_id       UUID NOT NULL REFERENCES outreach_conversations(id),
  summary               TEXT NOT NULL,
  qualification_answers JSONB DEFAULT '{}',
  recommended_next_step TEXT,
  notified_at           TIMESTAMPTZ,
  acknowledged          BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outreach_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  handoff_email       TEXT,
  active_days         INTEGER[] DEFAULT '{1,2,3,4,5}',
  active_hours_start  INTEGER DEFAULT 8,
  active_hours_end    INTEGER DEFAULT 18,
  timezone            TEXT DEFAULT 'America/New_York',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outreach_usage (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month                 DATE NOT NULL,
  contacts_reached      INTEGER DEFAULT 0,
  conversations_active  INTEGER DEFAULT 0,
  leads_qualified       INTEGER DEFAULT 0,
  leads_disqualified    INTEGER DEFAULT 0,
  handoffs_made         INTEGER DEFAULT 0,
  meetings_booked       INTEGER DEFAULT 0,
  UNIQUE(user_id, month)
);

CREATE INDEX outreach_leads_user_id        ON outreach_leads(user_id);
CREATE INDEX outreach_leads_persona_id     ON outreach_leads(persona_id);
CREATE INDEX outreach_leads_status         ON outreach_leads(status);
CREATE INDEX outreach_conversations_lead   ON outreach_conversations(lead_id);
CREATE INDEX outreach_conversations_status ON outreach_conversations(status);
CREATE INDEX outreach_messages_conv        ON outreach_messages(conversation_id);
CREATE INDEX outreach_handoffs_lead        ON outreach_handoffs(lead_id);

ALTER TABLE outreach_personas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_connections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_handoffs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_usage          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personas:owner"      ON outreach_personas      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "gmail:owner"         ON gmail_connections       USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "leads:owner"         ON outreach_leads          USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "conversations:owner" ON outreach_conversations  USING (lead_id IN (SELECT id FROM outreach_leads WHERE user_id = auth.uid()));
CREATE POLICY "messages:owner"      ON outreach_messages       USING (
  conversation_id IN (
    SELECT c.id FROM outreach_conversations c
    JOIN outreach_leads l ON l.id = c.lead_id
    WHERE l.user_id = auth.uid()
  )
);
CREATE POLICY "handoffs:owner"  ON outreach_handoffs  USING (lead_id IN (SELECT id FROM outreach_leads WHERE user_id = auth.uid()));
CREATE POLICY "settings:owner"  ON outreach_settings  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "usage:owner"     ON outreach_usage     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION increment_outreach_usage(p_user_id UUID, p_field TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO outreach_usage (user_id, month)
  VALUES (p_user_id, date_trunc('month', NOW())::date)
  ON CONFLICT (user_id, month) DO NOTHING;

  EXECUTE format(
    'UPDATE outreach_usage SET %I = %I + 1 WHERE user_id = $1 AND month = date_trunc(''month'', NOW())::date',
    p_field, p_field
  ) USING p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
