type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function InspeccionDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <h1>Inspección {id}</h1>;
}
