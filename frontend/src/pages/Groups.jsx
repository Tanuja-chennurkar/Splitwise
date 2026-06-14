import { useEffect, useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

function Groups() {
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await api.get("/groups");
      setGroups(res.data);
      if (res.data.length > 0) setSelectedGroupId(res.data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const createGroup = async () => {
    if (!name.trim()) return alert("Please enter a group name");
    try {
      await api.post("/groups", { name, description });
      setName("");
      setDescription("");
      fetchGroups();
    } catch (err) {
      console.error(err);
      alert("Failed to create group");
    }
  };

  const handleFileChange = (e) => setCsvFile(e.target.files[0]);

  const uploadCsv = async () => {
    if (!csvFile) return alert("Please select a CSV file first");
    setLoading(true);
    const fd = new FormData();
    fd.append("file", csvFile);
    try {
      const url = selectedGroupId ? `/expenses/import-csv?group_id=${selectedGroupId}` : "/expenses/import-csv";
      await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
      alert("CSV uploaded! Redirecting to review issues...");
      navigate("/import-issues");
    } catch (err) {
      console.error(err);
      alert("Import failed - check backend logs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 style={{ marginTop: "20px" }}>Splitwise</h1>

      <div className="grid-cols-2">
        {/* Create Group Card */}
        <div className="card">
          <h2>Create Group</h2>
          <div>
            <label htmlFor="group-name-input">Group Name</label>
            <input
              id="group-name-input"
              type="text"
              placeholder="e.g. Flatmates 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="group-desc-input">Description</label>
            <input
              id="group-desc-input"
              type="text"
              placeholder="Shared apartment rent and utilities"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <button onClick={createGroup} style={{ width: "100%", marginTop: "10px" }}>
            Create Group
          </button>
        </div>

        {/* CSV Import Card */}
        <div className="card">
          <h2>Import CSV</h2>
          <div>
            <label htmlFor="import-group-select">Target Group</label>
            <select
              id="import-group-select"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="csv-file-input">Select Spreadsheet Export (.csv)</label>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ padding: "8px 0", background: "transparent", border: "none" }}
            />
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button onClick={uploadCsv} style={{ flex: 1 }} disabled={loading}>
              {loading ? "Importing..." : "Upload & Parse"}
            </button>
            <button
              onClick={() => navigate("/import-issues")}
              className="secondary"
              style={{ flex: 1 }}
            >
              Review Issues
            </button>
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: "20px", marginBottom: "15px" }}>Your Active Groups</h2>
      {groups.length === 0 ? (
        <p style={{ textAlign: "center", marginTop: "20px" }}>No groups found. Create one above to get started!</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
          {groups.map((group) => (
            <div
              className="card card-interactive"
              key={group.id}
              onClick={() => navigate(`/groups/${group.id}`)}
              style={{ margin: 0 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ margin: 0, color: "#10b981" }}>{group.name}</h3>
                <span className="badge badge-resolved" style={{ fontSize: "0.65rem" }}>Active</span>
              </div>
              <p style={{ fontSize: "0.9rem", minHeight: "45px" }}>
                {group.description || "No description provided."}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Groups;
