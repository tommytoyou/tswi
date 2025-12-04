import { redirect } from 'next/navigation';

export default function AuroraPage() {
  redirect('/dashboard?tab=aurora');
}
