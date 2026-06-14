import { BrowserRouter, Routes, Route } from "react-router-dom";
import Groups from "./pages/Groups";
import GroupDetails from "./pages/GroupDetails";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Groups />} />
        <Route path="/groups/:id" element={<GroupDetails />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;