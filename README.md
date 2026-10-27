# AI College Management & Learning System

Next.js app with Supabase Auth, role-based portals, and a public college site. Chat can run on local Ollama or Gemini. The public college assistant searches a Pinecone index.

## Install and run

You need Node.js 20 or newer, npm, and a new Supabase project.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` using the sections below, load the database, then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in at `/login`. Admins go to `/admin`, teachers to `/teacher`, and students to `/student`. Guests use `/` and `/guest`.

Restart `npm run dev` after you change `.env.local`.

## 1. Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open the project **Connect** dialog. It shows the project URL and the publishable key. You can also open **Project Settings → API Keys** and **Project Settings → Data API**.
3. Put these in `.env.local`:

| Dashboard value | `.env.local` name |
| --- | --- |
| Project URL, shaped like `https://abcdefgh.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key, starting with `sb_publishable_` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key, starting with `sb_secret_` | `SUPABASE_SERVICE_ROLE_KEY` |

The publishable key is safe in the browser. The secret key bypasses row-level security. Keep it only in `.env.local`, and do not put it in any `NEXT_PUBLIC_` variable.

Older projects show a long JWT instead. The legacy **anon** key goes in `NEXT_PUBLIC_SUPABASE_ANON_KEY` (leave the publishable line empty). The legacy **service_role** key goes in `SUPABASE_SERVICE_ROLE_KEY`. If the API Keys page has **Create new API keys**, create them and use the publishable and secret keys.

4. Turn off public sign-ups so visitors cannot create their own accounts: **Authentication → Sign In / Providers → Email →** disable **Allow new users to sign up**.
5. Open the **SQL Editor**. Paste and run [`supabase/setup/01_schema.sql`](supabase/setup/01_schema.sql). Wait until it finishes with no errors.
6. In a new query, paste and run [`supabase/setup/02_demo_data.sql`](supabase/setup/02_demo_data.sql).

Run both files once, on an empty project, in that order. They create the tables, storage buckets, policies, Riverside College demo data, and three logins. Password for all three is `Campus@2026`.

| Email | Role |
| --- | --- |
| `admin@riverside.academy` | admin |
| `teacher@riverside.academy` | teacher |
| `student@riverside.academy` | student |

The folder `supabase/migrations/` is the same schema split into the original change history. A new project should run the two setup files, not the migration folder one file at a time.

## 2. Ollama

Use this when `AI_PROVIDER=ollama`. There is no API key. The app talks to Ollama on the same computer.

1. Install Ollama from [ollama.com/download](https://ollama.com/download) and leave it running. On a Mac it stays in the menu bar. You can also start it with `ollama serve`.
2. Pull the chat model and the embedding model the app expects:

```bash
ollama pull qwen2.5:14b
ollama pull nomic-embed-text
```

`qwen2.5:14b` needs a machine with about 16 GB of memory. On a smaller machine, pull `qwen2.5:7b` instead and set `OLLAMA_MODEL=qwen2.5:7b`.

3. Set `.env.local` to:

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:14b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

`OLLAMA_BASE_URL` is the local Ollama server. `OLLAMA_MODEL` answers chat. `OLLAMA_EMBED_MODEL` embeds teacher study materials into Postgres. Check that Ollama is up with `ollama list` or by opening [http://127.0.0.1:11434](http://127.0.0.1:11434).

`127.0.0.1` only works when the Next.js server runs on the same machine as Ollama. A hosted deploy cannot reach that address.

## 3. Gemini

Use this when `AI_PROVIDER=gemini`. You can keep the Ollama lines in `.env.local`; they are ignored while Gemini is selected.

1. Open [aistudio.google.com/apikey](https://aistudio.google.com/apikey) with a Google account.
2. Choose **Create API key**, attach it to a Google Cloud project if asked, and copy the key.
3. Set `.env.local` to:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.5-flash-lite
```

`GEMINI_API_KEY` is the key from AI Studio. `GEMINI_MODEL` is the chat model. `gemini-3.5-flash-lite` is the default. To use another model, copy its id from the model list in Google AI Studio into `GEMINI_MODEL`.

Study-material embeddings use `gemini-embedding-001` automatically. That does not need another key or another variable. The Gemini key stays on the server. Do not rename it to `NEXT_PUBLIC_GEMINI_API_KEY`.

Switching between Ollama and Gemini is only the `AI_PROVIDER` line, then a restart of `npm run dev`.

## 4. Pinecone

The public college assistant stores passages in Pinecone and lets Pinecone embed them. This is separate from the Ollama or Gemini embeddings used for study materials. Create the index before college search or PDF upload will work.

1. Sign in at [app.pinecone.io](https://app.pinecone.io).
2. Open **API keys**, create a key, and copy it into `PINECONE_API_KEY`.
3. Create an index with **integrated embedding** (a document index, not a manual vector index):
   - **Name:** a short name such as `college`. Put that exact name in `PINECONE_INDEX`.
   - **Embedded field:** `chunk_text`. The name must match. The app writes passage text in that field and searches it.
   - **Model:** `llama-text-embed-v2` (the Pinecone default). Dimension and metric stay on the model defaults.
   - Cloud and region can be the region closest to you.
4. Wait until the index status is ready, then set:

```bash
PINECONE_API_KEY=your-key-here
PINECONE_INDEX=college
```

The app writes into a namespace named `college-ollama` or `college-gemini`, matching `AI_PROVIDER`. One index covers both. Extra fields such as `title` and `source` are stored with each passage and do not need to be declared on the index.

A classic index where you supply your own vectors will not work with this app. The embedded field has to be named `chunk_text`.

## Checks

```bash
npm run typecheck
npm run build
```
