import React from 'react';
import { useApp } from '../../context/AppContext';

// Import all sections
import HomeSection from '../sections/HomeSection';
import SearchSection from '../sections/SearchSection';
import DashboardSection from '../sections/DashboardSection';
import LoginSection from '../sections/LoginSection';
import AdminSection from '../sections/AdminSection';
import ForgotPasswordSection from '../sections/ForgotPasswordSection';
import ResetPasswordSection from '../sections/ResetPasswordSection';
import BookingModal from './BookingModal';

const MainContent = () => {
  const { activeSection, currentTest } = useApp();

  console.log('MainContent - Current Test:', currentTest); // Debug log

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <HomeSection />;
      case 'search':
        return <SearchSection />;
      case 'dashboard':
        return <DashboardSection />;
      case 'login':
        return <LoginSection />;
      case 'forgot':
        return <ForgotPasswordSection />;
      case 'reset':
        return <ResetPasswordSection />;
      case 'admin':
        return <AdminSection />;
      default:
        return <HomeSection />;
    }
  };

  return (
    <main>
      {renderSection()}
      {/* Always render BookingModal - it controls its own visibility */}
      <BookingModal />
    </main>
  );
};

export default MainContent;