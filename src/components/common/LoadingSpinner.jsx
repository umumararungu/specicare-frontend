import React from 'react';
import { useApp } from '../../context/AppContext';

const LoadingSpinner = () => {
  const { isLoading } = useApp();

  if (!isLoading) return null;

  return (
    <div id="loadingSpinner" className="loading-spinner">
      <div className="spinner"></div>
    </div>
  );
};

export default LoadingSpinner;
