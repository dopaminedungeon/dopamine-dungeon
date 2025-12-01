// src/Pages/DopamineDungeonDashboard.jsx
import Sidebar from "../Components/Sidebar.jsx";
import TopBar from "../Components/TopBar.jsx";
import Card from "../Components/Card.jsx";

function DopamineDungeonDashboard() {
  return (
    <div className="dd-app">
      <Sidebar />

      <main className="dd-main">
        <TopBar />

        <section className="dd-cards-grid">
          <Card title="NPCs" subtitle="Total in campaign" value={42}>
            <ul className="dd-card-list">
              <li>Kiyomi (Scribe of Veins)</li>
              <li>Anleil (Artificer of Chaos)</li>
              <li>Roman (Disaster Barbarian)</li>
            </ul>
          </Card>

          <Card title="Items" subtitle="Legendary artifacts" value={13}>
            <ul className="dd-card-list">
              <li>Veinborn Hammer</li>
              <li>Zaćmienie</li>
              <li>Whispering Stone Shard</li>
            </ul>
          </Card>

          <Card
            title="Next session"
            subtitle="Scheduled"
            value="Friday 19:00"
          >
            <p>Black site aftermath, Małgorzata Winogrono enters the chat.</p>
          </Card>

          <Card title="Quick actions" subtitle="Because dopamine">
            <div className="dd-actions">
              <button className="dd-button">+ New NPC</button>
              <button className="dd-button">+ New Item</button>
              <button className="dd-button">+ New Session</button>
            </div>
          </Card>
        </section>

        <section className="dd-activity">
          <h2 className="dd-section-title">Recent activity</h2>
          <ul className="dd-activity-list">
            <li>Kriaxin detonated a black site. Again.</li>
            <li>Roman squeezed intel out of an inventor. Literally.</li>
            <li>Radosław &amp; Małgorzata: “there was only one bed”.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default DopamineDungeonDashboard;