import React from 'react';
import { useApp } from '../../context/AppContext';

const Notification = () => {
  const { notification } = useApp();

  if (!notification) return null;

  return (
    <div className={`notification ${notification.type}`}>
      <i className={`fas fa-${
        notification.type === 'success' ? 'check' : 
        notification.type === 'error' ? 'exclamation-triangle' : 'info'
      }`}></i>
      <span>{notification.message}</span>
    </div>
  );
};

export default Notification;
