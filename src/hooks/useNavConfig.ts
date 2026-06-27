import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_NAV_CONFIG, NAV_SETTINGS_KEY, NavItem } from "@/config/adminNavConfig";

export const useNavConfig = () => {
  const queryClient = useQueryClient();

  const { data: navConfig, isLoading } = useQuery({
    queryKey: ["nav-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", NAV_SETTINGS_KEY)
        .maybeSingle();

      if (error) throw error;
      if (data?.value) {
        try {
          return JSON.parse(data.value) as NavItem[];
        } catch {
          return DEFAULT_NAV_CONFIG;
        }
      }
      return DEFAULT_NAV_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["nav-config"] });

  return {
    navConfig: navConfig || DEFAULT_NAV_CONFIG,
    isLoading,
    invalidate,
  };
};
