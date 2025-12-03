// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/DopamineDungeonDashboard.jsx";
import Npcs from "./pages/Npcs";
import NpcProfile from "./pages/NpcProfile";
import Items from "./pages/Items";
import ItemProfile from "./pages/ItemProfile";
import Sessions from "./pages/Sessions";
import SessionProfile from "./pages/SessionProfile";
import Maps from "./pages/Maps";
import MapProfile from "./pages/MapProfile";
import Settings from "./pages/Settings";
import { auth, db, storage } from "./firebase";
import Lore from "./pages/Lore";
import LoreProfile from "./pages/LoreProfile";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />

        <Route path="/npcs" element={<Npcs />} />
        <Route path="/npcs/:id" element={<NpcProfile />} />

        <Route path="/items" element={<Items />} />
        <Route path="/items/:id" element={<ItemProfile />} />

        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/:id" element={<SessionProfile />} />

        <Route path="/maps" element={<Maps />} />
        <Route path="/maps/:id" element={<MapProfile />} />
        <Route path="/lore" element={<Lore />} />
        <Route path="/lore/:id" element={<LoreProfile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;