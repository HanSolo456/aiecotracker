import { redirect } from 'next/navigation';

export default async function DppShareRedirectPage({
    params,
}: {
    params: Promise<{ passportId: string }>;
}) {
    const { passportId } = await params;
    redirect(`/passport?id=${encodeURIComponent(passportId)}`);
}
