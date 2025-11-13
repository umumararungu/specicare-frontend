import React from 'react';
import { useApp } from '../../context/AppContext';

const Header = () => {
  const { currentUser, activeSection, setActiveSection } = useApp();

  const handleNavClick = (sectionId) => {
    setActiveSection(sectionId);
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-logo">
          <i className="fas fa-stethoscope"></i>
          <span>SpeciCare</span>
        </div>
        
        <div className="nav-menu">
          <a 
            href="#home" 
            className={`nav-link ${activeSection === 'home' ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('home');
            }}
          >
            Home
          </a>
          
          <a 
            href="#search" 
            className={`nav-link ${activeSection === 'search' ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('search');
            }}
          >
            Find Tests
          </a>
          
          {currentUser && (
            <a 
              href="#dashboard" 
              className={`nav-link ${activeSection === 'dashboard' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('dashboard');
              }}
            >
              Dashboard
            </a>
          )}
          
          <a 
            href={currentUser ? (currentUser.role === 'admin' ? '#admin' : '#dashboard') : '#login'}
            className="nav-link login-btn"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick(currentUser ? (currentUser.role === 'admin' ? 'admin' : 'dashboard') : 'login');
            }}
          >
            {currentUser ? (currentUser.role === 'admin' ? 'Admin' : 'Dashboard') : 'Login'}
          </a>
        </div>
        
        <div className="mobile-menu-btn">
          <i className="fas fa-bars"></i>
        </div>
      </div>
    </nav>
  );
};

export default Header;
