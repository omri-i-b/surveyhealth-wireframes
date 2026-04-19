// App.jsx
const App = () => {
  const [active, setActive] = React.useState('memory');
  const [toastMsg, setToastMsg] = React.useState('');
  const toast = (m) => {
    setToastMsg(m);
    const el = document.getElementById('toast');
    el.classList.add('on');
    clearTimeout(window.__tt);
    window.__tt = setTimeout(() => el.classList.remove('on'), 1400);
  };
  React.useEffect(() => { document.getElementById('toast').textContent = toastMsg; }, [toastMsg]);

  const label = {
    chat: 'Chat', agents: 'Agents', inbox: 'FileFlow Inbox', intake: 'Intake',
    workflows: 'Workflows', reporting: 'Reporting', docintel: 'DocIntel',
    drafting: 'Drafting', voice: 'Voice', more: 'More',
    cases: 'Cases', docs: 'Documents', contacts: 'Contacts', memory: 'Memory'
  }[active] || active;

  const crumbIcon = {
    memory: 'database', chat: 'chat-circle', agents: 'robot', cases: 'briefcase',
    docs: 'file-text', contacts: 'user', workflows: 'flow-arrow', inbox: 'tray',
    intake: 'download-simple', reporting: 'chart-bar', docintel: 'squares-four',
    drafting: 'pencil-simple-line', voice: 'microphone', more: 'dots-three'
  }[active] || 'circle';

  return (
    <>
      <Sidebar active={active} setActive={setActive} />
      <div className="main">
        <div className="topbar">
          <div className="crumbs">
            <i className={`ph ph-${crumbIcon}`}></i>
            <span>{label}</span>
          </div>
        </div>
        {active === 'memory' && <MemoryScreen toast={toast} />}
        {active !== 'memory' && (
          <div className="content">
            <div className="card">
              <div className="card-title" style={{textTransform:'capitalize'}}>{label}</div>
              <div style={{fontSize:13,color:'#71717A'}}>This screen is a placeholder. Memory is the fully built screen in this prototype.</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
