
import { getApplication } from '@/lib/actions';
import { notFound } from 'next/navigation';
import ApplicationClient from './client';

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: idString } = await params;
    const id = parseInt(idString);
    if (isNaN(id)) notFound();

    const application = await getApplication(id);

    if (!application) notFound();

    return <ApplicationClient initialApplication={application} />;
}
