// Sidebar.jsx
const Sidebar = ({ active, setActive }) => {
  const Item = ({ id, icon, label, showChev }) => (
    <div className={"sb-item" + (active === id ? " active" : "")} onClick={() => setActive(id)}>
      <i className={`ph ph-${icon}`}></i>
      <span>{label}</span>
      {showChev && <i className="r-chev ph ph-caret-right"></i>}
    </div>
  );
  return (
    <div className="sb">
      <div className="sb-hdr">
        <div className="org">
          <div className="org-av">V</div>
          <div className="org-nm">John Lawyer</div>
          <i className="chev ph ph-caret-down"></i>
        </div>
      </div>
      <div className="sb-group">
        <Item id="chat" icon="chat-circle" label="Chat" />
        <Item id="inbox" icon="tray" label="FileFlow Inbox" showChev />
        <Item id="agents" icon="robot" label="Agents" />
        <Item id="intake" icon="download-simple" label="Intake" />
        <Item id="workflows" icon="flow-arrow" label="Workflows" />
        <Item id="reporting" icon="chart-bar" label="Reporting" />
        <Item id="docintel" icon="squares-four" label="DocIntel" />
        <Item id="drafting" icon="pencil-simple-line" label="Drafting" />
        <Item id="voice" icon="microphone" label="Voice" />
        <Item id="more" icon="dots-three" label="More" />

        <div className="sb-label">Records</div>
        <Item id="cases" icon="briefcase" label="Cases" />
        <Item id="docs" icon="file-text" label="Documents" />
        <Item id="contacts" icon="user" label="Contacts" />
        <Item id="memory" icon="database" label="Memory" />
      </div>
      <div className="sb-spacer"></div>
      <div className="upgrade">
        <div className="upgrade-t">Upgrade</div>
        <div className="upgrade-d">Get access to premium features in seconds.</div>
        <button className="btn primary sm"><i className="ph ph-lightning"></i>Upgrade</button>
      </div>
    </div>
  );
};
window.Sidebar = Sidebar;
