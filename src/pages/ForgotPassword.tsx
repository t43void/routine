import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { isValidEmail } from "@/utils/validation";
import { Mail, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEmailError(null);

    // Validate email
    if (!email || email.trim().length === 0) {
      setEmailError("Please enter your email address");
      setLoading(false);
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    try {
      // Send password reset email with magic link
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) {
        // Handle rate limiting
        if (error.status === 429 || error.message.includes('Too Many Requests') || error.message.includes('rate limit')) {
          toast({
            title: "Please wait a moment",
            description: "You've made several requests. Please wait 1-2 minutes before trying again.",
            variant: "destructive",
          });
        } else {
          // Don't reveal if email exists (security best practice)
          // Always show success message to prevent user enumeration
          setIsSuccess(true);
        }
      } else {
        setIsSuccess(true);
      }
    } catch (err) {
      // Even on error, show success to prevent user enumeration
      setIsSuccess(true);
    }

    setLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 cyber-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
        
        <Card className="w-full max-w-md glow-card relative z-10 p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Mail className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-3xl font-display neon-text mb-2">Check Your Email</h1>
            <p className="text-muted-foreground">
              If an account with that email exists, we've sent you a password reset link.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Didn't receive the email? Check your spam folder or try again in a few minutes.
            </p>
            <Link to="/auth">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 cyber-grid">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5"></div>
      
      <Card className="w-full max-w-md glow-card relative z-10 p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Mail className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-display neon-text mb-2">Forgot Password?</h1>
          <p className="text-muted-foreground">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
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
              className="bg-input border-primary/30"
            />
            {emailError && (
              <div className="text-xs text-destructive">{emailError}</div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/auth">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;

