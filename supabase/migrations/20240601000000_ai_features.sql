-- AI Vision SaaS: Sessions, Results, and Usage Tables

-- AI processing sessions (one per camera/analysis session)
CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (
    session_type IN (
      'object_detection',
      'classification',
      'barcode',
      'image_processing',
      'description',
      'feature_extraction',
      'batch'
    )
  ),
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'completed', 'error')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- AI detection/processing results (one row per detection event)
CREATE TABLE IF NOT EXISTS ai_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result_type TEXT NOT NULL CHECK (
    result_type IN (
      'object',
      'classification',
      'barcode',
      'description',
      'edge_map',
      'threshold',
      'feature_point',
      'color_analysis'
    )
  ),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- SHA-256 hash of the frame (privacy: we store hash, not image)
  image_hash TEXT,
  confidence REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API usage tracking for rate limiting by subscription tier
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  endpoint TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, usage_date, endpoint)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS ai_sessions_user_id_idx ON ai_sessions (user_id);
CREATE INDEX IF NOT EXISTS ai_sessions_created_at_idx ON ai_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_results_session_id_idx ON ai_results (session_id);
CREATE INDEX IF NOT EXISTS ai_results_user_id_idx ON ai_results (user_id);
CREATE INDEX IF NOT EXISTS ai_results_created_at_idx ON ai_results (created_at DESC);
CREATE INDEX IF NOT EXISTS api_usage_user_date_idx ON api_usage (user_id, usage_date);

-- Enable Row Level Security
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
CREATE POLICY "Users can view own sessions"
  ON ai_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON ai_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON ai_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON ai_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own results"
  ON ai_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own results"
  ON ai_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own results"
  ON ai_results FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage"
  ON api_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON api_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON api_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to increment API usage atomically
CREATE OR REPLACE FUNCTION increment_api_usage(
  p_user_id UUID,
  p_endpoint TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO api_usage (user_id, usage_date, endpoint, count)
  VALUES (p_user_id, CURRENT_DATE, p_endpoint, 1)
  ON CONFLICT (user_id, usage_date, endpoint)
  DO UPDATE SET count = api_usage.count + 1;
END;
$$;

-- Function to get today's API usage for a user/endpoint
CREATE OR REPLACE FUNCTION get_api_usage_today(
  p_user_id UUID,
  p_endpoint TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COALESCE(count, 0) INTO v_count
  FROM api_usage
  WHERE user_id = p_user_id
    AND usage_date = CURRENT_DATE
    AND endpoint = p_endpoint;
  RETURN COALESCE(v_count, 0);
END;
$$;
