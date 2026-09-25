import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicSchool } from "@/lib/publicSchool";

export function usePublicSchool() {
  return useQuery({
    queryKey: ["public-school"],
    queryFn: () => fetchPublicSchool(supabase),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
