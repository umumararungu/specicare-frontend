import React from 'react';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-left">
          <strong>SpeciCare</strong>
          <span> — Medical test booking platform</span>
        </div>
        <div className="footer-center">
          <a href="/">Home</a>
          <a href="/#">About</a>
          <a href="/#">Terms</a>
        </div>
        <div className="footer-right">
          <small>© {new Date().getFullYear()} SpeciCare. All rights reserved.</small>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
