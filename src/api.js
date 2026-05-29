import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Executed before every outbound API request
API.interceptors.request.use(
  (config) => {
    // You can attach headers or perform audits here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handles responses and centralizes authorization errors globally
API.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;
      // If 401 Unauthorized or 403 Forbidden, session has expired
      if (status === 401 || status === 403) {
        localStorage.removeItem("user");

        // Prevent infinite loops if user is already on public routes
        if (window.location.pathname !== "/" && window.location.pathname !== "/signup") {
          window.location.href = "/";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default API;
