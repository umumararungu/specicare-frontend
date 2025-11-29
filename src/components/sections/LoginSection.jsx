import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DISTRICTS, getSectors } from '../../utils/locations';

const LoginSection = () => {
  const { login, register, isLoading, showNotification, setActiveSection } = useApp();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  
  // Register form state 
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    insuranceProvider: '',
    dateOfBirth: '',
    gender: '',
    address: {
      district: '',
      sector: '',
      cell: '',
      village: ''
    },
    terms: false
  });

  // Login handlers
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    
    if (!loginData.email || !loginData.password) {
      showNotification('Please fill in all fields', 'error');
      return;
    }

    await login(loginData.email, loginData.password);
  };

  const handleLoginChange = (field, value) => {
    setLoginData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Register handlers
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    const validationErrors = validateRegisterData(registerData);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => showNotification(error, 'error'));
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    if (registerData.password.length < 6) {
      showNotification('Password must be at least 6 characters', 'error');
      return;
    }

    // if (!registerData.terms) {
    //   showNotification('You must agree to the terms and conditions', 'error');
    //   return;
    // }

    // Prepare data for backend
    // Normalize address fields and also include flat fields to support APIs
    // that expect top-level district/sector/cell/village keys.
    const district = registerData.address?.district?.toString().trim() || '';
    const sector = registerData.address?.sector?.toString().trim() || '';
    const cell = registerData.address?.cell?.toString().trim() || '';
    const village = registerData.address?.village?.toString().trim() || '';

    const userData = {
      name: registerData.name.trim(),
      email: registerData.email.trim().toLowerCase(),
      phone: formatPhoneNumber(registerData.phone),
      password: registerData.password,
      insuranceProvider: registerData.insuranceProvider || undefined,
      dateOfBirth: registerData.dateOfBirth || undefined,
      gender: registerData.gender || undefined,
      // include nested address when district is provided
      address: district ? { district, sector, cell, village } : undefined,
      // also include flat fields (some backends expect these directly)
      district: district || undefined,
      sector: sector || undefined,
      cell: cell || undefined,
      village: village || undefined,
      role: 'patient', // Default role as per schema
      isActive: true   // Default as per schema
    };

    await register(userData);
  };

  const handleRegisterChange = (field, value) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setRegisterData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setRegisterData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Utility functions
  const formatPhoneNumber = (phone) => {
    let cleaned = phone.replace(/\s+/g, '');
    
    if (cleaned.startsWith('0')) {
      return '+250' + cleaned.substring(1);
    } else if (cleaned.startsWith('250')) {
      return '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      return '+250' + cleaned;
    }
    
    return cleaned;
  };

  const validateRegisterData = (data) => {
    const errors = [];

    // Name validation
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Full name is required');
    }
    if (data.name.length > 100) {
      errors.push('Name cannot exceed 100 characters');
    }

    // Email validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push('Please enter a valid email address');
    }

    // Phone validation (Rwandan numbers)
    const phoneRegex = /^(\+?250|0)?[72][0-9]{8}$/;
    if (!data.phone || !phoneRegex.test(data.phone.replace(/\s+/g, ''))) {
      errors.push('Please enter a valid Rwandan phone number (e.g., 0788123456 or +250788123456)');
    }

    // Password validation
    if (!data.password || data.password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    // Gender validation
    if (data.gender && !['male', 'female', 'other'].includes(data.gender)) {
      errors.push('Please select a valid gender');
    }

    return errors;
  };

  const handleDistrictChange = (district) => {
    setRegisterData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        district: district,
        sector: '', // Reset sector when district changes
        cell: ''
      }
    }));
  };

  const handleSectorChange = (sector) => {
    setRegisterData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        sector: sector,
        cell: '' // reset cell when sector changes
      }
    }));
  };

  return (
    <section id="login" className="section active">
      <div className="login-container">
        {/* Login Card */}
        {!isRegisterMode && (
          <div className="login-card">
            <h2>Welcome Back</h2>
            <p>Sign in to your SpeciCare account</p>
            
            <form id="loginForm" onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label htmlFor="loginEmail">Email Address</label>
                <input 
                  type="email" 
                  id="loginEmail" 
                  required 
                  placeholder="Enter your email"
                  value={loginData.email}
                  onChange={(e) => handleLoginChange('email', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="loginPassword">Password</label>
                <input 
                  type="password" 
                  id="loginPassword" 
                  required 
                  placeholder="Enter your password"
                  value={loginData.password}
                  onChange={(e) => handleLoginChange('password', e.target.value)}
                />
              </div>
              <button type="submit" className="submit-btn" disabled={isLoading}>
                <i className="fas fa-sign-in-alt"></i> 
                {isLoading ? '  Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="forgot-link">
              <button type="button" className="link-btn" onClick={() => setActiveSection('forgot')}>
                Forgot Password?
              </button>
            </div>

            <div className="login-divider">
              <span>or</span>
            </div>

            <div className="register-prompt">
              <p>Don't have an account?</p>
              <button 
                className="secondary-btn" 
                onClick={() => setIsRegisterMode(true)}
                type="button"
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* Register Card */}
        {isRegisterMode && (
          <div className="login-card">
            <h2>Create Account</h2>
            <p>Join SpeciCare to book medical tests</p>
            
                <form id="registerForm" onSubmit={handleRegisterSubmit}>
                  <div className="register-grid">
                    <div className="register-column">
                      {/* Personal Information (left) */}
                      <div className="form-section">
                        <h4>Personal Information</h4>
                        <div className="form-group">
                          <label htmlFor="registerName" className="required">Full Name</label>
                          <input
                            type="text"
                            id="registerName"
                            required
                            placeholder="Enter your full name"
                            value={registerData.name}
                            onChange={(e) => handleRegisterChange('name', e.target.value)}
                            maxLength="100"
                          />
                          <small className="form-help">Maximum 100 characters</small>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="registerEmail" className="required">Email Address</label>
                            <input
                              type="email"
                              id="registerEmail"
                              required
                              placeholder="Enter your email"
                              value={registerData.email}
                              onChange={(e) => handleRegisterChange('email', e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="registerPhone" className="required">Phone Number</label>
                            <input
                              type="tel"
                              id="registerPhone"
                              required
                              placeholder="e.g., 0788123456 or +250788123456"
                              value={registerData.phone}
                              onChange={(e) => handleRegisterChange('phone', e.target.value)}
                              pattern="^(\+?250|0)?[72][0-9]{8}$"
                            />
                            <small className="form-help">Valid Rwandan number (07xxxxxxxx or +2507xxxxxxxx)</small>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="registerDateOfBirth">Date of Birth</label>
                            <input
                              type="date"
                              id="registerDateOfBirth"
                              max={new Date().toISOString().split('T')[0]}
                              value={registerData.dateOfBirth}
                              onChange={(e) => handleRegisterChange('dateOfBirth', e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="registerGender">Gender</label>
                            <select
                              id="registerGender"
                              value={registerData.gender}
                              onChange={(e) => handleRegisterChange('gender', e.target.value)}
                            >
                              <option value="">Select Gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="register-column">
                      {/* Middle content moved into right column: address, sector, insurance, security */}
                      <div className="form-section">
                        <h4>Address Information</h4>
                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="registerDistrict">District</label>
                            <select
                              id="registerDistrict"
                              value={registerData.address.district}
                              onChange={(e) => handleDistrictChange(e.target.value)}
                            >
                              <option value="">Select District</option>
                              {DISTRICTS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="form-section">
                        <h4>Sector</h4>
                        <div className="form-group">
                          {(() => {
                            const sectors = getSectors(registerData.address.district || '');
                            if (sectors && sectors.length > 0) {
                              return (
                                <select
                                  id="registerSector"
                                  value={registerData.address.sector}
                                  onChange={(e) => handleSectorChange(e.target.value)}
                                >
                                  <option value="">Select Sector</option>
                                  {sectors.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              );
                            }

                            return (
                              <input
                                type="text"
                                id="registerSector"
                                placeholder="Enter sector"
                                value={registerData.address.sector}
                                onChange={(e) => handleSectorChange(e.target.value)}
                              />
                            );
                          })()}
                        </div>
                      </div>

                      <div className="form-section">
                        
                        <div className="form-group">
                          <label htmlFor="registerInsurance">Insurance Provider</label>
                          <select
                            id="registerInsurance"
                            value={registerData.insuranceProvider}
                            onChange={(e) => handleRegisterChange('insuranceProvider', e.target.value)}
                          >
                            <option value="">Select Provider</option>
                            <option value="RAMA">RAMA</option>
                            <option value="MMI">MMI</option>
                            <option value="RSSB">RSSB</option>
                            <option value="EDEN">EDEN</option>
                            <option value="BRITAM">BRITAM</option>
                            <option value="RADIANT">RADIANT</option>
                            <option value="PRIME">PRIME</option>
                            <option value="None">None</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-section">
                        
                        <div className="form-group">
                          <label htmlFor="registerPassword" className="required">Password</label>
                          <input
                            type="password"
                            id="registerPassword"
                            required
                            placeholder="Create a password (min. 6 characters)"
                            value={registerData.password}
                            onChange={(e) => handleRegisterChange('password', e.target.value)}
                            minLength="6"
                          />
                          <small className="form-help">Minimum 6 characters</small>
                        </div>

                        <div className="form-group">
                          <label htmlFor="registerConfirmPassword" className="required">Confirm Password</label>
                          <input
                            type="password"
                            id="registerConfirmPassword"
                            required
                            placeholder="Confirm your password"
                            value={registerData.confirmPassword}
                            onChange={(e) => handleRegisterChange('confirmPassword', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="register-actions">
                      <button type="submit" className="submit-btn" disabled={isLoading}>
                        <i className="fas fa-user-plus"></i>
                        {isLoading ? 'Creating Account...' : 'Create Account'}
                      </button>
                    </div>
                  </div>
            </form>

            <div className="login-divider">
              <span>or</span>
            </div>

            <div className="register-prompt">
              <p>Already have an account?</p>
              <button 
                className="secondary-btn" 
                onClick={() => setIsRegisterMode(false)}
                type="button"
              >
                Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default LoginSection;
