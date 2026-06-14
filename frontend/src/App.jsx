import { BrowserRouter, Routes, Route } from "react-router-dom";
import Groups from "./pages/Groups";
import GroupDetails from "./pages/GroupDetails";
import ImportIssues from "./pages/ImportIssues";
import Login from "./pages/Login";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Groups />} />
        <Route path="/groups/:id" element={<GroupDetails />} />
        <Route path="/import-issues" element={<ImportIssues />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;