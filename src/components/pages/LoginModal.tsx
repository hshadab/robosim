/**
 * Login Modal with Supabase Authentication
 *
 * Supports:
 * - Google OAuth
 * - GitHub OAuth
 * - Email/Password login
 * - Email/Password signup
 * - Mock login for development
 */

import React, { useState } from 'react';
import { X, Bot, Loader2, Mail, Github, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { isSupabaseConfigured } from '../../lib/supabase';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type AuthMode = 'login' | 'signup';

// Google icon SVG
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    loginWithGoogle,
    loginWithGitHub,
    loginWithEmail,
    signUpWithEmail,
    mockLogin,
    isLoading: authLoading,
    error: authError,
    clearError,
  } = useAuthStore();

  const isLoading = localLoading || authLoading;
  const error = localError || authError;

  const handleGoogleLogin = async () => {
    setLocalError('');
    clearError();
    try {
      await loginWithGoogle();
      // OAuth redirects, so onSuccess won't be called here
    } catch {
      setLocalError('Google login failed');
    }
  };

  const handleGitHubLogin = async () => {
    setLocalError('');
    clearError();
    try {
      await loginWithGitHub();
    } catch {
      setLocalError('GitHub login failed');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMessage('');
    clearError();
    setLocalLoading(true);

    try {
      if (mode === 'login') {
        if (isSupabaseConfigured) {
          await loginWithEmail(email, password);
        } else {
          // Mock login for development
          await mockLogin(email);
        }
        onSuccess();
      } else {
        if (isSupabaseConfigured) {
          await signUpWithEmail(email, password, name);
          setSuccessMessage('Check your email to verify your account!');
          setMode('login');
        } else {
          // Mock signup for development
          await mockLogin(email);
          onSuccess();
        }
      }
    } catch {
      setLocalError(mode === 'login' ? 'Invalid credentials' : 'Sign up failed');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLocalError('');
    clearError();
    setLocalLoading(true);
    try {
      await mockLogin('demo@robosim.dev');
      onSuccess();
    } catch {
      setLocalError('Demo login failed');
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Bot className="w-7 h-7 text-blue-400" />
            <span className="text-lg font-semibold text-white">
              {mode === 'login' ? 'Log in to RoboSim' : 'Create Account'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Error message */}
          {error && (
            <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="bg-green-500/20 text-green-400 px-4 py-3 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

          {/* OAuth buttons */}
          {isSupabaseConfigured ? (
            <>
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-200 text-gray-800 py-3 rounded-lg font-medium transition flex items-center justify-center gap-3"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <button
                onClick={handleGitHubLogin}
                disabled={isLoading}
                className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-3"
              >
                <Github className="w-5 h-5" />
                Continue with GitHub
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-slate-800 px-3 text-slate-400">or</span>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-amber-500/20 text-amber-400 px-4 py-3 rounded-lg text-sm">
              <strong>Development Mode:</strong> Supabase not configured. Using mock authentication.
            </div>
          )}

          {/* Email form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                placeholder={isSupabaseConfigured ? '••••••••' : 'Any password (demo)'}
                required
                minLength={isSupabaseConfigured ? 6 : 1}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {mode === 'login' ? 'Logging in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  {mode === 'login' ? 'Log in with Email' : 'Sign up with Email'}
                </>
              )}
            </button>
          </form>

          {/* Toggle login/signup */}
          <div className="text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setLocalError('');
                setSuccessMessage('');
                clearError();
              }}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Log in'}
            </button>
          </div>

          {/* Demo login */}
          {!isSupabaseConfigured && (
            <div className="pt-2 border-t border-slate-700">
              <button
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="w-full text-slate-400 hover:text-white text-sm py-2 transition"
              >
                Quick Demo Login
              </button>
            </div>
          )}

          {/* Free tier info */}
          <div className="text-center text-xs text-slate-500 pt-2">
            Free tier includes 10 episode exports/month.
            <br />
            LeRobot contributors get Pro access free!
          </div>
        </div>
      </div>
    </div>
  );
};
