import { enrollments } from "@/lib/data"
import { EnrollmentsTable } from "@/components/enrollments-table"
import { PageHeader } from "@/components/page-header"

export default function EnrollmentsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Enrollments" },
        ]}
      />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Enrollments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage patient enrollments and claim submissions
          </p>
        </div>
        <EnrollmentsTable enrollments={enrollments} />
      </div>
    </>
  )
}
