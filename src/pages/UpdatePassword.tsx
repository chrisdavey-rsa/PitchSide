/**
 * Dedicated update-password page after a recovery email link.
 * Reuses ResetPasswordView in `update` mode.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import ResetPasswordView from '../components/auth/ResetPasswordView';
import { supabase } from '../supabase';

export default function UpdatePassword() {
  const navigate = useNavigate();

  const backToLogin = async () => {
    // Recovery links create a session; clear it before returning to login.
    try {
      await supabase?.auth.signOut();
    } catch (err) {
      console.warn('[UpdatePassword] signOut failed', err);
    }
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex-1 flex items-center justify-center py-6">
      <ResetPasswordView
        mode="update"
        onBackToLogin={backToLogin}
        onPasswordUpdated={backToLogin}
        onLogoClick={() => {
          void backToLogin();
        }}
      />
    </div>
  );
}
