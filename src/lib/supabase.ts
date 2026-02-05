import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client only if environment variables are available
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
    if (!supabaseInstance) {
          if (!supabaseUrl || !supabaseAnonKey) {
                  console.warn('Missing Supabase environment variables - running in demo mode');
                  return null;
          }
          supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    }
    return supabaseInstance;
}

// Mock response for when Supabase is not configured
const mockResponse = { data: null, error: null, count: 0 };

// Export a proxy that safely handles missing client
export const supabase = new Proxy({} as SupabaseClient, {
    get(_, prop) {
          const client = getSupabaseClient();
          if (!client) {
                  return () => ({
                            select: () => Promise.resolve(mockResponse),
                            insert: () => Promise.resolve(mockResponse),
                            update: () => Promise.resolve(mockResponse),
                            delete: () => Promise.resolve(mockResponse),
                  });
          }
          const value = client[prop as keyof SupabaseClient];
          if (typeof value === 'function') {
                  return value.bind(client);
          }
          return value;
    }
});

// Server-side client with service role (for API routes)
export function createServerClient(): SupabaseClient | null {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
        console.warn('Missing NEXT_PUBLIC_SUPABASE_URL');
        return null;
  }

  if (serviceRoleKey) {
        return createClient(supabaseUrl, serviceRoleKey);
  }

  if (!supabaseAnonKey) {
        console.warn('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
        return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
