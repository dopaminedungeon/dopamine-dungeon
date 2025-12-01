// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DopamineDungeonDashboard from "./pages/DopamineDungeonDashboard";
import Npcs from "./pages/Npcs";
import NpcProfile from "./pages/NpcProfile";
import Items from "./pages/Items";
import ItemProfile from "./pages/ItemProfile";
import Sessions from "./pages/Sessions";
import SessionProfile from "./pages/SessionProfile";
import Maps from "./pages/Maps";
import MapProfile from "./pages/MapProfile";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DopamineDungeonDashboard />} />

        <Route path="/npcs" element={<Npcs />} />
        <Route path="/npc/:id" element={<NpcProfile />} />

        <Route path="/items" element={<Items />} />
        <Route path="/item/:id" element={<ItemProfile />} />

        <Route path="/sessions" element={<Sessions />} />
        <Route path="/session/:id" element={<SessionProfile />} />

        <Route path="/maps" element={<Maps />} />
        <Route path="/map/:id" element={<MapProfile />} />

        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}