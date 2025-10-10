-- Create jobs table
create table public.jobs (
  id uuid not null default gen_random_uuid() primary key,
  title text not null,
  department text,
  description text,
  requirements text[],
  status text not null default 'active' check (status in ('active', 'closed', 'on_hold')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.jobs enable row level security;

create policy "Authenticated users can view jobs"
  on public.jobs for select
  to authenticated
  using (true);

create policy "Authenticated users can update jobs"
  on public.jobs for update
  to authenticated
  using (true);

-- Add job_id column to candidates table
alter table public.candidates 
add column job_id uuid references public.jobs(id) on delete set null;

-- Create trigger for automatic timestamp updates on jobs
create trigger update_jobs_updated_at
  before update on public.jobs
  for each row
  execute function public.update_updated_at_column();

-- Insert sample jobs
insert into public.jobs (title, department, description, requirements) values
  ('Frontend Developer', 'Engineering', 'Build beautiful user interfaces', ARRAY['React', 'TypeScript', 'CSS']),
  ('Full Stack Engineer', 'Engineering', 'Work on both frontend and backend systems', ARRAY['Node.js', 'React', 'PostgreSQL']),
  ('Product Manager', 'Product', 'Drive product strategy and roadmap', ARRAY['Agile', 'User Research', 'Communication']),
  ('DevOps Engineer', 'Engineering', 'Manage infrastructure and deployment pipelines', ARRAY['Docker', 'Kubernetes', 'AWS']),
  ('UX Designer', 'Design', 'Create exceptional user experiences', ARRAY['Figma', 'User Testing', 'Prototyping']);

-- Update existing candidates to link to jobs
update public.candidates set job_id = (
  select id from public.jobs where title = 'Frontend Developer' limit 1
) where role = 'Senior Frontend Developer';

update public.candidates set job_id = (
  select id from public.jobs where title = 'Full Stack Engineer' limit 1
) where role = 'Full Stack Engineer';

update public.candidates set job_id = (
  select id from public.jobs where title = 'Product Manager' limit 1
) where role = 'Product Manager';

update public.candidates set job_id = (
  select id from public.jobs where title = 'DevOps Engineer' limit 1
) where role = 'DevOps Engineer';

update public.candidates set job_id = (
  select id from public.jobs where title = 'UX Designer' limit 1
) where role = 'UX Designer';