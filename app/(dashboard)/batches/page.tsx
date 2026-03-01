import { getBatches } from "@/lib/supabase/queries"
import { BatchesTable } from "@/components/batches-table"
import { PageHeader } from "@/components/page-header"

export default async function BatchesPage() {
  const batches = await getBatches()

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Batches" },
        ]}
      />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Batches
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View submitted claim batches and NCPDP data
          </p>
        </div>
        <BatchesTable batches={batches} />
      </div>
    </>
  )
}
