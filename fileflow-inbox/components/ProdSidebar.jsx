// ProdSidebar.jsx — matches production capture (portal-dev-new.veritec.ai)
// Sidebar: org header (Omri Buzi), FileFlow Inbox (active) + Cases, Settings footer
const ProdSidebar = ({ active, setActive }) => {
  const Item = ({ id, icon, label, href }) => (
    <a
      className={"sb-item" + (active === id ? " active" : "")}
      onClick={(e) => { e.preventDefault(); setActive(id); }}
      href={href || '#'}
    >
      <i className={`ph ph-${icon}`}></i>
      <span>{label}</span>
    </a>
  );
  return (
    <div className="sb">
      <div className="sb-header">
        <div className="sb-org">
          <div className="sb-org-tile">V</div>
          <div className="sb-org-name">Omri Buzi</div>
          <i className="sb-org-chev ph ph-caret-down"></i>
        </div>
      </div>
      <div className="sb-content">
        <Item id="fileflow" icon="tray" label="FileFlow Inbox" href="/fileflow" />
        <Item id="cases"    icon="briefcase" label="Cases" href="/cases" />
      </div>
      <div className="sb-footer">
        <Item id="settings" icon="gear-six" label="Settings" href="/settings/fileflow" />
      </div>
    </div>
  );
};
window.ProdSidebar = ProdSidebar;
