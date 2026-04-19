// MemoryScreen.jsx
const MemoryScreen = ({ toast }) => {
  const [q, setQ] = React.useState('');

  const typePill = (t) => {
    const cls = t === 'Document' ? 'doc'
              : t === 'Template' ? 'tpl'
              : t === 'Research Data' ? 'rd'
              : 'pdf';
    return <span className={`pill ${cls}`}>{t}</span>;
  };

  const rows = [
    { name: 'alice_thomson.pdf', desc: 'document description', date: '7/29/2025', type: 'Document',      by: 'John Smith' },
    { name: 'at24.pdf',          desc: 'document description', date: '7/29/2025', type: 'Template',      by: 'John Smith' },
    { name: 'alice_t.pdf',       desc: 'document description', date: '7/29/2025', type: 'Research Data', by: 'John Smith' },
    { name: 'testfile.pdf',      desc: 'document description', date: '7/29/2025', type: 'PDF',           by: 'John Smith' },
    { name: 'Template123',       desc: 'document description', date: '7/29/2025', type: 'Template',      by: 'John Smith' },
    { name: 'alice_thomson.pdf', desc: 'document description', date: '7/29/2025', type: 'Document',      by: 'John Smith' },
    { name: 'at24.pdf',          desc: 'document description', date: '7/29/2025', type: 'Template',      by: 'John Smith' },
    { name: 'alice_t.pdf',       desc: 'document description', date: '7/29/2025', type: 'Research Data', by: 'John Smith' },
    { name: 'testfile.pdf',      desc: 'document description', date: '7/29/2025', type: 'PDF',           by: 'John Smith' },
    { name: 'Template123',       desc: 'document description', date: '7/29/2025', type: 'Template',      by: 'John Smith' },
    { name: 'alice_thomson.pdf', desc: 'document description', date: '7/29/2025', type: 'Document',      by: 'John Smith' },
    { name: 'at24.pdf',          desc: 'document description', date: '7/29/2025', type: 'Template',      by: 'John Smith' },
    { name: 'alice_t.pdf',       desc: 'document description', date: '7/29/2025', type: 'Research Data', by: 'John Smith' },
    { name: 'testfile.pdf',      desc: 'document description', date: '7/29/2025', type: 'PDF',           by: 'John Smith' },
    { name: 'Template123',       desc: 'document description', date: '7/29/2025', type: 'Template',      by: 'John Smith' },
  ];

  const filtered = q
    ? rows.filter(r => r.name.toLowerCase().includes(q.toLowerCase()) || r.type.toLowerCase().includes(q.toLowerCase()))
    : rows;

  return (
    <div className="content">
      <div className="card">
        <div className="card-title">Memory</div>

        <div className="toolbar">
          <div className="search">
            <i className="ph ph-magnifying-glass"></i>
            <input
              placeholder="Search Memory"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="filter-btn" onClick={() => toast('Date filter')}>
            <i className="ph ph-calendar-blank"></i>
            Date Created
          </button>
          <button className="filter-btn" onClick={() => toast('Type filter')}>
            <i className="type-circle"></i>
            Type
          </button>
          <div className="spacer"></div>
          <button className="btn primary" onClick={() => toast('Create Asset')}>
            <i className="ph ph-plus"></i>
            Create Asset
          </button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <colgroup>
              <col className="c-name" />
              <col className="c-desc" />
              <col className="c-date" />
              <col className="c-type" />
              <col className="c-by" />
              <col className="c-act" />
            </colgroup>
            <thead>
              <tr>
                <th><span className="th-inner"><i className="c-hash">#</i>Asset Name</span></th>
                <th><span className="th-inner"><i className="ph ph-text-align-left"></i>Description</span></th>
                <th><span className="th-inner"><i className="ph ph-calendar-blank"></i>Date Added</span></th>
                <th><span className="th-inner"><i className="c-circle"></i>Type</span></th>
                <th><span className="th-inner"><i className="ph ph-user"></i>Added by</span></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td className="c-name">{r.name}</td>
                  <td>{r.desc}</td>
                  <td>{r.date}</td>
                  <td>{typePill(r.type)}</td>
                  <td>{r.by}</td>
                  <td className="c-action" onClick={() => toast('Row menu')}>
                    <i className="ph ph-dots-three-vertical"></i>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
window.MemoryScreen = MemoryScreen;
