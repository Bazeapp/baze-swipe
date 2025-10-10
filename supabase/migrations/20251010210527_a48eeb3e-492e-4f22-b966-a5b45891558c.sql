-- Create profiles table for users
create table public.profiles (
  id uuid not null references auth.users on delete cascade primary key,
  email text,
  full_name text,
  created_at timestamp with time zone not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Create function to handle new user signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create candidates table
create table public.candidates (
  id uuid not null default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  role text not null,
  experience_years integer,
  skills text[],
  location text,
  phone text,
  linkedin_url text,
  resume_url text,
  status text not null default 'pending',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.candidates enable row level security;

create policy "Authenticated users can view candidates"
  on public.candidates for select
  to authenticated
  using (true);

create policy "Authenticated users can update candidates"
  on public.candidates for update
  to authenticated
  using (true);

-- Create decisions table
create table public.decisions (
  id uuid not null default gen_random_uuid() primary key,
  candidate_id uuid references public.candidates(id) on delete cascade not null,
  recruiter_id uuid references public.profiles(id) on delete cascade not null,
  decision text not null check (decision in ('pass', 'no_pass')),
  rejection_reason text,
  created_at timestamp with time zone not null default now()
);

alter table public.decisions enable row level security;

create policy "Users can view their own decisions"
  on public.decisions for select
  to authenticated
  using (auth.uid() = recruiter_id);

create policy "Users can create their own decisions"
  on public.decisions for insert
  to authenticated
  with check (auth.uid() = recruiter_id);

-- Create function to update timestamps
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger for automatic timestamp updates on candidates
create trigger update_candidates_updated_at
  before update on public.candidates
  for each row
  execute function public.update_updated_at_column();

-- Insert some sample candidates for testing
insert into public.candidates (name, email, role, experience_years, skills, location, phone) values
  ('Sarah Johnson', 'sarah.j@email.com', 'Senior Frontend Developer', 5, ARRAY['React', 'TypeScript', 'Next.js', 'CSS'], 'San Francisco, CA', '+1-555-0101'),
  ('Michael Chen', 'mchen@email.com', 'Full Stack Engineer', 3, ARRAY['Node.js', 'Python', 'PostgreSQL', 'AWS'], 'Austin, TX', '+1-555-0102'),
  ('Emily Rodriguez', 'emily.r@email.com', 'Product Manager', 7, ARRAY['Agile', 'Roadmapping', 'User Research'], 'New York, NY', '+1-555-0103'),
  ('David Kim', 'david.kim@email.com', 'DevOps Engineer', 4, ARRAY['Docker', 'Kubernetes', 'CI/CD', 'Terraform'], 'Seattle, WA', '+1-555-0104'),
  ('Jessica Taylor', 'jtaylor@email.com', 'UX Designer', 6, ARRAY['Figma', 'User Testing', 'Wireframing', 'Prototyping'], 'Chicago, IL', '+1-555-0105');