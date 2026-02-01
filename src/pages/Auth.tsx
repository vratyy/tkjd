import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { Building2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Registration form state
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerFullName, setRegisterFullName] = useState("");

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Prihlásenie zlyhalo",
        description: error.message,
      });
    }
    
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registerFullName.trim()) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Meno a priezvisko je povinné pole.",
      });
      return;
    }

    if (registerPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Heslo musí mať aspoň 8 znakov.",
      });
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(registerEmail, registerPassword, registerFullName.trim());
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Registrácia zlyhala",
        description: error.message,
      });
    } else {
      toast({
        title: "Registrácia úspešná",
        description: "Skontrolujte svoj e-mail a potvrďte registráciu.",
      });
      // Reset form and switch to login
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterFullName("");
      setIsRegistering(false);
    }
    
    setIsLoading(false);
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    // Clear forms when switching
    setLoginEmail("");
    setLoginPassword("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterFullName("");
  };

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
              <CardTitle className="text-center">
                {isRegistering ? "Registrácia" : "Prihlásenie"}
              </CardTitle>
              <CardDescription className="text-center">
                {isRegistering 
                  ? "Vytvorte si nový účet" 
                  : "Zadajte svoje prihlasovacie údaje"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {isRegistering ? (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-fullname">
                      Meno a priezvisko <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="register-fullname"
                      type="text"
                      placeholder="Ján Novák"
                      value={registerFullName}
                      onChange={(e) => setRegisterFullName(e.target.value)}
                      required
                      disabled={isLoading}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-mail</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="vas@email.sk"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Heslo</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Min. 8 znakov"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={8}
                    />
                    <p className="text-xs text-muted-foreground">
                      Heslo musí obsahovať aspoň 8 znakov vrátane veľkých/malých písmen, číslic a symbolov.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrujem...
                      </>
                    ) : (
                      "Zaregistrovať sa"
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="vas@email.sk"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Heslo</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Prihlasujem...
                      </>
                    ) : (
                      "Prihlásiť sa"
                    )}
                  </Button>
                </form>
              )}

              {/* Toggle between login and registration */}
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                  disabled={isLoading}
                >
                  {isRegistering 
                    ? "Máte už účet? Prihláste sa" 
                    : "Nemáte ešte účet? Zaregistrujte sa"}
                </button>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
      <Footer />
    </div>
  );
}
