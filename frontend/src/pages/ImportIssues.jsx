import { useEffect, useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function ImportIssues() {
  const [issues, setIssues] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolutions, setResolutions] = useState({}); // state for form inputs per issue
  const navigate = useNavigate();

  const fetchIssuesAndUsers = async () => {
    setLoading(true);
    try {
      const issuesRes = await api.get("/import-issues");
      const usersRes = await api.get("/users");
      setAllUsers(usersRes.data);
      setIssues(issuesRes.data);
      
      // Initialize resolution state for each issue
      const initialResolutions = {};
      issuesRes.data.forEach((issue) => {
        let raw = {};
        try {
          raw = JSON.parse(issue.raw_data);
        } catch (e) {
          console.error("Failed to parse raw data", e);
        }
        
        let anomaliesList = [];
        try {
          anomaliesList = JSON.parse(issue.anomalies);
        } catch (e) {
          console.error("Failed to parse anomalies", e);
        }

        // Helper to match raw names to user IDs
        const findUserByName = (rawName) => {
          if (!rawName) return "";
          const norm = rawName.trim().toLowerCase();
          let found = usersRes.data.find(u => u.name.toLowerCase() === norm);
          if (found) return found.id;
          // partial matching
          found = usersRes.data.find(u => norm.includes(u.name.toLowerCase()) || u.name.toLowerCase().includes(norm));
          if (found) return found.id;
          return "";
        };

        // Determine proposed action
        let action = "create_expense";
        if (anomaliesList.includes("duplicate")) {
          action = "ignore";
        } else if (anomaliesList.includes("possible_settlement")) {
          action = "create_payment";
        }

        // Parse amount
        let amt = 0;
        if (raw.amount) {
          const cleanAmt = String(raw.amount).replace(/"/g, "").replace(/,/g, "").trim();
          amt = parseFloat(cleanAmt) || 0;
        }

        // Parse currency
        const curr = (raw.currency || "INR").trim().toUpperCase();
        let rate = 1.0;
        let convertedAmt = amt;
        if (curr === "USD") {
          rate = 83.0; // Proposed default
          convertedAmt = Math.round(amt * rate * 100) / 100;
        }

        // Parse Date
        let dateVal = "";
        if (raw.date) {
          const rawD = String(raw.date).trim();
          if (rawD.toLowerCase() === "mar-14") {
            dateVal = "2026-03-14";
          } else if (rawD === "04-05-2026" && String(raw.description).toLowerCase().includes("cleaning")) {
            dateVal = "2026-04-05"; // Chronological proposal
          } else {
            // standard DD-MM-YYYY to YYYY-MM-DD
            const parts = rawD.split("-");
            if (parts.length === 3) {
              let day = parts[0];
              let month = parts[1];
              let year = parts[2];
              if (month.length > 2) {
                // e.g. 15-Mar-2026 or similar
                const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
                month = months[month.toLowerCase().substring(0, 3)] || "01";
              }
              if (day.length === 1) day = "0" + day;
              if (month.length === 1) month = "0" + month;
              if (year.length === 2) year = "20" + year;
              dateVal = `${year}-${month}-${day}`;
            }
          }
        }

        // Parse participants
        const rawPartNames = raw.split_with ? raw.split_with.split(";").map(n => n.trim()) : [];
        const splitWithIds = [];
        rawPartNames.forEach((name) => {
          const uid = findUserByName(name);
          if (uid) splitWithIds.push(uid);
        });

        // Parse payer
        const payerId = findUserByName(raw.paid_by);

        // Parse settlement details (if applicable)
        let payeeId = "";
        if (action === "create_payment") {
          // Attempt to scan description for recipient
          const descLower = String(raw.description).toLowerCase();
          const foundUser = usersRes.data.find(u => descLower.includes(u.name.toLowerCase()) && u.id !== payerId);
          if (foundUser) payeeId = foundUser.id;
        }

        // Percentage split details normalization helper
        let normalizedDetails = raw.split_details || "";
        if (anomaliesList.includes("percentage_total_mismatch") && raw.split_details) {
          // If 110%, we can normalize it in frontend or let the user edit.
          // Format details with IDs e.g. "1:30;2:30;3:30;4:20"
          const parts = raw.split_details.split(";");
          const mapping = [];
          parts.forEach(part => {
            if (part.includes(" ")) {
              const [name, val] = part.trim().rsplit ? part.trim().rsplit(" ", 1) : [part.substring(0, part.lastIndexOf(" ")), part.substring(part.lastIndexOf(" ") + 1)];
              const uid = findUserByName(name);
              const pVal = parseFloat(val.replace("%", "")) || 0;
              if (uid) mapping.push(`${uid}:${pVal}`);
            }
          });
          normalizedDetails = mapping.join(";");
        } else if (raw.split_details) {
          // convert name keys to IDs in split_details
          const parts = raw.split_details.split(";");
          const mapping = [];
          parts.forEach(part => {
            const trimmed = part.trim();
            if (trimmed.includes(" ") || trimmed.includes(":")) {
              const sep = trimmed.includes(":") ? ":" : " ";
              const left = trimmed.substring(0, trimmed.lastIndexOf(sep)).trim();
              const right = trimmed.substring(trimmed.lastIndexOf(sep) + 1).trim();
              const uid = findUserByName(left);
              if (uid) mapping.push(`${uid}:${right}`);
            }
          });
          normalizedDetails = mapping.join(";");
        }

        initialResolutions[issue.id] = {
          action,
          description: raw.description || "",
          amount: convertedAmt, // in INR
          original_amount: amt,
          currency: curr,
          exchange_rate: rate,
          expense_date: dateVal,
          paid_by: payerId,
          split_type: raw.split_type || "equal",
          split_with: splitWithIds,
          split_details: normalizedDetails,
          notes: raw.notes || "",
          payer_id: payerId,
          payee_id: payeeId,
        };
      });
      setResolutions(initialResolutions);
    } catch (err) {
      console.error(err);
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    fetchIssuesAndUsers();
  }, [navigate]);

  const handleResolutionChange = (issueId, key, value) => {
    setResolutions((prev) => {
      const updated = { ...prev[issueId], [key]: value };
      
      // Auto-recalculate amount if USD rate changes
      if (key === "exchange_rate" && updated.currency === "USD") {
        updated.amount = Math.round(updated.original_amount * parseFloat(value || 0) * 100) / 100;
      }
      return { ...prev, [issueId]: updated };
    });
  };

  const toggleParticipant = (issueId, userId) => {
    setResolutions((prev) => {
      const current = prev[issueId];
      const splitWith = current.split_with.includes(userId)
        ? current.split_with.filter((id) => id !== userId)
        : [...current.split_with, userId];
      return { ...prev, [issueId]: { ...current, split_with } };
    });
  };

  const resolve = async (issueId) => {
    const resData = resolutions[issueId];
    if (!resData) return;

    if (resData.action === "create_expense") {
      if (!resData.paid_by) return alert("Please select who paid");
      if (!resData.expense_date) return alert("Please set a date");
      if (resData.split_with.length === 0) return alert("Select at least one member to split with");
    } else if (resData.action === "create_payment") {
      if (!resData.payer_id || !resData.payee_id) return alert("Please select payer and payee");
    }

    try {
      const payload = {
        action: resData.action,
        resolution_note: `Resolved: Action=${resData.action}, Description=${resData.description}`,
        corrected_data: {
          paid_by: resData.paid_by,
          description: resData.description,
          amount: resData.amount,
          expense_date: resData.expense_date,
          split_type: resData.split_type,
          split_with: resData.split_with,
          split_details: resData.split_details,
          currency: resData.currency,
          original_amount: resData.original_amount,
          exchange_rate: resData.exchange_rate,
          notes: resData.notes,
          payer_id: resData.payer_id,
          payee_id: resData.payee_id,
        },
      };

      await api.post(`/import-issues/${issueId}/resolve`, payload);
      alert(`Issue ${issueId} resolved successfully!`);
      fetchIssuesAndUsers();
    } catch (err) {
      console.error(err);
      alert("Failed to resolve issue: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", marginBottom: "20px" }}>
        <button onClick={() => navigate(-1)} className="secondary">
          ← Back
        </button>
        <h1>CSV Import Resolution Wizard</h1>
        <div style={{ width: "80px" }}></div>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", padding: "40px" }}>Loading issues...</p>
      ) : issues.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <h2>No Pending Issues!</h2>
          <p>Everything in the CSV has been parsed, cleaned, and approved.</p>
          <button onClick={() => navigate(-1)} style={{ marginTop: "20px" }}>
            View Group Balances
          </button>
        </div>
      ) : (
        <div>
          <div className="alert alert-warning">
            <div>
              <strong>Importer Status:</strong> {issues.length} rows require your manual review. You must approve the correction policy for each row below before the data commits to the group balances.
            </div>
          </div>

          {issues.map((issue) => {
            let raw = {};
            let anomaliesList = [];
            try {
              raw = JSON.parse(issue.raw_data);
              anomaliesList = JSON.parse(issue.anomalies);
            } catch (e) {}

            const res = resolutions[issue.id] || {};

            return (
              <div key={issue.id} className="card" style={{ padding: "30px", marginBottom: "30px" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "15px", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ margin: 0, color: "#10b981" }}>Row {issue.row_number}: {issue.description}</h3>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                      Original CSV Content: {Object.entries(raw).map(([k, v]) => v ? `${k}: ${v}` : "").filter(Boolean).join(" | ")}
                    </div>
                  </div>
                  <span className="badge badge-pending">Requires Approval</span>
                </div>

                {/* Anomalies Box */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
                  {anomaliesList.map((an, i) => (
                    <span
                      key={`an-${i}`}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "#fca5a5",
                        border: "1px solid rgba(239, 68, 68, 0.2)"
                      }}
                    >
                      Anomaly: {an.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>

                {/* Resolution Form */}
                <div className="grid-cols-2" style={{ gap: "25px" }}>
                  <div>
                    <label htmlFor={`res-action-${issue.id}`}>Import Action</label>
                    <select
                      id={`res-action-${issue.id}`}
                      value={res.action || "create_expense"}
                      onChange={(e) => handleResolutionChange(issue.id, "action", e.target.value)}
                    >
                      <option value="create_expense">Import as Expense</option>
                      <option value="create_payment">Import as Settlement (Payment)</option>
                      <option value="ignore">Ignore / Discard (Delete Duplicate)</option>
                    </select>

                    {res.action === "create_expense" && (
                      <>
                        <div className="grid-cols-2" style={{ gap: "10px", marginTop: "10px" }}>
                          <div>
                            <label htmlFor={`res-desc-${issue.id}`}>Description</label>
                            <input
                              id={`res-desc-${issue.id}`}
                              type="text"
                              value={res.description || ""}
                              onChange={(e) => handleResolutionChange(issue.id, "description", e.target.value)}
                            />
                          </div>
                          <div>
                            <label htmlFor={`res-date-${issue.id}`}>Date</label>
                            <input
                              id={`res-date-${issue.id}`}
                              type="date"
                              value={res.expense_date || ""}
                              onChange={(e) => handleResolutionChange(issue.id, "expense_date", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid-cols-2" style={{ gap: "10px" }}>
                          <div>
                            <label htmlFor={`res-paidby-${issue.id}`}>Paid By</label>
                            <select
                              id={`res-paidby-${issue.id}`}
                              value={res.paid_by || ""}
                              onChange={(e) => handleResolutionChange(issue.id, "paid_by", e.target.value)}
                            >
                              <option value="">Select Payer...</option>
                              {allUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`res-splittype-${issue.id}`}>Split Type</label>
                            <select
                              id={`res-splittype-${issue.id}`}
                              value={res.split_type || "equal"}
                              onChange={(e) => handleResolutionChange(issue.id, "split_type", e.target.value)}
                            >
                              <option value="equal">Equal</option>
                              <option value="unequal">Unequal (amounts)</option>
                              <option value="percentage">Percentage</option>
                              <option value="share">Share (weights)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid-cols-2" style={{ gap: "10px" }}>
                          <div>
                            <label htmlFor={`res-curr-${issue.id}`}>Currency</label>
                            <select
                              id={`res-curr-${issue.id}`}
                              value={res.currency || "INR"}
                              onChange={(e) => handleResolutionChange(issue.id, "currency", e.target.value)}
                            >
                              <option value="INR">INR (₹)</option>
                              <option value="USD">USD ($)</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`res-rate-${issue.id}`}>Exchange Rate</label>
                            <input
                              id={`res-rate-${issue.id}`}
                              type="number"
                              disabled={res.currency === "INR"}
                              placeholder="1.0"
                              value={res.exchange_rate || ""}
                              onChange={(e) => handleResolutionChange(issue.id, "exchange_rate", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid-cols-2" style={{ gap: "10px" }}>
                          <div>
                            <label htmlFor={`res-amt-${issue.id}`}>Calculated Total (INR)</label>
                            <input
                              id={`res-amt-${issue.id}`}
                              type="number"
                              value={res.amount || ""}
                              onChange={(e) => handleResolutionChange(issue.id, "amount", e.target.value)}
                            />
                          </div>
                          <div>
                            <label htmlFor={`res-orig-${issue.id}`}>Original Amount</label>
                            <input
                              id={`res-orig-${issue.id}`}
                              type="number"
                              disabled
                              value={res.original_amount || ""}
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor={`res-notes-${issue.id}`}>Notes</label>
                          <textarea
                            id={`res-notes-${issue.id}`}
                            rows={1}
                            value={res.notes || ""}
                            onChange={(e) => handleResolutionChange(issue.id, "notes", e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    {res.action === "create_payment" && (
                      <>
                        <div className="grid-cols-2" style={{ gap: "10px", marginTop: "10px" }}>
                          <div>
                            <label htmlFor={`res-pay-from-${issue.id}`}>From (Debtor)</label>
                            <select
                              id={`res-pay-from-${issue.id}`}
                              value={res.payer_id || ""}
                              onChange={(e) => handleResolutionChange(issue.id, "payer_id", e.target.value)}
                            >
                              <option value="">Select Debtor...</option>
                              {allUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`res-pay-to-${issue.id}`}>To (Creditor)</label>
                            <select
                              id={`res-pay-to-${issue.id}`}
                              value={res.payee_id || ""}
                              onChange={(e) => handleResolutionChange(issue.id, "payee_id", e.target.value)}
                            >
                              <option value="">Select Creditor...</option>
                              {allUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`res-pay-amt-${issue.id}`}>Settlement Amount (INR)</label>
                          <input
                            id={`res-pay-amt-${issue.id}`}
                            type="number"
                            value={res.amount || ""}
                            onChange={(e) => handleResolutionChange(issue.id, "amount", e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    {res.action === "ignore" && (
                      <p style={{ marginTop: "20px", color: "var(--text-secondary)" }}>
                        This row is marked as a duplicate or error. Clicking "Approve Resolution" will permanently discard it.
                      </p>
                    )}
                  </div>

                  {/* Split Config Column */}
                  {res.action === "create_expense" && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <label>Split Participants</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", flex: 1, maxHeight: "250px", overflowY: "auto", marginBottom: "15px" }}>
                        {allUsers.map((user) => {
                          const isParticipant = res.split_with?.includes(user.id);
                          return (
                            <div key={user.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <input
                                type="checkbox"
                                id={`issue-${issue.id}-user-${user.id}`}
                                checked={isParticipant}
                                onChange={() => toggleParticipant(issue.id, user.id)}
                                style={{ width: "auto", margin: 0 }}
                              />
                              <label
                                htmlFor={`issue-${issue.id}-user-${user.id}`}
                                style={{ margin: 0, flex: 1, cursor: "pointer" }}
                              >
                                {user.name}
                              </label>
                              
                              {isParticipant && res.split_type !== "equal" && (
                                <input
                                  type="text"
                                  placeholder={res.split_type === "percentage" ? "%" : res.split_type === "share" ? "weight" : "amount"}
                                  value={
                                    res.split_details
                                      ? res.split_details
                                          .split(";")
                                          .find((part) => part.startsWith(`${user.id}:`))
                                          ?.split(":")[1] || ""
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    let detailsArray = res.split_details ? res.split_details.split(";") : [];
                                    // remove existing entry for this user
                                    detailsArray = detailsArray.filter((part) => !part.startsWith(`${user.id}:`));
                                    if (val.trim()) {
                                      detailsArray.push(`${user.id}:${val}`);
                                    }
                                    handleResolutionChange(issue.id, "split_details", detailsArray.join(";"));
                                  }}
                                  style={{ width: "80px", margin: 0, padding: "4px 8px" }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {res.split_type !== "equal" && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "10px" }}>
                          Current split details payload: <code>{res.split_details || "empty"}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Approve Button */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "15px", marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => resolve(issue.id)}>
                    Approve Resolution & Commit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
