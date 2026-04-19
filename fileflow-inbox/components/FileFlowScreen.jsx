// FileFlowScreen.jsx — 1:1 with production capture
const FileFlowScreen = ({ toast }) => {
  const [q, setQ] = React.useState('');

  const rows = [
    { date:'4/18/2026', proj:'N/A', file:'KEVIN_ADAMS_Bill.pdf', caseN:'N/A', type:'Medical Bills', status:'Filing Error', lawyer:'Unassigned', email:'ADRecords@adhealthcare.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/18/2026', proj:'N/A', file:'JOHN_LADAY_Bill.pdf', caseN:'N/A', type:'Medical Bills', status:'Filing Error', lawyer:'Unassigned', email:'ADRecords@adhealthcare.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/18/2026', proj:'N/A', file:'LEROY_KIMBROUGH_Bill.pdf', caseN:'N/A', type:'Medical Bills', status:'Filing Error', lawyer:'Unassigned', email:'ADRecords@adhealthcare.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/18/2026', proj:'N/A', file:'SANDRA_LEDAY_Bill.pdf', caseN:'N/A', type:'Medical Bills', status:'Filing Error', lawyer:'Unassigned', email:'ADRecords@adhealthcare.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/18/2026', proj:'N/A', file:'CLARA_OBIOMA_Bill.pdf', caseN:'N/A', type:'Medical Bills', status:'Filing Error', lawyer:'Unassigned', email:'ADRecords@adhealthcare.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/18/2026', proj:'N/A', file:'DEQUINCYFRANKTranscription_10270829041720261011.pdf', caseN:'N/A', type:'Medical Records', status:'Filing Error', lawyer:'M MPS Skrabanek', email:'donotreply@texasregionalclinic.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/18/2026', proj:'N/A', file:'DEQUINCYFRANK_Bill_10270829041720262103.pdf', caseN:'N/A', type:'Medical Bills', status:'Filing Error', lawyer:'M MPS Skrabanek', email:'donotreply@texasregionalclinic.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/18/2026', proj:'N/A', file:'QUINTONMICKENSTranscription_10271947041720261114.pdf', caseN:'N/A', type:'Medical Records', status:'Filing Error', lawyer:'M MPS Skrabanek', email:'donotreply@texasregionalclinic.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/18/2026', proj:'N/A', file:'QUINTONMICKENS_Bill_10271947041720262106.pdf', caseN:'N/A', type:'Medical Bills', status:'Filing Error', lawyer:'M MPS Skrabanek', email:'donotreply@texasregionalclinic.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'Pltfs Document Production 285-291.pdf', caseN:'202605826', type:'Medical Records', status:'Filing Error', lawyer:'Angela AL Lee', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'Plts Obj and Resp to Defs ROGGs and RFPs.pdf', caseN:'202605826', type:'Answers to Interrogatories to Plaintiff', status:'Filing Error', lawyer:'Angela AL Lee', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'OBJECTION Plt Rule 193.7 Notice.pdf', caseN:'2024CI25574', type:'N/A', status:'Extraction Duplicated', lawyer:'N/A', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'' },
    { date:'4/17/2026', proj:'N/A', file:'OBJECTION Plt Rule 193.7 Notice.pdf', caseN:'2024CI25574', type:'Motion', status:'Filing Error', lawyer:'David Henry', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'2026.4.17 Notice of Filing of TDUs 91a Motions.pdf', caseN:'202141903', type:'Notice of Filing', status:'Matching Error', lawyer:'N/A', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'26-04-17 Plaintiffs First Amended Petition (TX.pdf', caseN:'DCV-25-02309', type:'Amended Petition', status:'Filing Error', lawyer:'Angela AL Lee', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:"Plaintiffs' Notice of Association (PSR).kj.pdf", caseN:'N/A', type:'Notice of Appearance', status:'Filing Error', lawyer:'Unassigned', email:'kjehnings@bjlawgroup.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'2026-04-17 DART Resp to RFA.pdf', caseN:'DC-25-11865', type:'Responses to Request for Admissions to Plaintiff', status:'Filing Error', lawyer:'Kathryn Hiett', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:"2026-04-17 DART's Resp to RFP.pdf", caseN:'DC-25-11865', type:'Responses to Request for Production to Defendant', status:'Filing Error', lawyer:'Kathryn Hiett', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'Defendant Motion for Leave to Designate RTP.pdf', caseN:'2403-17141', type:'N/A', status:'Extraction Duplicated', lawyer:'N/A', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'' },
    { date:'4/17/2026', proj:'N/A', file:'Defendant Motion for Leave to Designate RTP.pdf', caseN:'2403-17141', type:'Motion', status:'Filing Error', lawyer:'M MPS Skrabanek', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'Proposed Order Granting Motion for Leave RTP.pdf', caseN:'2403-17141', type:'Proposed Order', status:'Filing Error', lawyer:'M MPS Skrabanek', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:"Prop. Order Granting Pl.s Ver. Mot. Reinstate .pdf", caseN:'202504436', type:'Proposed Order', status:'Filing Error', lawyer:'Danny Dinneen', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'Ex. B - Mot. Reinstante - Calendar.pdf', caseN:'202504436', type:'New Document Type', status:'Classifier Pending', lawyer:'N/A', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:"Ex. A - Mot. Reinstate - Dinneen's Aff.pdf", caseN:'202504436', type:'Affidavit', status:'Filing Error', lawyer:'Danny Dinneen', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'20260417 Pl.s Ver. Mot. Reinstate [2025-04436].pdf', caseN:'202504436', type:'Motion', status:'Filing Error', lawyer:'Danny Dinneen', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'Easley - SS LOA 4.17.26.pdf', caseN:'STCV22-01733', type:'Notice', status:'Filing Error', lawyer:'Kyle Chapel', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'2026-04-17 Notice of Intent to Take Deposition of Elien Abreu Quesada.pdf', caseN:'CC-24-06973-B', type:'Notice of Taking Deposition', status:'Filing Error', lawyer:'Paul Skrabanek', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'26-04-17 Hiepler -resp to RTP.pdf', caseN:'2025CI15156', type:'Motion', status:'Filing Error', lawyer:'Kyle KC Chapel', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'Derry Green -- Notice of Joinder.pdf', caseN:'N/A', type:'Notice of Joinder', status:'Filing Error', lawyer:'Kyle KC Chapel', email:'andrew@andrewlopezlaw.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'PLAINTIFFS FIRST AMENDED ORIGINAL PETITION.pdf', caseN:'25CVDC-00335', type:'Amended Petition', status:'Filing Error', lawyer:'Kayla Guevara', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'2026.04.17 Vacation Ltr (J. Parker).pdf', caseN:'DC-24-02841', type:'Letter of Unavailability', status:'Filing Error', lawyer:'Michael MEP Pierce', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'17APR26 Ltr to PC - Settlement Check ($30k).pdf', caseN:'N/A', type:'Settlement Check Letter', status:'Filing Error', lawyer:'Kade kb Beyer', email:'cmccracken@bushramirez.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'Settlement Check No. 11087.pdf', caseN:'N/A', type:'Check', status:'Filing Error', lawyer:'Kade kb Beyer', email:'cmccracken@bushramirez.com', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'130957 Notice.pdf', caseN:'202572117', type:'Notice of Intention to Take Deposition by Written Questions', status:'Filing Error', lawyer:'Angela AL Lee', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'Citation Service Copy.pdf', caseN:'N/A', type:'Citation', status:'Filing Error', lawyer:'Stone Schloss', email:'RobertC@brazoriacountytx.gov', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'Citation Original.pdf', caseN:'N/A', type:'Citation', status:'Filing Error', lawyer:'Stone Schloss', email:'RobertC@brazoriacountytx.gov', due:'No Date', reviewed:'N/A', action:'Manual review' },
    { date:'4/17/2026', proj:'N/A', file:'image001.png', caseN:'N/A', type:'Non-document (Logo/Advertisement)', status:'Classifier Stopped', lawyer:'N/A', email:'RobertC@brazoriacountytx.gov', due:'No Date', reviewed:'N/A', action:'' },
    { date:'4/17/2026', proj:'N/A', file:"26-04-17 Ramirez -- Res to Buldakov's Rogs.pdf", caseN:'DC-25-15874', type:'Answers to Interrogatories to Plaintiff', status:'Filing Error', lawyer:'Kyle KC Chapel', email:'no-reply@efilingmail.tylertech.cloud', due:'No Date', reviewed:'N/A', action:'Manual review' },
  ];

  const filtered = q
    ? rows.filter(r => r.file.toLowerCase().includes(q.toLowerCase()) || r.type.toLowerCase().includes(q.toLowerCase()) || r.lawyer.toLowerCase().includes(q.toLowerCase()))
    : rows;

  // Document type badge — always blue (data-variant="info")
  const typeBadge = (t) => {
    if (!t || t === 'N/A') return <span className="cell-trunc">N/A</span>;
    return <span className="vt-badge blue">{t}</span>;
  };
  // Status badge — colors per state
  const statusBadge = (s) => {
    if (!s || s === 'N/A') return <span className="cell-trunc">N/A</span>;
    const m = s.toLowerCase();
    if (m.includes('filing error') || m.includes('duplicat') || m.includes('stopped')) return <span className="vt-badge red">{s}</span>;
    if (m.includes('matching')) return <span className="vt-badge amber">{s}</span>;
    if (m.includes('classifier')) return <span className="vt-badge violet">{s}</span>;
    return <span className="vt-badge gray">{s}</span>;
  };

  // Header cell: icon + label + sort caret + resize handle
  const Th = ({ icon, label, width, sortable=true, sticky=false }) => (
    <th style={{width: width+'px'}} className={sticky ? 'th-sticky' : ''}>
      <div className="th-inner">
        {icon && <i className={`ph ph-${icon} th-ico`}></i>}
        <span className="th-label">{label}</span>
        {sortable && <i className="ph ph-arrow-down sort-i"></i>}
      </div>
      {!sticky && <span className="col-resize"></span>}
    </th>
  );

  const FilterBtn = ({ icon, children }) => (
    <button className="vt-filter-btn" onClick={() => toast(children + ' filter')}>
      <i className={`ph ph-${icon}`}></i>
      {children}
      <i className="ph ph-caret-down" style={{fontSize:12,opacity:.6,marginLeft:2}}></i>
    </button>
  );

  return (
    <div className="page">
      <div className="page-card">
        <div className="page-header">
          <h1 className="page-title">FileFlow Inbox</h1>
        </div>

        <div className="toolbar">
          <div className="toolbar-filters">
            <div className="vt-search">
              <i className="ph ph-magnifying-glass"></i>
              <input placeholder="Search Files" value={q} onChange={(e)=>setQ(e.target.value)} />
            </div>
            <FilterBtn icon="calendar-blank">Date Range</FilterBtn>
            <FilterBtn icon="file">Document</FilterBtn>
            <FilterBtn icon="user-circle">Lead Lawyer</FilterBtn>
            <FilterBtn icon="flag">Classification</FilterBtn>
            <FilterBtn icon="user-circle">Reviewed</FilterBtn>
            <FilterBtn icon="flag">Manual Review</FilterBtn>
          </div>
          <button className="vt-filter-btn icon-only" onClick={()=>toast('Columns')} title="Columns">
            <i className="ph ph-squares-four"></i>
          </button>
        </div>

        <div className="tbl-wrap">
          <div className="tbl-scroll">
            <table className="tbl">
              <colgroup>
                <col style={{width:130}} />
                <col style={{width:220}} />
                <col style={{width:200}} />
                <col style={{width:140}} />
                <col style={{width:200}} />
                <col style={{width:160}} />
                <col style={{width:140}} />
                <col style={{width:180}} />
                <col style={{width:100}} />
                <col style={{width:140}} />
                <col style={{width:160}} />
                <col style={{width:84}} />
              </colgroup>
              <thead>
                <tr>
                  <Th icon="calendar-blank" label="Filing Date" width={130} />
                  <Th icon="text-t"          label="Project Name" width={220} sortable={false} />
                  <Th icon="text-t"          label="File name" width={200} />
                  <Th icon="text-t"          label="Case number" width={140} sortable={false} />
                  <Th icon="file-text"       label="Document type" width={200} sortable={false} />
                  <Th icon="flag"            label="Status" width={160} sortable={false} />
                  <Th icon="gavel"           label="Lead Lawyer" width={140} sortable={false} />
                  <Th icon="envelope-simple" label="Email" width={180} sortable={false} />
                  <Th icon="calendar-blank" label="Due" width={100} />
                  <Th icon="text-t"          label="Reviewed by" width={140} sortable={false} />
                  <th style={{width:160}}><div className="th-inner"></div><span className="col-resize"></span></th>
                  <th className="th-sticky" style={{width:84}}><div className="th-inner"></div></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td><span className="date-badge">{r.date}</span></td>
                    <td><span className="cell-trunc">{r.proj}</span></td>
                    <td><span className="cell-trunc" title={r.file}>{r.file}</span></td>
                    <td><span className="cell-trunc">{r.caseN}</span></td>
                    <td>{typeBadge(r.type)}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td><span className="cell-trunc">{r.lawyer}</span></td>
                    <td><span className="cell-trunc" title={r.email}>{r.email}</span></td>
                    <td><span className="date-badge">{r.due}</span></td>
                    <td><span className="cell-trunc">{r.reviewed}</span></td>
                    <td>
                      {r.action === 'Manual review' && <span className="vt-badge red">Manual review</span>}
                    </td>
                    <td className="td-sticky">
                      <div className="row-actions">
                        <button className="rowbtn" title={`Download ${r.file}`} onClick={(e)=>{e.stopPropagation();toast('Download');}}>
                          <i className="ph ph-download-simple"></i>
                        </button>
                        <button className="rowbtn" title="View" onClick={(e)=>{e.stopPropagation();toast('View');}}>
                          <i className="ph ph-eye"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="pg-info">
              <span>Page 1 of 46</span>
              <span>(2748 items)</span>
            </div>
            <div className="pg-right">
              <div className="pg-select" onClick={()=>toast('Page size')}>
                <span>60</span>
                <i className="ph ph-caret-down"></i>
              </div>
              <button className="pg-btn" disabled>Previous</button>
              <button className="pg-btn" onClick={()=>toast('Next page')}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
window.FileFlowScreen = FileFlowScreen;
