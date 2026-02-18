import { getApplications } from '@/lib/actions';
import KanbanBoard from '@/components/KanbanBoard';

export default async function Dashboard() {
  const applications = await getApplications();

  return (
    <div className="h-[calc(100vh-6rem)]">
      <KanbanBoard initialApplications={applications} />
    </div>
  );
}

