import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, CheckCircle, Loader2 } from "lucide-react";
import { validatePassword, MAX_LENGTHS } from "@/utils/validation";
import { Link } from "react-router-dom";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidLink, setIsValidLink] = useState(false);

  useEffect(() => {
    // Supabase automatically processes hash fragments and sets the session
    // We need to wait for Supabase to process the redirect
    const verifySession = async () => {
      setIsVerifying(true);
      
      // Check for tokens in URL (Supabase uses hash fragments for magic links)
      const hash = window.location.hash;
      const urlParams = new URLSearchParams(hash.substring(1));
      const accessToken = searchParams.get("access_token") || urlParams.get("access_token");
      const type = searchParams.get("type") || urlParams.get("type");
      
      // If no tokens found at all, invalid link
      if (!accessToken || type !== "recovery") {
        setIsValidLink(false);
        setIsVerifying(false);
        toast({
          title: "Invalid reset link",
          description: "This password reset link is invalid or has expired. Please request a new one.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate("/forgot-password");
        }, 3000);
        return;
      }

      // Set up auth state change listener to detect when Supabase processes the hash
      let sessionReceived = false;
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          sessionReceived = true;
          setIsValidLink(true);
          setIsVerifying(false);
          // Clean up the URL hash for security
          if (hash) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      });

      // Also check session directly (in case it's already processed)
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session && !error) {
        // Session already exists
        sessionReceived = true;
        setIsValidLink(true);
        setIsVerifying(false);
        if (hash) {
          window.history.replaceState(null, "", window.location.pathname);
        }
        subscription.unsubscribe();
        return;
      }

      // Wait for Supabase to process the hash fragment (max 3 seconds)
      let attempts = 0;
      const maxAttempts = 6; // 3 seconds total (6 * 500ms)
      
      while (!sessionReceived && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: { session: checkSession }, error: checkError } = await supabase.auth.getSession();
        
        if (checkSession && !checkError) {
          sessionReceived = true;
          setIsValidLink(true);
          setIsVerifying(false);
          if (hash) {
            window.history.replaceState(null, "", window.location.pathname);
          }
          subscription.unsubscribe();
          return;
        }
        
        attempts++;
      }

      // If we still don't have a session after waiting
      if (!sessionReceived) {
        subscription.unsubscribe();
        setIsValidLink(false);
        setIsVerifying(false);
        toast({
          title: "Invalid reset link",
          description: "This password reset link is invalid or has expired. Please request a new one.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate("/forgot-password");
        }, 3000);
      }
    };

    verifySession();
  }, [searchParams, navigate, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setPasswordErrors(passwordValidation.errors);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordErrors(["Passwords do not match"]);
      return;
    }

    setPasswordErrors([]);
    setIsResetting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to reset password. Please try again or request a new reset link.",
          variant: "destructive",
        });
      } else {
        setIsSuccess(true);
        toast({
          title: "Success!",
          description: "Your password has been reset successfully. Please sign in with your new password.",
        });
        
        // Sign out the user for security (they need to sign in with new password)
        await supabase.auth.signOut();
        
        setTimeout(() => {
          navigate("/auth");
        }, 2000);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }

    setIsResetting(false);
  };

  // Show loading state while verifying the magic link
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 cyber-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
        <Card className="w-full max-w-md glow-card relative z-10 p-8 text-center">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <h1 className="text-2xl font-display text-primary mb-2">Verifying Reset Link</h1>
          <p className="text-muted-foreground">
            Please wait while we verify your password reset link...
          </p>
        </Card>
      </div>
    );
  }

  // Show error if link is invalid
  if (!isValidLink) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 cyber-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
        <Card className="w-full max-w-md glow-card relative z-10 p-8 text-center">
          <Lock className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-display text-primary mb-2">Invalid Reset Link</h1>
          <p className="text-muted-foreground mb-4">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link to="/forgot-password">
            <Button className="w-full bg-primary hover:bg-primary/90">
              Request New Reset Link
            </Button>
          </Link>
          <Link to="/auth" className="block mt-2">
            <Button variant="outline" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Show success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 cyber-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
        <Card className="w-full max-w-md glow-card relative z-10 p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-display text-primary mb-2">Password Reset Successful!</h1>
          <p className="text-muted-foreground mb-4">
            Your password has been reset successfully. Redirecting to sign in...
          </p>
        </Card>
      </div>
    );
  }

  // Show reset password form
  return (
    <div className="min-h-screen flex items-center justify-center p-4 cyber-grid">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
      
      <Card className="w-full max-w-md glow-card relative z-10 p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Lock className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-display neon-text mb-2">Reset Password</h1>
          <p className="text-muted-foreground">Enter your new password</p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
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
              maxLength={MAX_LENGTHS.PASSWORD}
              className="bg-input border-primary/30"
              required
            />
            {passwordErrors.length > 0 && (
              <div className="text-xs text-destructive space-y-1">
                {passwordErrors.map((error, idx) => (
                  <div key={idx}>{error}</div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              maxLength={MAX_LENGTHS.PASSWORD}
              className="bg-input border-primary/30"
              required
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isResetting || password !== confirmPassword || passwordErrors.length > 0}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {isResetting ? "Resetting..." : "Reset Password"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/auth">
            <Button variant="ghost" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ResetPassword;

