import React, { useState } from 'react';
import { Package, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || 'Login failed. Please check your email and password.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Subtle Grid Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none"></div>

      {/* Brand Header */}
      <div className="mb-8 text-center flex flex-col items-center relative z-10">
        <div className="h-14 w-14 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 border border-blue-400/30">
          <Package className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Consumables Hub</h1>
        <p className="text-slate-400 text-sm mt-1 font-medium">Internal Ordering & Logistics Management System</p>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-md shadow-2xl border-slate-200/80 relative z-10">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-bold text-slate-900">Sign In to Your Account</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Enter your email and password to access your role workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold flex items-start gap-2.5 animate-shake">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                User Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., admin@logistics.co"
                  className="pl-9 text-sm h-11 bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10 text-sm h-11 bg-slate-50/50 border-slate-200 focus:bg-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md gap-2 mt-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="pt-2 border-t border-slate-100 mt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Quick Sign-in (Admin &amp; Demo Accounts)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('langerz69@gmail.com');
                    setPassword('admin123');
                  }}
                  className="text-left p-2 rounded-lg border border-indigo-200 hover:border-indigo-400 bg-indigo-50/60 hover:bg-indigo-100/60 transition-colors text-xs"
                >
                  <p className="font-bold text-indigo-900">Admin (Your Email)</p>
                  <p className="text-[10px] text-indigo-700 font-mono truncate">langerz69@gmail.com</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@consumables.local');
                    setPassword('admin123');
                  }}
                  className="text-left p-2 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 transition-colors text-xs"
                >
                  <p className="font-bold text-slate-800">Logistics Admin</p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">admin@consumables.local</p>
                </button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="mt-8 text-center text-xs text-slate-500 max-w-sm relative z-10 font-medium">
        Consumables Hub Enterprise Platform • Auth Protected
      </p>
    </div>
  );
}
