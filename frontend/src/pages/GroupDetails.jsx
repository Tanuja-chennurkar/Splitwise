import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import "../App.css";

function GroupDetails() {
  const { id } = useParams();

  const [members, setMembers] = useState([]);
  const [balances, setBalances] = useState({});
  const [expenses, setExpenses] = useState([]);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const membersRes = await api.get(
        `/memberships/groups/${id}`
      );

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

      const expenseRes = await api.post("/expenses", {
        group_id: Number(id),
        paid_by: Number(paidBy),
        description,
        amount: Number(amount),
        expense_date: new Date()
          .toISOString()
          .split("T")[0]
      });

      const expenseId = expenseRes.data.id;

      const splitAmount =
        Number(amount) / selectedMembers.length;

      for (const memberId of selectedMembers) {
        await api.post(
          `/expense-splits/expenses/${expenseId}`,
          {
            user_id: memberId,
            amount: splitAmount
          }
        );
      }

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
          <p key={member.id}>
            {member.name} ({member.email})
          </p>
        ))}
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

        {members.map((member) => (
          <div key={member.id}>
            <input
              type="checkbox"
              checked={selectedMembers.includes(
                member.id
              )}
              onChange={() =>
                toggleMember(member.id)
              }
            />

            <label>{member.name}</label>
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