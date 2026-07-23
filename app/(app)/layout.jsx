import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/isAdmin";
import AppHeader from "@/components/AppHeader";

export default async function AppGroupLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <AppHeader isAdmin={isAdminEmail(user?.email)} />
      {children}
    </>
  );
}