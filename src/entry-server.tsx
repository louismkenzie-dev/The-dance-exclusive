import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import App from "./App";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicSchool, type PublicSchool } from "@/lib/publicSchool";
import {
  escapeMarkup,
  isBookingAppPath,
  publicRouteStatus,
  safeJson,
  sitemapXml,
} from "@/lib/publicRouting";
import {
  PageHeadContext,
  PUBLIC_ORIGIN,
  type PageMetadata,
} from "@/components/marketing/PageHeadContext";

function headHtml(meta: PageMetadata) {
  const title = escapeMarkup(`${meta.title} | The Dance Exclusive`);
  const description = escapeMarkup(meta.description);
  const canonical = escapeMarkup(PUBLIC_ORIGIN + meta.path);
  return `<title>${title}</title><meta name="description" content="${description}"><meta name="robots" content="${meta.noindex ? "noindex,follow" : "index,follow"}"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}">${meta.structuredData ? `<script id="tde-page-schema" type="application/ld+json">${safeJson(meta.structuredData)}</script>` : ""}`;
}

async function renderApp(url: string, school: PublicSchool, updatedAt: number) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["public-school"], school, { updatedAt });
  let metadata: PageMetadata = {
    title: "The Dance Exclusive",
    description: "Dance classes in Essex.",
    path: new URL(url, PUBLIC_ORIGIN).pathname,
    noindex: true,
  };
  const Router = ({ children }: { children: ReactNode }) => (
    <StaticRouter location={url}>{children}</StaticRouter>
  );
  const html = await new Promise<string>((resolve, reject) => {
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    let renderError: unknown;
    output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    output.on("error", reject);
    output.on("end", () => {
      clearTimeout(timeout);
      if (renderError) reject(renderError);
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    const stream = renderToPipeableStream(
      <PageHeadContext.Provider
        value={(value) => {
          metadata = value;
        }}
      >
        <App queryClient={queryClient} Router={Router} />
      </PageHeadContext.Provider>,
      {
        onAllReady() {
          stream.pipe(output);
        },
        onShellError(error) {
          clearTimeout(timeout);
          reject(error);
        },
        onError(error) {
          renderError = error;
        },
      },
    );
    const timeout = setTimeout(() => {
      stream.abort();
      reject(new Error("Public page render timed out"));
    }, 10_000);
  });
  queryClient.clear();
  return { html, metadata };
}

/** Same anonymous data and components for visitors and crawlers. Never read a session here. */
export async function renderPublicRequest(url: string, template: string) {
  const request = new URL(url, PUBLIC_ORIGIN);
  const path = request.pathname.replace(/\/$/, "") || "/";
  if (isBookingAppPath(path))
    return {
      status: 200,
      body: template,
      contentType: "text/html; charset=utf-8",
      cache: "private, no-store",
      noindex: true,
    };
  const school = await fetchPublicSchool(supabase);
  const updatedAt = Date.now();
  if (path === "/sitemap.xml")
    return {
      status: 200,
      body: sitemapXml(school, PUBLIC_ORIGIN),
      contentType: "application/xml; charset=utf-8",
      cache: "public, max-age=0, s-maxage=60, must-revalidate",
      noindex: false,
    };
  const status = publicRouteStatus(path, school);
  const { html, metadata } = await renderApp(
    path + request.search,
    school,
    updatedAt,
  );
  if (status === 404) metadata.noindex = true;
  const body = template
    .replace(
      /<!--public-head:start-->[\s\S]*?<!--public-head:end-->/,
      headHtml(metadata),
    )
    .replace(
      '<div id="root"><!--app-html--></div>',
      `<div id="root" data-ssr="true">${html}</div>`,
    )
    .replace(
      "<!--public-state-->",
      `<script id="tde-public-data" type="application/json">${safeJson({ school, updatedAt })}</script>`,
    );
  return {
    status,
    body,
    contentType: "text/html; charset=utf-8",
    cache:
      status === 200
        ? "public, max-age=0, s-maxage=60, must-revalidate"
        : "no-store",
    noindex: status === 404 || !!metadata.noindex,
  };
}
