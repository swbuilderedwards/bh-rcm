import { notFound } from "next/navigation"
import { getEnrollmentById } from "@/lib/supabase/queries"
import { EnrollmentDetail } from "@/components/enrollment-detail"
import { PageHeader } from "@/components/page-header"

export default async function EnrollmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const enrollment = await getEnrollmentById(id)

  if (!enrollment) {
    notFound()
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Enrollments", href: "/enrollments" },
          { label: enrollment.patientName },
        ]}
      />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {enrollment.patientName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {enrollment.product} &middot; {enrollment.organization}
          </p>
        </div>
        <EnrollmentDetail enrollment={enrollment} />
      </div>
    </>
  )
}
