// Server-only. Never import this into a Client Component — it reads
// ADMIN_EMAILS from the environment, and while the check result (a
// boolean) is safe to pass to the client, the raw email list is not.
export function isAdminEmail(email) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return !!email && adminEmails.includes(email.toLowerCase());
}