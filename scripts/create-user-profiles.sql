-- ============================================================
-- BG-Health v2 — Auth & Campaign Tables for Supabase
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('superuser', 'administrator', 'viewer')),
  national_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_profiles_username UNIQUE (username),
  CONSTRAINT uq_user_profiles_user_id UNIQUE (user_id)
);

-- RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for session lookup)
CREATE POLICY "Profiles readable by authenticated users" ON user_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Only superuser/admin can insert (handled via API with service role anyway)
CREATE POLICY "Service role can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Only superuser can delete
CREATE POLICY "Superuser can delete profiles" ON user_profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'superuser')
  );

-- 2. Health campaigns table
CREATE TABLE IF NOT EXISTS health_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  content text,
  author_id uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE health_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaigns readable by all" ON health_campaigns FOR SELECT USING (true);

CREATE POLICY "Campaigns manageable by admin" ON health_campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('superuser', 'administrator'))
);

-- 3. (Optional) Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_campaigns_updated_at
  BEFORE UPDATE ON health_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. CREATE SUPERUSER ACCOUNT
--    IMPORTANT: Do NOT hardcode credentials in application code.
--    The superuser account must ONLY be created via SQL in Supabase
--    or through the Supabase Dashboard. Never create it in app code.
--
--    Steps to create the superuser:
--    a) Go to Supabase Dashboard > Authentication > Users
--    b) Click "Add user" > "Create new user"
--    c) Enter the email (this serves as username for login)
--       and a strong password
--    d) After the user is created, copy the user's UUID from
--       the Users table
--    e) Run the INSERT below with the correct user_id UUID
--
--    Example (replace placeholders with actual values):
--
--    INSERT INTO user_profiles (user_id, username, full_name, role, national_id)
--    VALUES (
--      '<uuid-of-auth-user>',
--      'superuser@bg-health.com',
--      'Super Administrator',
--      'superuser',
--      NULL
--    );
--
--    SECURITY NOTES:
--    - Never share the superuser password in code, docs, or repos
--    - Use a strong, unique password (min 12 chars, mixed case, numbers, symbols)
--    - The password is only stored in Supabase Auth (bcrypt hashed)
--    - Application code only verifies sessions via supabase.auth.getUser()
--    - No credentials are ever hardcoded in .ts or .tsx files
-- ============================================================
