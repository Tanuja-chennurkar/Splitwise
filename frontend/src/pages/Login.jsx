import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const submit = async () => {
    if (!email.trim() || !password) {
      return alert("Email and password are required");
    }
    try {
      const res = await api.post("/auth/login", { email, password });
      const token = res.data.access_token;
      localStorage.setItem("token", token);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      navigate("/");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Login failed");
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
      <div className="card" style={{ width: "100%", maxWidth: "420px", padding: "40px" }}>
        <h1 style={{ marginBottom: "20px", fontSize: "2rem" }}>Log In</h1>
        
        <div>
          <label htmlFor="login-email">Email Address</label>
          <input
            id="login-email"
            type="email"
            placeholder="e.g. rohan@local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="login-pw">Password</label>
          <input
            id="login-pw"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button onClick={submit} style={{ width: "100%", marginTop: "10px" }}>
          Log In
        </button>

        <p style={{ textAlign: "center", fontSize: "0.9rem", marginTop: "20px" }}>
          Don't have an account?{" "}
          <span
            onClick={() => navigate("/register")}
            style={{ color: "var(--primary)", cursor: "pointer", fontWeight: "600", textDecoration: "underline" }}
          >
            Sign Up
          </span>
        </p>
      </div>
    </div>
  );
}
