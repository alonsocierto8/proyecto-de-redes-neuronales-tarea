create extension if not exists pgcrypto;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  storage_key text not null,
  image_count integer not null default 0 check (image_count >= 0),
  class_names jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.architectures (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  family text not null default 'CNN' check (family = 'CNN'),
  config jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (project_id, name, version)
);

create table public.training_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  architecture_id uuid not null references public.architectures (id) on delete restrict,
  dataset_id uuid not null references public.datasets (id) on delete restrict,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'PREPARING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  progress real not null default 0 check (progress between 0 and 100),
  parameters jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.training_metrics (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.training_jobs (id) on delete cascade,
  epoch integer not null check (epoch > 0),
  metric_name text not null,
  metric_value double precision not null,
  recorded_at timestamptz not null default now(),
  unique (job_id, epoch, metric_name)
);

create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  job_id uuid not null references public.training_jobs (id) on delete restrict,
  version integer not null check (version > 0),
  storage_key text not null,
  checksum text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'REVIEW', 'APPROVED', 'RETIRED')),
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create index projects_owner_idx on public.projects (owner_id);
create index datasets_project_idx on public.datasets (project_id);
create index architectures_project_idx on public.architectures (project_id);
create index training_jobs_project_created_idx on public.training_jobs (project_id, created_at desc);
create index training_metrics_job_epoch_idx on public.training_metrics (job_id, epoch);
create index model_versions_project_idx on public.model_versions (project_id, version desc);

alter table public.projects enable row level security;
alter table public.datasets enable row level security;
alter table public.architectures enable row level security;
alter table public.training_jobs enable row level security;
alter table public.training_metrics enable row level security;
alter table public.model_versions enable row level security;

create policy "Owners manage projects"
  on public.projects for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Project owners manage datasets"
  on public.datasets for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));

create policy "Project owners manage architectures"
  on public.architectures for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));

create policy "Project owners manage training jobs"
  on public.training_jobs for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
    and exists (select 1 from public.architectures a where a.id = architecture_id and a.project_id = project_id)
    and exists (select 1 from public.datasets d where d.id = dataset_id and d.project_id = project_id)
  );

create policy "Project owners read training metrics"
  on public.training_metrics for select
  using (exists (
    select 1 from public.training_jobs j
    join public.projects p on p.id = j.project_id
    where j.id = job_id and p.owner_id = (select auth.uid())
  ));

create policy "Project owners manage model versions"
  on public.model_versions for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
    and exists (select 1 from public.training_jobs j where j.id = job_id and j.project_id = project_id)
  );