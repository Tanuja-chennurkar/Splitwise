import axios from "axios";

let baseURL = import.meta.env.VITE_API_URL;

// Bulletproof fallback: If VITE_API_URL is missing, default to production backend on Render
if (!baseURL || baseURL === "undefined" || baseURL === "http://127.0.0.1:8001") {
  if (typeof window !== "undefined" && window.location.hostname.includes("onrender.com")) {
    baseURL = "https://splitwise-backend-latest.onrender.com";
  } else {
    baseURL = "http://127.0.0.1:8001";
  }
}

const api = axios.create({
  baseURL: baseURL,
});

const token = localStorage.getItem('token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export default api;