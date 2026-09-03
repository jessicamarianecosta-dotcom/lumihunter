# Demo seed — LumiLife Gráfica

`demo_seed.sql` recreates the fictitious "showroom" dataset used to present
LumiHunter AI, for a single company called **LumiLife Gráfica**. It is DML
only — it never creates or alters tables, columns, RLS policies, functions,
triggers, or indexes.

## Running it

```bash
# Via the Supabase CLI, against your project's DB connection string:
psql "$SUPABASE_DB_URL" -f supabase/seed/demo_seed.sql
```

Or paste its contents into the SQL editor / run via an MCP `execute_sql`-style
tool against your project.

## Before running

Read the header comment inside `demo_seed.sql` — it documents:

- The company id and demo-user id the script assumes (edit them if yours differ).
- That it assumes the company and its auto-seeded rows (pipeline stages, AI
  agents, subscription) already exist.
- That every insert uses a fixed UUID with `ON CONFLICT (id) DO NOTHING`, so
  re-running it is safe and will not duplicate rows — but it is not a
  "reset": to fully recreate the environment, delete the company's existing
  domain data first (cascades handle the rest), then run this file.
- That the demo login (`demo@lumihunter.com`) is a separate, manual step —
  its password is intentionally never committed to this repository.

## What it seeds

Products, leads (across every pipeline stage), activities, conversations,
messages, ICP profiles, knowledge base entries, message templates,
campaigns + targets, tasks, and notes — all fictitious. No real names,
phone numbers, or emails, and running this script never sends a real
message anywhere.
