import { createContext } from "react";

export const PUBLIC_ORIGIN = "https://www.thedanceexclusive.co.uk";
export interface PageMetadata {
  title: string;
  description: string;
  path: string;
  structuredData?: Record<string, unknown>;
  noindex?: boolean;
}
export const PageHeadContext = createContext<
  ((metadata: PageMetadata) => void) | null
>(null);
