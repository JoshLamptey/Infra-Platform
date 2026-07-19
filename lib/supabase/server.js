import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client. Reads/writes the auth session via cookies so
// Row Level Security policies can key off auth.uid() on every request.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request context to
            // mutate — safe to ignore since middleware refreshes sessions.
          }
        },
      },
    }
  );
}
