// FileFlowApp.jsx
const FileFlowApp = () => {
  const [active, setActive] = React.useState('fileflow');
  const [toastMsg, setToastMsg] = React.useState('');
  const toast = (m) => {
    setToastMsg(m);
    const el = document.getElementById('toast');
    el.classList.add('on');
    clearTimeout(window.__tt);
    window.__tt = setTimeout(() => el.classList.remove('on'), 1400);
  };
  React.useEffect(() => { document.getElementById('toast').textContent = toastMsg; }, [toastMsg]);

  const title = { fileflow: 'FileFlow Inbox', cases: 'Cases', settings: 'Settings' }[active] || active;

  return (
    <>
      <ProdSidebar active={active} setActive={setActive} />
      <div className="main">
        <div className="topbar">
          <nav aria-label="breadcrumb">
            <ol style={{display:'flex',alignItems:'center',gap:6,listStyle:'none',margin:0,padding:0}}>
              <li><span className="topbar-title" aria-current="page">{title}</span></li>
            </ol>
          </nav>
        </div>
        {active === 'fileflow' && <FileFlowScreen toast={toast} />}
        {active !== 'fileflow' && (
          <div className="page">
            <div className="page-card">
              <div className="page-header"><h1 className="page-title">{title}</h1></div>
              <div style={{fontSize:13,color:'var(--fg-muted)'}}>Placeholder screen. FileFlow Inbox is the fully-built surface.</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<FileFlowApp />);
