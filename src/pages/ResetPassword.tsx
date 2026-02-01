import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { Building2, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Check if user came from a password reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasSession(true);
      } else {
        // No session - redirect to auth
        toast({
          variant: "destructive",
          title: "Neplatný odkaz",
          description: "Odkaz na obnovenie hesla vypršal alebo je neplatný.",
        });
        navigate("/");
      }
    };
    
    checkSession();
  }, [navigate, toast]);

  const validatePassword = (pwd: string): boolean => {
    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;
    return pwd.length >= 8 && specialCharRegex.test(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePassword(password)) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Heslo musí mať aspoň 8 znakov a jeden špeciálny znak.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Heslá sa nezhodujú.",
      });
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    } else {
      setIsSuccess(true);
      toast({
        title: "Heslo zmenené",
        description: "Vaše heslo bolo úspešne zmenené.",
      });
      // Sign out and redirect to login after 2 seconds
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/");
      }, 2000);
    }

    setIsLoading(false);
  };

  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo and branding */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">TKJD APP</h1>
            <p className="text-muted-foreground mt-1">Evidencia výkonov pre subdodávateľov</p>
          </div>

          <Card className="border-border shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-center">Nové heslo</CardTitle>
              <CardDescription className="text-center">
                Zadajte nové heslo pre váš účet
              </CardDescription>
            </CardHeader>

            <CardContent>
              {isSuccess ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
                  <p className="text-foreground font-medium">Heslo bolo úspešne zmenené!</p>
                  <p className="text-muted-foreground text-sm mt-2">
                    Presmerovávame vás na prihlásenie...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nové heslo</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Min. 8 znakov"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={8}
                    />
                    <p className="text-xs text-muted-foreground">
                      Heslo musí mať aspoň 8 znakov a jeden špeciálny znak.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Potvrďte heslo</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Zopakujte heslo"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={8}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Mením heslo...
                      </>
                    ) : (
                      "Zmeniť heslo"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
