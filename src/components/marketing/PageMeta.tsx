import { useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  PageHeadContext,
  PUBLIC_ORIGIN,
  type PageMetadata,
} from "./PageHeadContext";

export function PageMeta({
  title,
  description,
  path,
  structuredData,
  noindex = false,
}: PageMetadata) {
  const collect = useContext(PageHeadContext);
  // Request-local collection during server rendering; no shared head state.
  collect?.({ title, description, path, structuredData, noindex });
  const structured = structuredData ? JSON.stringify(structuredData) : "";
  useEffect(() => {
    document.title = `${title} | The Dance Exclusive`;
    const set = (
      attribute: "name" | "property",
      key: string,
      value: string,
    ) => {
      let meta = document.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${key}"]`,
      );
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attribute, key);
        document.head.append(meta);
      }
      meta.content = value;
    };
    set("name", "description", description);
    set("property", "og:title", document.title);
    set("property", "og:description", description);
    set("property", "og:url", `${PUBLIC_ORIGIN}${path}`);
    set("name", "twitter:title", document.title);
    set("name", "twitter:description", description);
    set("name", "robots", noindex ? "noindex,follow" : "index,follow");
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = `${PUBLIC_ORIGIN}${path}`;
    const old = document.getElementById("tde-page-schema");
    old?.remove();
    if (structured) {
      const script = document.createElement("script");
      script.id = "tde-page-schema";
      script.type = "application/ld+json";
      script.textContent = structured;
      document.head.append(script);
    }
    return () => {
      document.getElementById("tde-page-schema")?.remove();
    };
  }, [title, description, path, structured, noindex]);
  return null;
}

const titles: Record<string, string> = {
  "/": "Dance classes in Essex",
  "/about": "Our school",
  "/schools": "Dance in schools",
  "/team": "Meet the team",
  "/venues": "Our locations",
  "/events": "Camps & workshops",
  "/classes": "Find your dance class",
  "/contact": "Get in touch",
  "/gallery": "Life at The Dance Exclusive",
  "/results": "Results & awards",
  "/info": "Parent information",
  "/parties": "Dance parties",
  "/shop": "The Dance Exclusive shop",
  "/term-dates": "Term dates",
};

/** Resets metadata when leaving an entity page, including private app routes. */
export function DefaultPageMeta() {
  const { pathname } = useLocation();
  return (
    <PageMeta
      title={titles[pathname] || "Your dance journey"}
      description="Commercial and street dance for children and adults across Essex. Find your class with The Dance Exclusive."
      path={pathname}
      noindex={!titles[pathname]}
      structuredData={
        pathname === "/"
          ? {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "The Dance Exclusive",
              url: PUBLIC_ORIGIN,
              logo: `${PUBLIC_ORIGIN}/og-image.png`,
              areaServed: { "@type": "AdministrativeArea", name: "Essex, UK" },
            }
          : undefined
      }
    />
  );
}
