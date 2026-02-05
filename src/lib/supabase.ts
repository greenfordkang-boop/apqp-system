import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client - uses placeholder if env vars missing (will fail gracefully on API calls)
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Missing Supabase environment variables - using placeholder');
      // Create with placeholder to avoid null type issues - API calls will fail gracefully
      supabaseInstance = createClient('https://placeholder.supabase.co', 'placeholder-key');
    } else {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return supabaseInstance;
}

// Export the client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = client[prop as keyof SupabaseClient];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Server-side client with service role (for API routes)
export function createServerClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.warn('Missing NEXT_PUBLIC_SUPABASE_URL - using placeholder');
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  if (serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey);
  }

  if (!supabaseAnonKey) {
    console.warn('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY - using placeholder');
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
