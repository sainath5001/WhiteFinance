import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/components/shared/demo-banner";

const docs = [
  { href: "/docs#", title: "architecture.md", note: "System design" },
  { href: "/docs#", title: "business-logic.md", note: "Journeys and accounting" },
  { href: "/docs#", title: "api-specification.md", note: "API surface" },
  { href: "/docs#", title: "frontend-specification.md", note: "UI rules" },
  { href: "/docs#", title: "relayer.md", note: "Gasless relayer" },
  { href: "/docs#", title: "backend.md", note: "Backend completion" },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <DemoBanner />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back</Link>
        </Button>
        <h1 className="mt-6 text-3xl font-semibold">Documentation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Specs live in the repository <code className="font-mono">docs/</code> folder. This page is
          a directory, not a second CMS.
        </p>
        <ul className="mt-8 space-y-3">
          {docs.map((d) => (
            <li key={d.title} className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="font-mono text-sm">{d.title}</div>
              <div className="text-xs text-muted-foreground">{d.note}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
