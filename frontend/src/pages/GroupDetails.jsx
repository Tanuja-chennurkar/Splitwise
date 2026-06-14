import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import "../App.css";

function GroupDetails() {
  const { id } = useParams();

  const [members, setMembers] = useState([]);
  const [balances, setBalances] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [newMemberId, setNewMemberId] = useState("");

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [splitType, setSplitType] = useState("equal");
  const [splitValues, setSplitValues] = useState({});

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
      const membersRes = await api.get(
        `/memberships/groups/${id}`
      );

      const usersRes = await api.get("/users");

      const balancesRes = await api.get(
        `/groups/${id}/balances`
      );

      const expensesRes = await api.get(
        "/expenses"
      );

      const groupExpenses = expensesRes.data.filter(
        (expense) => expense.group_id === Number(id)
      );

      setMembers(membersRes.data);
      setAllUsers(usersRes.data);
      setBalances(balancesRes.data);
      setExpenses(groupExpenses);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleMember = (memberId) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(
        selectedMembers.filter((id) => id !== memberId)
      );
    } else {
      setSelectedMembers([
        ...selectedMembers,
        memberId
      ]);
    }
  };

  const createExpense = async () => {
    try {
      if (selectedMembers.length === 0) {
        alert("Select at least one member");
        return;
      }

      await api.post("/expenses", {
        group_id: Number(id),
        paid_by: Number(paidBy),
        description,
        amount: Number(amount),
        expense_date: new Date()
          .toISOString()
          .split("T")[0],
        split_with: selectedMembers,
        split_type: splitType,
        split_details: (splitType === "equal") ? null : selectedMembers.map(m => `${m}:${splitValues[m] || 0}`).join(";")
      });
      // server will create splits

      setDescription("");
      setAmount("");
      setPaidBy("");
      setSelectedMembers([]);

      fetchData();
    } catch (error) {
      console.error(error);
    }
  };
  const deleteExpense = async (expenseId) => {
  try {
    await api.delete(`/expenses/${expenseId}`);

    fetchData();
  } catch (error) {
    console.error(error);
  }
};
  return (
    <div className="container">
      <h1>Group Details</h1>

      <div className="card">
        <h2>Members</h2>

        {members.map((member) => (
          <div key={member.membership_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>{member.name} ({member.email})</div>
            <div>
              <button onClick={async () => {
                try {
                  await api.delete(`/memberships/${member.membership_id}`);
                  fetchData();
                } catch (err) {
                  console.error(err);
                  alert('Failed to remove member');
                }
              }}>Remove</button>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 8 }}>
          <select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)}>
            <option value="">Add existing user</option>
            {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
          </select>
          <button style={{ marginLeft: 8 }} onClick={async () => {
            if (!newMemberId) return alert('Select a user to add');
            try {
              await api.post(`/memberships/groups/${id}`, { user_id: Number(newMemberId), joined_at: new Date().toISOString().split('T')[0] });
              setNewMemberId('');
              fetchData();
            } catch (err) {
              console.error(err);
              alert('Failed to add member');
            }
          }}>Add</button>
        </div>
      </div>

      <div className="card">
  <h2>Expenses</h2>

  {expenses.map((expense) => {
  const payer = members.find(
    (member) => member.id === expense.paid_by
  );

  return (
    <div
      key={expense.id}
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "10px",
      }}
    >
      <div>
        <strong>{expense.description}</strong>
        <br />
        ₹{expense.amount}
        <br />
        Paid by: {payer ? payer.name : expense.paid_by}
      </div>

      <button
        onClick={() => deleteExpense(expense.id)}
      >
        Delete
      </button>
    </div>
  );
})}
</div>

      <div className="card">
        <h2>Balances</h2>

        {Object.entries(balances).map(
          ([userId, user]) => (
            <p key={userId}>
              <p
  key={userId}
  style={{
    color:
      user.balance >= 0
        ? "green"
        : "red",
    fontWeight: "bold",
  }}
>
  {user.name}: ₹{user.balance.toFixed(2)}
</p>
            </p>
          )
        )}
      </div>

      <div className="card">
        <h2>Record Payment / Settle</h2>
        <div>
          <label htmlFor="payment-from">From: </label>
          <select id="payment-from" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            <option value="">Select payer</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="payment-to">To: </label>
          <select id="payment-to" value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)}>
            <option value="">Select payee</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="payment-amount">Amount: </label>
          <input id="payment-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button style={{ marginTop: 8 }} onClick={async () => {
          if (!paidBy || !newMemberId || !amount) return alert('fill fields');
          try {
            await api.post('/payments', { group_id: Number(id), payer_id: Number(paidBy), payee_id: Number(newMemberId), amount: Number(amount) });
            setAmount(''); setPaidBy(''); setNewMemberId(''); fetchData();
          } catch (err) { console.error(err); alert('Failed to record payment'); }
        }}>Record Payment</button>
      </div>

      <div className="card">
        <h2>Add Expense</h2>

        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
        />

        <br /><br />

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) =>
            setAmount(e.target.value)
          }
        />

        <br /><br />

        <select
          value={paidBy}
          onChange={(e) =>
            setPaidBy(e.target.value)
          }
        >
          <option value="">
            Select Member
          </option>

          {members.map((member) => (
            <option
              key={member.id}
              value={member.id}
            >
              {member.name}
            </option>
          ))}
        </select>

        <br /><br />

        <h3>Split Between</h3>

        <div>
          <label htmlFor="split-type-select">Split Type: </label>
          <select id="split-type-select" value={splitType} onChange={(e) => setSplitType(e.target.value)}>
            <option value="equal">Equal</option>
            <option value="unequal">Unequal (amounts)</option>
            <option value="percentage">Percentage</option>
            <option value="share">Share (weights)</option>
          </select>
        </div>

        {members.map((member) => (
          <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={selectedMembers.includes(
                member.id
              )}
              onChange={() =>
                toggleMember(member.id)
              }
            />

            <label style={{ minWidth: 120 }}>{member.name}</label>
            {selectedMembers.includes(member.id) && splitType !== "equal" && (
              <input
                type="text"
                placeholder={getPlaceholder(splitType)}
                value={splitValues[member.id] || ""}
                onChange={(e) => setSplitValues((p) => ({ ...p, [member.id]: e.target.value }))}
                style={{ width: 120 }}
              />
            )}
          </div>
        ))}

        <br />

        <button onClick={createExpense}>
          Create Expense
        </button>
      </div>
    </div>
  );
}

export default GroupDetails;