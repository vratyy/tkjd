import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isActive: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, companyName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Check if user profile is active
  const checkUserActive = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("user_id", userId)
        .maybeSingle();
      
      const active = data?.is_active ?? true;
      setIsActive(active);
      
      // If user is deactivated, sign them out
      if (!active) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error("Error checking user active status:", error);
      setIsActive(true); // Default to active on error
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserActive(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserActive(session.user.id);
      } else {
        setIsActive(true);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // Check if the user is active after successful login
    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("user_id", data.user.id)
        .maybeSingle();
      
      if (profile?.is_active === false) {
        await supabase.auth.signOut();
        return { error: new Error("Váš účet bol deaktivovaný. Kontaktujte administrátora.") };
      }
    }
    
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, companyName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isActive, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
