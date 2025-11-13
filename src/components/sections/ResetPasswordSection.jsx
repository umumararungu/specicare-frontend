import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

const ResetPasswordSection = () => {
  const { resetPassword, isLoading } = useApp();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search || '');
      const tk = qs.get('token');
      if (tk) setToken(tk);
    } catch (e) {
      // ignore
    }
  }, []);

  const submit = async (e) => {
    e && e.preventDefault();
    if (!token) {
      alert('Missing reset token');
      return;
    }
    if (!password || password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      alert('Passwords do not match');
      return;
    }
    await resetPassword(token, password);
  };

  return (
    <section id="reset" className="section active">
      <div className="login-card">
        <h2>Reset Password</h2>
        <p>Choose a new password for your account.</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="form-row">
            <button className="submit-btn" type="submit" disabled={isLoading}>
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default ResetPasswordSection;
