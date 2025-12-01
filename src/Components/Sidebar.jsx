// src/Components/Sidebar.jsx
function Sidebar() {
  return (
    <aside className="dd-sidebar">
      <div className="dd-logo">Dopamine Dungeon</div>
      <nav className="dd-nav">
        <button className="dd-nav-item dd-nav-item--active">Dashboard</button>
        <button className="dd-nav-item">NPCs</button>
        <button className="dd-nav-item">Items</button>
        <button className="dd-nav-item">Locations</button>
        <button className="dd-nav-item">Sessions</button>
        <button className="dd-nav-item">Settings</button>
      </nav>
    </aside>
  );
}

export default Sidebar;