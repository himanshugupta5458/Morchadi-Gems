import type { SchemaGraph } from "@/lib/structured-data";

export interface JsonLdProps {
  id: string;
  graph: SchemaGraph;
}

/**
 * `</script>` inside a JSON string would close this tag early and hand the rest of the
 * payload to the HTML parser. Escaping the three characters that can start such a sequence
 * keeps the JSON valid — `<` and friends parse back to the same string — and means no
 * product name or review body can break the page.
 */
function serialiseGraph(graph: SchemaGraph): string {
  return JSON.stringify(graph)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/**
 * One `application/ld+json` block per page, holding a `@graph` rather than a script tag per
 * type. Nodes reference each other by `@id` across blocks, so the product page's `seller` can
 * point at the Organization the layout published.
 */
export function JsonLd({ id, graph }: JsonLdProps): JSX.Element {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialiseGraph(graph) }}
    />
  );
}
