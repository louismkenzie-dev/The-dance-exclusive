import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Publishable defaults so builds without env vars (e.g. Vercel *preview*
// deployments whose environment variables are scoped to Production only)
// still boot instead of white-screening on "supabaseUrl is required".
// These are client-shipped, RLS-protected values — safe to embed; real env
// vars always take precedence when present.
const FALLBACK_URL = 'https://suwaetnsszlpaaykhpif.supabase.co';
const FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_CSxQfkpN8Z_ps33PjUFMDg_3DiCSLJq';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_PUBLISHABLE_KEY;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    'Supabase env vars missing at build time — using embedded publishable fallbacks. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for this environment.',
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    // Safari on iPad/iPhone caches GET responses hard. The studio runs admin
    // on an iPad, where saving something and immediately re-reading it could
    // return Safari's copy from BEFORE the save — the screen then shows the
    // old value until the page is reloaded. Never serve these from cache:
    // every read is answered by the database.
    fetch: (input, init = {}) => fetch(input, { ...init, cache: "no-store" }),
  },
});
