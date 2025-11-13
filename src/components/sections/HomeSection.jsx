import React from 'react';
import { useApp } from '../../context/AppContext';

const HomeSection = () => {
  const { setActiveSection } = useApp();

  return (
    <section id="home" className="section active">
      <div className="hero">
        <div className="hero-content">
          <h1>Find & Book Medical Tests in Rwanda</h1>
          <p>Connect with specialized diagnostic services across Rwanda. Save time, save money, get faster results.</p>
          <button 
            className="cta-button" 
            onClick={() => setActiveSection('search')}
          >
            Find Tests Now <i className="fas fa-arrow-right"></i>
          </button>
        </div>
        <div className="hero-image">
          <i className="fas fa-heartbeat"></i>
        </div>
      </div>

      {/* Features section - EXACTLY the same as your HTML */}
      <div className="features">
        <div className="feature-card">
          <i className="fas fa-search"></i>
          <h3>Find Tests</h3>
          <p>Search for specialized medical tests available near you</p>
        </div>
        
        <div className="feature-card">
          <i className="fas fa-calendar-check"></i>
          <h3>Book Online</h3>
          <p>Schedule appointments instantly with real-time availability</p>
        </div>
        
        <div className="feature-card">
          <i className="fas fa-file-medical"></i>
          <h3>Digital Results</h3>
          <p>Receive results online, no extra trips to the hospital</p>
        </div>
        
        <div className="feature-card">
          <i className="fas fa-sms"></i>
          <h3>SMS Alerts</h3>
          <p>Get instant notifications about appointments and results</p>
        </div>
      </div>

      {/* Stats section - EXACTLY the same */}
      <div className="stats">
        <div className="stat-item">
          <h3>50+</h3>
          <p>Medical Tests</p>
        </div>
        <div className="stat-item">
          <h3>25+</h3>
          <p>Partner Hospitals</p>
        </div>
        <div className="stat-item">
          <h3>2,000+</h3>
          <p>Patients Served</p>
        </div>
        <div className="stat-item">
          <h3>85%</h3>
          <p>Time Saved</p>
        </div>
      </div>
    </section>
  );
};

export default HomeSection;
