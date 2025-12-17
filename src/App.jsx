// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";

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
import Lore from "./pages/Lore";
import LoreProfile from "./pages/LoreProfile";
import Arcs from "./pages/Arcs";
import ArcProfile from "./pages/ArcProfile";
import Quests from "./pages/Quests.jsx";
import QuestProfile from "./pages/QuestProfile.jsx";
import Relationships from "./pages/Relationships";
import RelationshipProfile from "./pages/RelationshipProfile";
import Conditions from "./pages/Conditions";
import ConditionProfile from "./pages/ConditionProfile";
import PCs from "./pages/PCs";
import PCProfile from "./pages/PCProfile";
import BagOfHolding from "./pages/BagOfHolding";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />

          <Route path="/items" element={<Items />} />
          <Route path="/items/:id" element={<ItemProfile />} />

          <Route path="/npcs" element={<Npcs />} />
          <Route path="/npcs/:id" element={<NpcProfile />} />

          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:id" element={<SessionProfile />} />

          <Route path="/maps" element={<Maps />} />
          <Route path="/maps/:id" element={<MapProfile />} />

          <Route path="/lore" element={<Lore />} />
          <Route path="/lore/:id" element={<LoreProfile />} />

          <Route path="/arcs" element={<Arcs />} />
          <Route path="/arcs/:id" element={<ArcProfile />} />

          <Route path="/quests" element={<Quests />} />
          <Route path="/quests/:id" element={<QuestProfile />} />

          <Route path="/relationships" element={<Relationships />} />
          <Route path="/relationships/:id" element={<RelationshipProfile />} />

          <Route path="/conditions" element={<Conditions />} />
          <Route path="/conditions/:id" element={<ConditionProfile />} />

          <Route path="/pcs" element={<PCs />} />
          <Route path="/pcs/:pcId" element={<PCProfile />} />
          <Route path="/pcs/bag" element={<BagOfHolding />} />

          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;