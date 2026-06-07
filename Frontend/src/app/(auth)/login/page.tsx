"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/lib/identity/auth.api";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email:    z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { loginFromApi } = useAuthStore();
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const result = await authApi.login(data.email, data.password);
      loginFromApi(result.accessToken, result.refreshToken, result.user);
      toast.success(`Welcome back, ${result.user.firstName}!`);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 400 || err.statusCode === 401) {
          toast.error("Invalid email or password.");
        } else {
          toast.error(err.message || "Login failed. Please try again.");
        }
      } else {
        toast.error("Unable to connect to the server. Please check your connection.");
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Mobile logo (hidden on lg+) */}
      <div className="flex lg:hidden items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow shadow-blue-500/30">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-base leading-none">Softaxis ERP</p>
          <p className="text-muted-foreground text-xs mt-0.5">Enterprise Platform</p>
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-muted-foreground text-sm">
          Sign in to your Softaxis ERP account to continue
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Email address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              {...register("email")}
              className={cn(
                "pl-10 h-11 transition-shadow focus-visible:shadow-[0_0_0_3px_hsl(221_83%_53%/0.15)]",
                errors.email && "border-destructive focus-visible:shadow-[0_0_0_3px_hsl(0_84%_60%/0.15)]"
              )}
            />
          </div>
          {errors.email && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="text-destructive text-xs flex items-center gap-1"
            >
              <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
              {errors.email.message}
            </motion.p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <button
              type="button"
              className="text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              {...register("password")}
              className={cn(
                "pl-10 pr-11 h-11 transition-shadow focus-visible:shadow-[0_0_0_3px_hsl(221_83%_53%/0.15)]",
                errors.password && "border-destructive focus-visible:shadow-[0_0_0_3px_hsl(0_84%_60%/0.15)]"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword
                ? <EyeOff className="h-4 w-4" />
                : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="text-destructive text-xs flex items-center gap-1"
            >
              <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
              {errors.password.message}
            </motion.p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <Checkbox
            id="remember"
            checked={watch("remember")}
            onCheckedChange={(v) => setValue("remember", !!v)}
            className="rounded-[4px]"
          />
          <Label htmlFor="remember" className="font-normal text-sm cursor-pointer text-muted-foreground">
            Remember me for 30 days
          </Label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-11 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 group"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-muted-foreground">Demo credentials</span>
        </div>
      </div>

      {/* Credential hint */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success shrink-0" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Default admin account
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Email</p>
            <p className="text-sm font-mono font-medium select-all">admin@softaxis.io</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Password</p>
            <p className="text-sm font-mono font-medium select-all">Admin@123456</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground/60">
        By signing in, you agree to our{" "}
        <button className="underline underline-offset-2 hover:text-foreground transition-colors">
          Terms of Service
        </button>{" "}
        and{" "}
        <button className="underline underline-offset-2 hover:text-foreground transition-colors">
          Privacy Policy
        </button>
      </p>
    </motion.div>
  );
}
