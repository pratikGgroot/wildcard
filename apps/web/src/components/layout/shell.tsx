import { Sidebar } from "./sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pl-60 min-h-screen bg-slate-50">
        {children}
      </main>
    </div>
  );
}
