import AppHeader from "@/components/AppHeader";

export default function AppGroupLayout({ children }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}