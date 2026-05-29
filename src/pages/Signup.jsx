import React, { useState } from "react";
import API from "../api";
import { useNavigate, Link } from "react-router-dom";
import "./Signup.css";

function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Custom Toast State
  const [notification, setNotification] = useState({
    show: false,
    type: "", // 'success' or 'error'
    message: "",
  });

  const triggerNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 4500);
  };

  const validateField = (name, value) => {
    let errorMsg = "";
    if (name === "username") {
      if (!value) {
        errorMsg = "Username is required";
      } else if (value.trim().length < 3) {
        errorMsg = "Username must be at least 3 characters";
      }
    } else if (name === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value) {
        errorMsg = "Email is required";
      } else if (!emailRegex.test(value)) {
        errorMsg = "Please enter a valid email address";
      }
    } else if (name === "password") {
      if (!value) {
        errorMsg = "Password is required";
      } else if (value.length < 6) {
        errorMsg = "Password must be at least 6 characters";
      }
    }
    setErrors((prev) => ({ ...prev, [name]: errorMsg }));
    return errorMsg === "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear errors on edit
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    validateField(name, value);
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    // Validate all 3 fields
    const isUserValid = validateField("username", form.username);
    const isEmailValid = validateField("email", form.email);
    const isPasswordValid = validateField("password", form.password);

    if (!isUserValid || !isEmailValid || !isPasswordValid) {
      triggerNotification("error", "Please fix form errors before registering.");
      return;
    }

    setLoading(true);

    try {
      await API.post("/auth/signup", form);

      triggerNotification("success", "Account created successfully! Loading portal...");

      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      const errMsg = err.response?.data?.message || "Registration failed. Please try again.";
      triggerNotification("error", errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container fade-in-up">
      <div className="ambient-spotlight"></div>

      <div className="auth-card">
        {/* Left Side: Matching Showcase */}
        <div className="auth-showcase">
          <div className="showcase-glow"></div>
          <div className="showcase-content">
            <div className="logo-area">
              <svg className="app-logo" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="brand-name">Aura Spaces</span>
            </div>
            <h1 className="showcase-heading">Join the <br /><span className="text-glow">Aura Network.</span></h1>
            <p className="showcase-desc">Create your workspace identity today and enjoy real-time interactions with seamless data integrations.</p>

            <div className="feature-list">
              <div className="feature-item">
                <div className="feature-icon">✨</div>
                <span>Curated obsidian glass styling</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                <span>Socket-driven immediate sync</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔒</div>
                <span>Protected authorization channels</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Signup Form */}
        <div className="auth-form-side">
          {notification.show && (
            <div className={`notification-toast ${notification.type}`}>
              <div className="toast-icon">
                {notification.type === "success" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>
              <span className="toast-message">{notification.message}</span>
              <button className="toast-close" onClick={() => setNotification({ show: false, type: "", message: "" })}>×</button>
            </div>
          )}

          <div className="form-header">
            <h2>Create Account</h2>
            <p>Sign up in seconds to start sending messages.</p>
          </div>

          <form onSubmit={handleSignup} className="form-inputs">
            {/* Username Input */}
            <div className={`input-group ${errors.username ? "has-error" : ""}`}>
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={form.username}
                  placeholder="johndoe"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={loading}
                  required
                />
              </div>
              {errors.username && <span className="error-text">{errors.username}</span>}
            </div>

            {/* Email Input */}
            <div className={`input-group ${errors.email ? "has-error" : ""}`}>
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </span>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={form.email}
                  placeholder="john@example.com"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={loading}
                  required
                />
              </div>
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            {/* Password Input */}
            <div className={`input-group ${errors.password ? "has-error" : ""}`}>
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={form.password}
                  placeholder="••••••••"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <div className="btn-spinner-content">
                  <span className="spinner-dot animate-dot1"></span>
                  <span className="spinner-dot animate-dot2"></span>
                  <span className="spinner-dot animate-dot3"></span>
                </div>
              ) : (
                "Create Free Account"
              )}
            </button>
          </form>

          <div className="auth-footer-link">
            <span>Already have an account? </span>
            <Link to="/" className="accent-link">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
