"use client";

import Link from "next/link";

export default function CompanyHome({ params }: { params: { companyId: string } }) {
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Company Workspace</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>Company ID: {params.companyId}</p>

      <div style={{ marginTop: 16 }}>
        <Link href={`/${params.companyId}/admin/users`}>Go to User Management</Link>
      </div>
    </div>
  );
}
