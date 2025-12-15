import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isZen, setIsZen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUserId, setLastUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Reset state when user changes
    if (user?.id !== lastUserId) {
      setIsZen(false);
      setLoading(true);
      setLastUserId(user?.id || null);
    }

    const checkAdmin = async () => {
      if (authLoading) {
        if (isMounted) {
          setLoading(true);
        }
        return;
      }

      if (!user) {
        if (isMounted) {
          setLoading(false);
          setIsZen(false);
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
      }

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role, username")
          .eq("id", user.id)
          .single();

        if (!isMounted) return;

        if (error) {
          if (isMounted) {
            setIsZen(false);
            setLoading(false);
          }
          return;
        }

        // Check if role column exists, if not fallback to username check
        if (profile) {
          let adminStatus = false;
          if (profile.role) {
            // Trim and lowercase for comparison to handle any whitespace or case issues
            const role = String(profile.role).trim().toLowerCase();
            adminStatus = role === "zen";
          } else {
            // Fallback: check username if role column doesn't exist yet
            adminStatus = profile.username === "th3void";
          }
          
          // Set all states together in a batch to avoid race conditions
          if (isMounted) {
            setIsZen(adminStatus);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setIsZen(false);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;
        setIsZen(false);
        setLoading(false);
      }
    };

    checkAdmin();

    return () => {
      isMounted = false;
    };
  }, [user?.id, authLoading, lastUserId]); // Only depend on user.id, not the whole user object

  return { isZen, loading: loading || authLoading };
};

