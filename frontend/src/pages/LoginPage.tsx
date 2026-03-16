import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errs: typeof errors = {};
    if (!email) errs.email = "E-mail je povinný";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Neplatný e-mail";
    if (!password) errs.password = "Heslo je povinné";
    else if (password.length < 6) errs.password = "Heslo musí mít min. 6 znaků";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // TODO: napojit na API (Supabase auth)
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center bg-card border-r p-12">
        <div className="max-w-md text-center space-y-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
            <Building2 className="h-10 w-10 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bytomanager</h1>
            <p className="mt-3 text-lg text-muted-foreground italic">
              „Pořádek dělá přátele"
            </p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Moderní platforma pro správu bytových jednotek, nájemníků, financí
            a právních dokumentů. Vše na jednom místě.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md card-shadow">
          <CardHeader className="space-y-1 text-center lg:hidden">
            <Logo />
            <p className="text-sm text-muted-foreground italic mt-2">
              „Pořádek dělá přátele"
            </p>
          </CardHeader>
          <CardHeader className="hidden lg:block text-center">
            <h2 className="text-xl font-semibold">
              {isLogin ? "Přihlášení" : "Registrace"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Zadejte své přihlašovací údaje" : "Vytvořte si nový účet"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jan@example.cz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Heslo</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={errors.password ? "border-destructive" : ""}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              <Button type="submit" variant="cta" className="w-full">
                {isLogin ? "Přihlásit se" : "Zaregistrovat se"}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">nebo</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  // TODO: napojit na API (Google OAuth)
                  navigate("/");
                }}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Přihlásit pomocí Google
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isLogin ? "Nemáte účet?" : "Máte účet?"}{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-medium hover:underline"
              >
                {isLogin ? "Zaregistrujte se" : "Přihlaste se"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
