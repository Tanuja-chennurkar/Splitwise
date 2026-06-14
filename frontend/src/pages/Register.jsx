import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      return alert("All fields are required");
    }
    if (password !== confirmPassword) {
      return alert("Passwords do not match");
    }
    try {
      // Register the user
      await api.post("/auth/register", { name, email, password });
      
      // Auto login after registration
      const loginRes = await api.post("/auth/login", { email, password });
      const token = loginRes.data.access_token;
      localStorage.setItem("token", token);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      
      alert("Registration successful!");
      navigate("/");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Registration failed");
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
      <div className="card" style={{ width: "100%", maxWidth: "420px", padding: "40px" }}>
        <h1 style={{ marginBottom: "20px", fontSize: "2rem" }}>Create Account</h1>
        
        <div>
          <label htmlFor="reg-name">Full Name</label>
          <input
            id="reg-name"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        
        <div>
          <label htmlFor="reg-email">Email Address</label>
          <input
            id="reg-email"
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="reg-pw">Password</label>
          <input
            id="reg-pw"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="reg-conf-pw">Confirm Password</label>
          <input
            id="reg-conf-pw"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button onClick={submit} style={{ width: "100%", marginTop: "10px" }}>
          Sign Up
        </button>

        <p style={{ textAlign: "center", fontSize: "0.9rem", marginTop: "20px" }}>
          Already have an account?{" "}
          <span
            onClick={() => navigate("/login")}
            style={{ color: "var(--primary)", cursor: "pointer", fontWeight: "600", textDecoration: "underline" }}
          >
            Log In
          </span>
        </p>
      </div>
    </div>
  );
}
