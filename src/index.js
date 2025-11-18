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
  // Do NOT send cookies or credentials by default. This disables cookie-based
  // session behavior on the frontend so login/register flows do not depend on
  // server-set cookies. Backend must support token-based auth if needed.
  axios.defaults.withCredentials = false;
} catch (e) {

}


reportWebVitals();
