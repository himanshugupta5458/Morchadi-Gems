/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildProductBreadcrumb } from "@/lib/breadcrumbs";
import { getAllProducts, getProductById } from "@/lib/products";
import { buildProductSchemaGraph, buildSiteSchemaGraph } from "@/lib/structured-data";
import { JsonLd } from "@/components/JsonLd";

const previousAppBaseUrl = process.env.APP_BASE_URL;

beforeEach(() => {
  process.env.APP_BASE_URL = "https://www.morchadigems.com";
});

afterEach(() => {
  cleanup();
  if (previousAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = previousAppBaseUrl;
});

function renderGraphScript(id: string, graph: Parameters<typeof JsonLd>[0]["graph"]) {
  const { container } = render(<JsonLd id={id} graph={graph} />);
  const script = container.querySelector(`script#${id}`);
  if (script === null) throw new Error("No JSON-LD script was rendered");
  return script;
}

describe("the JSON-LD script block", () => {
  it("is emitted as application/ld+json", () => {
    const script = renderGraphScript("site-schema", buildSiteSchemaGraph());

    expect(script.getAttribute("type")).toBe("application/ld+json");
  });

  it("parses back into the graph it was given, for the site nodes", () => {
    const graph = buildSiteSchemaGraph();
    const script = renderGraphScript("site-schema", graph);

    expect(JSON.parse(script.textContent ?? "")).toEqual(graph);
  });

  it("parses back into the graph it was given, for every product", () => {
    for (const product of getAllProducts()) {
      const graph = buildProductSchemaGraph(product, buildProductBreadcrumb(product));
      const script = renderGraphScript(`product-schema-${product.id}`, graph);

      expect(JSON.parse(script.textContent ?? ""), product.id).toEqual(graph);
      cleanup();
    }
  });

  it("escapes the characters that could close the script tag early", () => {
    const product = getProductById("P001");
    if (product === undefined) throw new Error("Fixture product P001 is missing");

    const hostileProduct = {
      ...product,
      name: '</script><img src=x onerror="alert(1)">',
    };
    const script = renderGraphScript(
      "product-schema-hostile",
      buildProductSchemaGraph(hostileProduct, buildProductBreadcrumb(hostileProduct)),
    );

    expect(script.innerHTML).not.toContain("</script");
    expect(script.innerHTML).not.toContain("<img");
    expect(JSON.parse(script.textContent ?? "")["@graph"][0].name).toBe(
      hostileProduct.name,
    );
  });
});
