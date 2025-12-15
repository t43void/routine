import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  validatePassword,
  validateUsername,
  isValidEmail,
} from "@/utils/validation";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [usernameErrors, setUsernameErrors] = useState<string[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate inputs
    const emailValidation = isValidEmail(email);
    if (!emailValidation) {
      setEmailError("Please enter a valid email address");
      setLoading(false);
      return;
    }
    setEmailError(null);

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      setUsernameErrors(usernameValidation.errors);
      setLoading(false);
      return;
    }
    setUsernameErrors([]);

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setPasswordErrors(passwordValidation.errors);
      setLoading(false);
      return;
    }
    setPasswordErrors([]);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { username: username.trim() },
        },
      });

      if (error) {
        // Handle rate limiting (429 Too Many Requests)
        if (error.status === 429 || error.message.includes('Too Many Requests') || error.message.includes('rate limit')) {
          toast({
            title: "Please wait a moment",
            description: "You've made several attempts. Please wait 1-2 minutes before trying again. This helps protect against automated attacks.",
            variant: "destructive",
          });
        } else {
          // Generic error message to prevent information leakage
          const errorMessage = error.message.includes('already registered')
            ? "An account with this email already exists"
            : error.message.includes('password')
            ? "Password does not meet requirements"
            : "Unable to create account. Please try again.";
          
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success!",
          description: "Account created successfully. Please check your email to verify your account.",
        });
        // Don't navigate immediately - user needs to verify email
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate email
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address");
      setLoading(false);
      return;
    }
    setEmailError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        // Handle rate limiting (429 Too Many Requests)
        if (error.status === 429 || error.message.includes('Too Many Requests') || error.message.includes('rate limit')) {
          toast({
            title: "Please wait a moment",
            description: "You've made several attempts. Please wait 1-2 minutes before trying again. This helps protect against automated attacks.",
            variant: "destructive",
          });
        } else if (
          error.message.includes('email not confirmed') ||
          error.message.includes('Email not confirmed') ||
          error.message.includes('confirm your email') ||
          error.message.includes('email confirmation') ||
          error.message.includes('verification') ||
          error.message.includes('not verified') ||
          error.message.includes('Email address not confirmed') ||
          (error as any).code === 'email_not_confirmed' ||
          (error.status === 400 && (
            error.message.toLowerCase().includes('email') ||
            error.message.toLowerCase().includes('confirm') ||
            error.message.toLowerCase().includes('verify')
          ))
        ) {
          // Email not confirmed
          toast({
            title: "Email not confirmed",
            description: "Please check your email and click the confirmation link before signing in. If you didn't receive it, check your spam folder.",
            variant: "destructive",
          });
        } else {
          // Generic error message to prevent user enumeration
          const errorMessage = "Invalid email or password";
          
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 cyber-grid">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
      
      <Card className="w-full max-w-md glow-card relative z-10 p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display neon-text mb-2 animate-pulse">Lotus Routine</h1>
          <div className="neon-line mx-auto w-32"></div>
          <p className="text-muted-foreground mt-4">Your accountability journey starts here</p>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="warrior@lotusroutine.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-input border-primary/30"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary hover:text-primary/80 underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-input border-primary/30"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={loading}
              >
                {loading ? "Loading..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="LotusWarrior"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (e.target.value) {
                      const validation = validateUsername(e.target.value);
                      setUsernameErrors(validation.errors);
                    } else {
                      setUsernameErrors([]);
                    }
                  }}
                  required
                  maxLength={50}
                  className="bg-input border-primary/30"
                />
                {usernameErrors.length > 0 && (
                  <div className="text-xs text-destructive space-y-1">
                    {usernameErrors.map((error, idx) => (
                      <div key={idx}>{error}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="warrior@lotusroutine.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (e.target.value && !isValidEmail(e.target.value)) {
                      setEmailError("Please enter a valid email address");
                    } else {
                      setEmailError(null);
                    }
                  }}
                  required
                  maxLength={255}
                  className="bg-input border-primary/30"
                />
                {emailError && (
                  <div className="text-xs text-destructive">{emailError}</div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (e.target.value) {
                      const validation = validatePassword(e.target.value);
                      setPasswordErrors(validation.errors);
                    } else {
                      setPasswordErrors([]);
                    }
                  }}
                  required
                  maxLength={128}
                  className="bg-input border-primary/30"
                />
                {passwordErrors.length > 0 && (
                  <div className="text-xs text-destructive space-y-1">
                    {passwordErrors.map((error, idx) => (
                      <div key={idx}>{error}</div>
                    ))}
                  </div>
                )}
                {passwordErrors.length === 0 && password && (
                  <div className="text-xs text-green-400">✓ Password strength: Good</div>
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                disabled={loading}
              >
                {loading ? "Loading..." : "Sign Up"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
