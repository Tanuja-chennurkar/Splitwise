import { useEffect, useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import "../App.css";

function Groups() {
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [importReport, setImportReport] = useState(null);
  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    const res = await api.get("/groups");
    setGroups(res.data);
  };

  const createGroup = async () => {
    try {
      await api.post("/groups", {
        name,
        description,
      });

      setName("");
      setDescription("");

      fetchGroups();
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileChange = (e) => {
    setCsvFile(e.target.files[0]);
  };

  const uploadCsv = async () => {
    if (!csvFile) return;
    const fd = new FormData();
    fd.append("file", csvFile);
    try {
      const res = await api.post("/expenses/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportReport(res.data);
    } catch (err) {
      console.error(err);
      alert("Import failed - check backend logs");
    }
  };

  return (
    <div className="container">
      <h1>Splitwise</h1>

      <div className="card">
        <h2>Create Group</h2>

        <input
          type="text"
          placeholder="Group Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <br />
        <br />

        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <br />
        <br />

        <button onClick={createGroup}>
          Create Group
        </button>
      </div>

      <h2>Your Groups</h2>

      <div className="card">
        <h2>Import Expenses CSV</h2>
        <input type="file" accept=".csv" onChange={handleFileChange} />
        <br />
        <br />
        <button onClick={uploadCsv}>Upload and Import</button>

        {importReport && (
          <div style={{ marginTop: 12 }}>
            <h3>Import Report</h3>
            <p>Created: {importReport.created}</p>
            <h4>Anomalies</h4>
            {importReport.anomalies.length === 0 ? (
              <p>No anomalies</p>
            ) : (
              <div style={{ maxHeight: 300, overflow: "auto" }}>
                {importReport.anomalies.map((a, i) => (
                  <div key={i} className="card" style={{ marginBottom: 8 }}>
                    <strong>Row {a.row}:</strong> {a.description}
                    <ul>
                      {a.anomalies.map((an, j) => (
                        <li key={j}>{an}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {groups.map((group) => (
        <div
          className="card"
          key={group.id}
          onClick={() => navigate(`/groups/${group.id}`)}
          style={{ cursor: "pointer" }}
        >
          <h3>{group.name}</h3>
          <p>{group.description}</p>
        </div>
      ))}
    </div>
  );
}

export default Groups;