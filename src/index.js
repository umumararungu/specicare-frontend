import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


try {
  const apiUrl = (process.env.REACT_APP_API_URL || '').replace(/\/+$/, '');
  if (apiUrl) axios.defaults.baseURL = apiUrl;
  axios.defaults.withCredentials = true;
} catch (e) {

}


reportWebVitals();
