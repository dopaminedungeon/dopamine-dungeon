// src/Components/Card.jsx
function Card({ title, subtitle, value, children }) {
  return (
    <div className="dd-card">
      <div className="dd-card-header">
        <div>
          <div className="dd-card-title">{title}</div>
          {subtitle && <div className="dd-card-subtitle">{subtitle}</div>}
        </div>
        {value !== undefined && (
          <div className="dd-card-value">{value}</div>
        )}
      </div>
      {children && <div className="dd-card-body">{children}</div>}
    </div>
  );
}

export default Card;