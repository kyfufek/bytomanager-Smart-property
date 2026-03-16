import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Building2, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

type Mode = "login" | "register";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

  useEffect(() => {
    if (successMessage) {
      const timer = window.setTimeout(() => setSuccessMessage(""), 2500);
      return () => window.clearTimeout(timer);
    }
  }, [successMessage]);

  if (isAuthenticated) {
    return <Navigate to="/properties" replace />;
  }

  function validateLogin() {
    const nextErrors: Record<string, string> = {};
    if (!loginEmail.trim()) {
      nextErrors.loginEmail = "E-mail je povinny.";
    } else if (!emailRegex.test(loginEmail.trim())) {
      nextErrors.loginEmail = "Zadejte platny e-mail.";
    }

    if (!loginPassword) {
      nextErrors.loginPassword = "Heslo je povinne.";
    } else if (loginPassword.length < 8) {
      nextErrors.loginPassword = "Heslo musi mit alespon 8 znaku.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateRegister() {
    const nextErrors: Record<string, string> = {};
    if (!registerName.trim()) {
      nextErrors.registerName = "Jmeno je povinne.";
    }

    if (!registerEmail.trim()) {
      nextErrors.registerEmail = "E-mail je povinny.";
    } else if (!emailRegex.test(registerEmail.trim())) {
      nextErrors.registerEmail = "Zadejte platny e-mail.";
    }

    if (!registerPassword) {
      nextErrors.registerPassword = "Heslo je povinne.";
    } else if (registerPassword.length < 8) {
      nextErrors.registerPassword = "Heslo musi mit alespon 8 znaku.";
    }

    if (!registerConfirmPassword) {
      nextErrors.registerConfirmPassword = "Potvrzeni hesla je povinne.";
    } else if (registerPassword !== registerConfirmPassword) {
      nextErrors.registerConfirmPassword = "Hesla se neshoduji.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateLogin()) return;

    const result = login(loginEmail, loginPassword);
    if (!result.success) {
      setErrors({ form: result.error ?? "Prihlaseni se nezdarilo." });
      return;
    }

    setSuccessMessage("Uspesne prihlaseni. Presmerovavam...");
    navigate("/properties", { replace: true });
  }

  function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateRegister()) return;

    const result = register(registerName, registerEmail, registerPassword);
    if (!result.success) {
      setErrors({ form: result.error ?? "Registrace se nezdarila." });
      return;
    }

    setSuccessMessage("Ucet byl uspesne vytvoren. Presmerovavam...");
    navigate("/properties", { replace: true });
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setErrors({});
    setSuccessMessage("");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/20 flex items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md border-border/60 card-shadow">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">BytoManazer</CardTitle>
            <CardDescription>Prihlaseni a registrace do aplikace</CardDescription>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "login" ? "cta" : "outline"}
              onClick={() => switchMode("login")}
              className="w-full"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Prihlaseni
            </Button>
            <Button
              type="button"
              variant={mode === "register" ? "cta" : "outline"}
              onClick={() => switchMode("register")}
              className="w-full"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Registrace
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {errors.form && (
            <p className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {errors.form}
            </p>
          )}

          {successMessage && (
            <p className="mb-3 rounded-md bg-success/10 p-2 text-sm text-success">
              {successMessage}
            </p>
          )}

          {mode === "login" ? (
            <form className="space-y-4" onSubmit={handleLoginSubmit} noValidate>
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="uzivatel@example.cz"
                />
                {errors.loginEmail && (
                  <p className="text-xs text-destructive">{errors.loginEmail}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Heslo</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Alespon 8 znaku"
                />
                {errors.loginPassword && (
                  <p className="text-xs text-destructive">{errors.loginPassword}</p>
                )}
              </div>

              <Button type="submit" className="w-full" variant="cta">
                Prihlasit se
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRegisterSubmit} noValidate>
              <div className="space-y-2">
                <Label htmlFor="register-name">Cele jmeno</Label>
                <Input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="Jan Novak"
                />
                {errors.registerName && (
                  <p className="text-xs text-destructive">{errors.registerName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email">E-mail</Label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="uzivatel@example.cz"
                />
                {errors.registerEmail && (
                  <p className="text-xs text-destructive">{errors.registerEmail}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Heslo</Label>
                <Input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="Alespon 8 znaku"
                />
                {errors.registerPassword && (
                  <p className="text-xs text-destructive">{errors.registerPassword}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-confirm-password">Potvrzeni hesla</Label>
                <Input
                  id="register-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  placeholder="Znovu heslo"
                />
                {errors.registerConfirmPassword && (
                  <p className="text-xs text-destructive">
                    {errors.registerConfirmPassword}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" variant="cta">
                Vytvorit ucet
              </Button>
            </form>
          )}

          <div className="mt-5 flex justify-center">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
              Demo auth ulozeny v localStorage
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
