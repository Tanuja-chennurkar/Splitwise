import { useEffect, useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import "../App.css";

function Groups() {
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [importReport, setImportReport] = useState(null);
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
    try {
      await api.post("/groups", { name, description });
      setName("");
      setDescription("");
      fetchGroups();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e) => setCsvFile(e.target.files[0]);

  const uploadCsv = async () => {
    if (!csvFile) return;
    const fd = new FormData();
    fd.append("file", csvFile);
    try {
      const url = selectedGroupId ? `/expenses/import-csv?group_id=${selectedGroupId}` : "/expenses/import-csv";
      const res = await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImportReport(res.data);
      // navigate to import issues review page for this group
      navigate('/import-issues');
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
        <input type="text" placeholder="Group Name" value={name} onChange={(e) => setName(e.target.value)} />
        <br /><br />
        <input type="text" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <br /><br />
        <button onClick={createGroup}>Create Group</button>
      </div>

      <h2>Your Groups</h2>

      <div className="card">
        <h2>Import Expenses CSV</h2>
        <div style={{ marginBottom: 8 }}>
          <label htmlFor="import-group">Target Group: </label>
          <select id="import-group" value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button style={{ marginLeft: 8 }} onClick={() => navigate('/import-issues')}>Review Import Issues</button>
        </div>

        <input type="file" accept=".csv" onChange={handleFileChange} />
        <br /><br />
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
                  <div key={`import-row-${a.row}-${i}`} className="card" style={{ marginBottom: 8 }}>
                    <strong>Row {a.row}:</strong> {a.description}
                    {a.issue_id && <div>Issue ID: {a.issue_id}</div>}
                    <ul>
                      {a.anomalies.map((an, j) => (
                        <li key={`anomaly-${a.row}-${j}-${an}`}>{an}</li>
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
        <div className="card" key={group.id} onClick={() => navigate(`/groups/${group.id}`)} style={{ cursor: "pointer" }}>
          <h3>{group.name}</h3>
          <p>{group.description}</p>
        </div>
      ))}
    </div>
  );
}

export default Groups;
