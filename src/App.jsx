// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import DopamineDungeonDashboard from "./pages/DopamineDungeonDashboard.jsx";
import Npcs from "./pages/Npcs.jsx";
import Items from "./pages/Items.jsx";
import Sessions from "./pages/Sessions.jsx";
import Maps from "./pages/Maps.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DopamineDungeonDashboard />} />
        <Route path="/npcs" element={<Npcs />} />
        <Route path="/items" element={<Items />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/maps" element={<Maps />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}