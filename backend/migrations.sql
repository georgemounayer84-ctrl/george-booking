-- migrations.sql (ersätt befintlig)
create extension if not exists "uuid-ossp";

create table if not exists restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  org_number text,
  timezone text default 'Europe/Stockholm',
  created_at timestamptz default now()
);

create table if not exists roles (
  id serial primary key,
  name text unique not null
);

create table if not exists user_profiles (
  id uuid primary key, -- use auth.uid()
  email text,
  full_name text,
  created_at timestamptz default now()
);

create table if not exists user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  role_id int not null references roles(id),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists restaurant_tables (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text,
  seats int not null default 2
);

create table if not exists sittings (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists bookings (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  sitting_id uuid references sittings(id),
  created_by uuid references user_profiles(id),
  guest_name text,
  guest_email text,
  guest_phone text,
  covers int not null,
  status text not null default 'booked',
  reserved_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz default now(),
  notes text
);

create table if not exists booking_guests (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references bookings(id) on delete cascade,
  name text,
  email text,
  phone text
);

create index if not exists idx_bookings_restaurant_reserved on bookings (restaurant_id, reserved_at);
