import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

const ForgotPasswordSection = () => {
  const { forgotPassword, setActiveSection, isLoading } = useApp();
  const [email, setEmail] = useState('');

  const submit = async (e) => {
    e && e.preventDefault();
    if (!email) return;
    await forgotPassword(email);
    // Optionally navigate back to login
    setActiveSection('login');
  };

  return (
    <section id="forgot" className="section active">
      <div className="login-card">
        <h2>Forgot Password</h2>
        <p>Enter your account email and we'll send a password reset link.</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="forgotEmail">Email Address</label>
            <input
              id="forgotEmail"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-row">
            <button className="submit-btn" type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button type="button" className="secondary-btn" onClick={() => setActiveSection('login')}>
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default ForgotPasswordSection;
