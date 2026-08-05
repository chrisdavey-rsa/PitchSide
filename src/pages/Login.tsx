/**
 * Standalone login page wrapper around LoginView.
 * Used for /login and as the recovery entry for Forgot Password.
 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LoginView from '../components/auth/LoginView';
import ResetPasswordView from '../components/auth/ResetPasswordView';
import { UserProfile } from '../types';

type Mode = 'login' | 'forgot';

export interface LoginPageProps {
  onAuthSuccess?: (user: UserProfile) => void;
  onAddNewUser?: (user: UserProfile) => void;
}

export default function Login({ onAuthSuccess, onAddNewUser }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('login');
  const successFromState =
    typeof (location.state as { loginSuccess?: string } | null)?.loginSuccess === 'string'
      ? (location.state as { loginSuccess: string }).loginSuccess
      : undefined;

  if (mode === 'forgot') {
    return (
      <div className="flex-1 flex items-center justify-center py-6">
        <ResetPasswordView
          mode="request"
          onBackToLogin={() => setMode('login')}
          onPasswordUpdated={() => setMode('login')}
          onLogoClick={() => navigate('/')}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center py-6">
      <LoginView
        onAuthSuccess={(user) => {
          onAuthSuccess?.(user);
          navigate('/', { replace: true });
        }}
        onAddNewUser={(user) => onAddNewUser?.(user)}
        onForgotPassword={() => setMode('forgot')}
        onCreateAccount={() => navigate('/?auth=signup')}
        successMessage={successFromState}
        onLogoClick={() => navigate('/')}
        inlineForgotPassword
      />
    </div>
  );
}
