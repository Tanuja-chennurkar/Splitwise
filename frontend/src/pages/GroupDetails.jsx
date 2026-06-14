import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";

function GroupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [balances, setBalances] = useState({});
  const [suggestedSettlements, setSuggestedSettlements] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [newMemberId, setNewMemberId] = useState("");

  // Expense forms state
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [splitType, setSplitType] = useState("equal");
  const [splitValues, setSplitValues] = useState({});

  // Currency fields for manually created expenses
  const [currency, setCurrency] = useState("INR");
  const [rate, setRate] = useState("1.0");

  // Payment/settlement form state
  const [settlePayer, setSettlePayer] = useState("");
  const [settlePayee, setSettlePayee] = useState("");
  const [settleAmount, setSettleAmount] = useState("");

  // Ledger modal state
  const [showLedger, setShowLedger] = useState(false);
  const [ledgerUser, setLedgerUser] = useState(null);
  const [ledgerData, setLedgerData] = useState([]);

  const getPlaceholder = (type) => {
    if (type === "percentage") return "%";
    if (type === "share") return "weight";
    return "amount";
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const membersRes = await api.get(`/memberships/groups/${id}`);
      const usersRes = await api.get("/users");
      const balancesRes = await api.get(`/groups/${id}/balances`);
      const expensesRes = await api.get("/expenses");

      const groupExpenses = expensesRes.data.filter(
        (expense) => expense.group_id === Number(id)
      );

      setMembers(membersRes.data);
      setAllUsers(usersRes.data);
      setBalances(balancesRes.data.balances || {});
      setSuggestedSettlements(balancesRes.data.suggested_settlements || []);
      setExpenses(groupExpenses);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleMember = (memberId) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter((mid) => mid !== memberId));
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
    }
  };

  const createExpense = async () => {
    try {
      if (!description.trim()) return alert("Enter description");
      if (!amount) return alert("Enter amount");
      if (!paidBy) return alert("Select who paid");
      if (selectedMembers.length === 0) return alert("Select at least one member to split with");

      // Compute normalized amount in INR
      const parsedAmount = Number(amount);
      const parsedRate = Number(rate) || 1.0;
      const normalizedAmount = currency.toUpperCase() === "USD" ? parsedAmount * parsedRate : parsedAmount;

      // split details format: "id:val;id:val"
      const splitDetailsStr = splitType === "equal"
        ? null
        : selectedMembers.map((m) => `${m}:${splitValues[m] || 0}`).join(";");

      await api.post("/expenses", {
        group_id: Number(id),
        paid_by: Number(paidBy),
        description,
        amount: Math.round(normalizedAmount * 100) / 100, // normalized to INR
        expense_date: new Date().toISOString().split("T")[0],
        split_with: selectedMembers,
        split_type: splitType,
        split_details: splitDetailsStr,
        currency: currency.upper ? currency.upper() : currency,
        original_amount: parsedAmount,
        exchange_rate: parsedRate
      });

      // Reset
      setDescription("");
      setAmount("");
      setPaidBy("");
      setSelectedMembers([]);
      setSplitValues({});
      setCurrency("INR");
      setRate("1.0");

      fetchData();
    } catch (error) {
      console.error(error);
      alert("Failed to create expense");
    }
  };

  const deleteExpense = async (expenseId) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await api.delete(`/expenses/${expenseId}`);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const recordPayment = async () => {
    if (!settlePayer || !settlePayee || !settleAmount) return alert("Fill all fields");
    if (settlePayer === settlePayee) return alert("Payer and payee must be different");
    try {
      await api.post("/payments", {
        group_id: Number(id),
        payer_id: Number(settlePayer),
        payee_id: Number(settlePayee),
        amount: Number(settleAmount),
      });
      setSettleAmount("");
      setSettlePayer("");
      setSettlePayee("");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to record settlement");
    }
  };

  const openLedgerModal = async (member) => {
    try {
      const res = await api.get(`/groups/${id}/members/${member.id}/ledger`);
      setLedgerUser(member);
      setLedgerData(res.data);
      setShowLedger(true);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch member ledger");
    }
  };

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", marginBottom: "20px" }}>
        <button onClick={() => navigate("/")} className="secondary">
          ← Back to Dashboard
        </button>
        <h1>Group Details</h1>
        <button onClick={() => navigate("/import-issues")} style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)" }}>
          CSV Issues Dashboard
        </button>
      </div>

      <div className="grid-cols-2">
        {/* Members list */}
        <div className="card">
          <h2>Group Members</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "250px", overflowY: "auto", marginBottom: "15px" }}>
            {members.map((member) => (
              <div
                key={member.membership_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.05)"
                }}
              >
                <div>
                  <div style={{ fontWeight: "500" }}>{member.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{member.email}</div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => openLedgerModal(member)} className="secondary" style={{ padding: "4px 8px", fontSize: "0.8rem" }}>
                    View Ledger
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Remove ${member.name}?`)) return;
                      try {
                        await api.delete(`/memberships/${member.membership_id}`);
                        fetchData();
                      } catch (err) {
                        console.error(err);
                        alert("Failed to remove member");
                      }
                    }}
                    className="danger"
                    style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <select
              value={newMemberId}
              onChange={(e) => setNewMemberId(e.target.value)}
              style={{ margin: 0 }}
            >
              <option value="">Add existing user...</option>
              {allUsers
                .filter((u) => !members.some((m) => m.id === u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
            </select>
            <button
              onClick={async () => {
                if (!newMemberId) return alert("Select a user to add");
                try {
                  await api.post(`/memberships/groups/${id}`, {
                    user_id: Number(newMemberId),
                    joined_at: new Date().toISOString().split("T")[0],
                  });
                  setNewMemberId("");
                  fetchData();
                } catch (err) {
                  console.error(err);
                  alert("Failed to add member");
                }
              }}
              style={{ padding: "0 20px" }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Balances Card */}
        <div className="card">
          <h2>Balances & Settlements</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {Object.entries(balances).map(([userId, user]) => (
              <div
                key={userId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: user.balance >= 0 ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)",
                  border: user.balance >= 0 ? "1px solid rgba(16, 185, 129, 0.15)" : "1px solid rgba(239, 68, 68, 0.15)"
                }}
              >
                <span style={{ fontWeight: "500" }}>{user.name}</span>
                <span
                  style={{
                    color: user.balance >= 0 ? "var(--success)" : "var(--danger)",
                    fontWeight: "bold",
                  }}
                >
                  {user.balance >= 0 ? "+" : ""}₹{user.balance.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <h3 style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "15px", marginBottom: "10px" }}>
            Suggested Direct Transfers
          </h3>
          {suggestedSettlements.length === 0 ? (
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>All settled up!</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {suggestedSettlements.map((settle, i) => (
                <div
                  key={`settle-${i}`}
                  style={{
                    fontSize: "0.9rem",
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.02)",
                    borderLeft: "4px solid var(--accent)",
                    borderRadius: "0 8px 8px 0"
                  }}
                >
                  <strong>{settle.from_user_name}</strong> owes <strong>{settle.to_user_name}</strong>{" "}
                  <span style={{ color: "var(--success)", fontWeight: "600" }}>₹{settle.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid-cols-2">
        {/* Add Expense Form */}
        <div className="card">
          <h2>Add Expense</h2>
          <div className="grid-cols-2" style={{ gap: "10px" }}>
            <div>
              <label htmlFor="exp-desc">Description</label>
              <input
                id="exp-desc"
                type="text"
                placeholder="Rent, Groceries, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="exp-amount">Amount</label>
              <input
                id="exp-amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-cols-2" style={{ gap: "10px" }}>
            <div>
              <label htmlFor="exp-currency">Currency</label>
              <select id="exp-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label htmlFor="exp-rate">Exchange Rate (INR / USD)</label>
              <input
                id="exp-rate"
                type="number"
                disabled={currency === "INR"}
                placeholder="e.g. 83.0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-cols-2" style={{ gap: "10px" }}>
            <div>
              <label htmlFor="exp-paidby">Paid By</label>
              <select id="exp-paidby" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                <option value="">Select payer...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="exp-splittype">Split Type</label>
              <select id="exp-splittype" value={splitType} onChange={(e) => setSplitType(e.target.value)}>
                <option value="equal">Equal</option>
                <option value="unequal">Unequal (amounts)</option>
                <option value="percentage">Percentage</option>
                <option value="share">Share (weights)</option>
              </select>
            </div>
          </div>

          <label style={{ marginTop: "10px" }}>Split Between</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto", padding: "8px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", marginBottom: "15px" }}>
            {members.map((member) => (
              <div key={member.id} style={{ display: "flex", alignItems: "center", justifyItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  id={`chk-${member.id}`}
                  checked={selectedMembers.includes(member.id)}
                  onChange={() => toggleMember(member.id)}
                  style={{ width: "auto", margin: 0 }}
                />
                <label htmlFor={`chk-${member.id}`} style={{ margin: 0, flex: 1, cursor: "pointer" }}>{member.name}</label>
                {selectedMembers.includes(member.id) && splitType !== "equal" && (
                  <input
                    type="text"
                    placeholder={getPlaceholder(splitType)}
                    value={splitValues[member.id] || ""}
                    onChange={(e) => setSplitValues({ ...splitValues, [member.id]: e.target.value })}
                    style={{ width: "80px", margin: 0, padding: "4px 8px" }}
                  />
                )}
              </div>
            ))}
          </div>

          <button onClick={createExpense} style={{ width: "100%" }}>
            Add Expense
          </button>
        </div>

        {/* Record Settlement Form */}
        <div className="card">
          <h2>Record Settlement</h2>
          <div>
            <label htmlFor="settle-payer">From (Payer)</label>
            <select id="settle-payer" value={settlePayer} onChange={(e) => setSettlePayer(e.target.value)}>
              <option value="">Select debtor...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="settle-payee">To (Payee)</label>
            <select id="settle-payee" value={settlePayee} onChange={(e) => setSettlePayee(e.target.value)}>
              <option value="">Select creditor...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="settle-amt">Amount (INR)</label>
            <input
              id="settle-amt"
              type="number"
              placeholder="0.00"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
            />
          </div>
          <button onClick={recordPayment} style={{ width: "100%", marginTop: "10px" }} className="secondary">
            Log Settlement Payment
          </button>
        </div>
      </div>

      {/* Expenses History */}
      <div className="card" style={{ marginTop: "20px" }}>
        <h2>Expenses Ledger</h2>
        {expenses.length === 0 ? (
          <p style={{ textAlign: "center", padding: "20px 0" }}>No expenses logged for this group yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "450px", overflowY: "auto" }}>
            {expenses.map((expense) => {
              const payer = members.find((member) => member.id === expense.paid_by);
              return (
                <div
                  key={expense.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "10px"
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "1.1rem" }}>{expense.description}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                      Paid by: <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>{payer ? payer.name : "Unknown"}</span> &bull; {expense.expense_date}
                    </div>
                    {expense.notes && (
                      <div style={{ fontSize: "0.8rem", color: "var(--warning)", marginTop: "4px", fontStyle: "italic" }}>
                        Note: {expense.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: "700", fontSize: "1.1rem", color: "var(--primary)" }}>
                        ₹{expense.amount.toFixed(2)}
                      </div>
                      {expense.currency !== "INR" && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          ({expense.currency === "USD" ? "$" : ""}{expense.original_amount.toFixed(2)} @ {expense.exchange_rate.toFixed(2)})
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteExpense(expense.id)} className="danger" style={{ padding: "6px 10px" }}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ledger Modal */}
      {showLedger && ledgerUser && (
        <div className="modal-overlay" onClick={() => setShowLedger(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowLedger(false)}>
              &times;
            </button>
            <h2 style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px" }}>
              Ledger for {ledgerUser.name}
            </h2>
            <p style={{ margin: "5px 0 20px 0", fontSize: "0.95rem" }}>
              Detailed audit trail of all transactions and split shares.
            </p>

            {ledgerData.length === 0 ? (
              <p style={{ textAlign: "center", padding: "20px 0" }}>No transaction history found for this member.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Total (INR)</th>
                      <th>Your Share (INR)</th>
                      <th>Net Effect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.map((item, index) => {
                      const net = item.net_effect_inr;
                      const sign = net >= 0 ? "+" : "";
                      const cellColor = net >= 0 ? "var(--success)" : "var(--danger)";
                      return (
                        <tr key={`ledger-row-${index}`}>
                          <td>{item.date}</td>
                          <td>
                            <div>{item.description}</div>
                            {item.currency !== "INR" && (
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                {item.original_amount} {item.currency} converted @ {item.exchange_rate}
                              </span>
                            )}
                          </td>
                          <td>₹{item.total_amount_inr.toFixed(2)}</td>
                          <td>₹{item.your_share_inr.toFixed(2)}</td>
                          <td style={{ color: cellColor, fontWeight: "600" }}>
                            {sign}₹{net.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupDetails;