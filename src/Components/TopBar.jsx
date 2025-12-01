// src/Components/TopBar.jsx
function TopBar() {
  return (
    <header className="dd-topbar">
      <div className="dd-topbar-title">Dashboard</div>
      <div className="dd-topbar-right">
        <input
          className="dd-search"
          placeholder="Search NPCs, items, sessions..."
        />
        <div className="dd-user-pill">GM</div>
      </div>
    </header>
  );
}

export default TopBar;