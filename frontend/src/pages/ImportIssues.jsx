import { useEffect, useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import "../App.css";

export default function ImportIssues() {
  const [issues, setIssues] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const res = await api.get("/import-issues");
      setIssues(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to load import issues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const resolve = async (id) => {
    try {
      await api.post(`/import-issues/${id}/resolve`, { action: "resolve", resolution_note: notes[id] || "Resolved" });
      fetchIssues();
    } catch (err) {
      console.error(err);
      alert("Failed to resolve issue");
    }
  };

  return (
    <div className="container">
      <h1>Import Issues</h1>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>Back</button>
      {loading ? (
        <p>Loading...</p>
      ) : issues.length === 0 ? (
        <p>No pending issues</p>
      ) : (
        <div>
          {issues.map((issue) => (
            <div key={issue.id} className="card" style={{ marginBottom: 12 }}>
              <div><strong>Issue {issue.id}</strong> — Row {issue.row_number}</div>
              <div>{issue.description}</div>
              <div><strong>Anomalies:</strong> {issue.anomalies}</div>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{issue.raw_data}</div>
              <textarea
                rows={2}
                placeholder="Resolution note"
                value={notes[issue.id] || ""}
                onChange={(e) => setNotes((p) => ({ ...p, [issue.id]: e.target.value }))}
                style={{ width: "100%", marginTop: 8 }}
              />
              <button onClick={() => resolve(issue.id)} style={{ marginTop: 8 }}>Resolve</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
