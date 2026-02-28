import { notFound } from "next/navigation"
import { getEnrollmentById, enrollments } from "@/lib/data"
import { EnrollmentDetail } from "@/components/enrollment-detail"
import { PageHeader } from "@/components/page-header"

export function generateStaticParams() {
  return enrollments.map((e) => ({ id: e.id }))
}

export default async function EnrollmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const enrollment = getEnrollmentById(id)

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
            {enrollment.id} &middot; {enrollment.product} &middot;{" "}
            {enrollment.organization}
          </p>
        </div>
        <EnrollmentDetail enrollment={enrollment} />
      </div>
    </>
  )
}
