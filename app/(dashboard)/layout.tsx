import { TopNav } from '@/components/navigation/top-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 p-6 bg-slate-950">
        {children}
      </main>
    </div>
  );
}
