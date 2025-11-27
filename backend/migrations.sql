-- DB migrations for george-booking MVP
CREATE TABLE IF NOT EXISTS organizations (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, orgnr VARCHAR(50), created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id BIGSERIAL PRIMARY KEY, organization_id BIGINT REFERENCES organizations(id), name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurants (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES groups(id),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Stockholm',
  currency CHAR(3) NOT NULL DEFAULT 'SEK',
  default_session_length INT NOT NULL DEFAULT 150,
  default_clearing_buffer INT NOT NULL DEFAULT 30,
  slot_interval_minutes INT NOT NULL DEFAULT 15,
  max_capacity INT NOT NULL DEFAULT 50,
  booking_window_days INT NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, display_name TEXT, password_hash TEXT NOT NULL, phone TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (id SMALLINT PRIMARY KEY, name TEXT UNIQUE NOT NULL);
INSERT INTO roles (id,name) VALUES (1,'superadmin'),(2,'organization_admin'),(3,'group_manager'),(4,'restaurant_manager'),(5,'host') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS user_permissions (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id), role_id SMALLINT REFERENCES roles(id),
  scope_type TEXT NOT NULL, scope_id BIGINT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sittings (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT REFERENCES restaurants(id),
  day_of_week SMALLINT,
  date_set DATE,
  start_time TIME NOT NULL,
  max_duration_minutes INT NOT NULL,
  clearing_buffer_minutes INT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT REFERENCES restaurants(id),
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  party_size INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  source TEXT NOT NULL DEFAULT 'widget',
  requested_start TIMESTAMPTZ NOT NULL,
  requested_end TIMESTAMPTZ NOT NULL,
  checked_in BOOLEAN DEFAULT false,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_audit (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT REFERENCES bookings(id),
  action TEXT NOT NULL,
  actor TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
