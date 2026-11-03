import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Mic, RefreshCw, Trash2, AlertTriangle, Wifi, WifiOff, MessageCircle} from 'lucide-react';
import './style.css';

const API = 'http://localhost:8000';
function App(){
  const [bins,setBins]=useState([]), [alerts,setAlerts]=useState([]), [question,setQuestion]=useState('');
  const [answer,setAnswer]=useState('Ask me about bin fill levels, collection status, or sensor health.');
  const [busy,setBusy]=useState(false), [err,setErr]=useState('');
  async function refresh(){
    try{
      const [s,a]=await Promise.all([fetch(API+'/api/status'),fetch(API+'/api/alerts')]);
      if(!s.ok||!a.ok) throw new Error('Backend request failed');
      setBins((await s.json()).bins||[]); setAlerts((await a.json()).alerts||[]); setErr('');
    }catch(e){setErr('Cannot reach backend. Start FastAPI on port 8000.');}
  }
  useEffect(()=>{refresh(); const t=setInterval(refresh,5000); return ()=>clearInterval(t)},[]);
  const high=bins.filter(b=>b.fill>=80).length, offline=bins.filter(b=>!b.online||!b.sensor_ok).length;
  async function ask(e){e?.preventDefault(); if(!question.trim())return; setBusy(true);
    try{const r=await fetch(API+'/api/voice/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:question})}); const d=await r.json(); if(!r.ok)throw new Error(d.detail||'Request failed'); setAnswer(d.answer);}
    catch(e){setAnswer(e.message)} finally{setBusy(false)}
  }
  async function markCollected(id){
    if(!confirm(`Confirm ${id} has been emptied?`))return;
    const r=await fetch(API+'/api/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bin_id:id,confirmed:true})});
    const d=await r.json(); if(!r.ok)alert(d.detail||'Reset failed'); refresh();
  }
  async function voice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert('Speech recognition is not supported in this browser. Type your question instead.');return;}
    const rec=new SR(); rec.lang='en-IN'; rec.onresult=e=>{const q=e.results[0][0].transcript;setQuestion(q);setTimeout(()=>document.getElementById('askform')?.requestSubmit(),100)}; rec.start();
  }
  return <main className="shell">
    <header><div><p className="eyebrow">OPERATIONS CONSOLE</p><h1>Smart Dustbin <span>Voice Agent</span></h1><p className="sub">Live fleet monitoring · proactive collection alerts · voice assistant</p></div><button className="refresh" onClick={refresh}><RefreshCw size={16}/> Refresh</button></header>
    {err&&<div className="error">{err}</div>}
    <section className="metrics">
      <div className="metric"><small>Total bins</small><strong>{bins.length}</strong><span>Registered devices</span></div>
      <div className="metric"><small>Needs collection</small><strong>{high}</strong><span>At least 80% full</span></div>
      <div className="metric"><small>Offline / unhealthy</small><strong>{offline}</strong><span>Requires attention</span></div>
      <div className="metric"><small>Open alerts</small><strong>{alerts.filter(a=>a.state==='open').length}</strong><span>Active alert records</span></div>
    </section>
    <section className="grid">
      <div className="panel wide"><div className="panel-head"><div><h2>Dustbin fleet</h2><p>Current readings from the latest API poll</p></div><span className="live">● LIVE</span></div>
        <div className="table-wrap"><table><thead><tr><th>Device</th><th>Location</th><th>Fill level</th><th>Device status</th><th>Action</th></tr></thead><tbody>
        {bins.map(b=><tr key={b.bin_id}><td className="id">{b.bin_id}</td><td>{b.location}</td><td><div className="fillrow"><div className="bar"><i style={{width:`${b.fill}%`}}/></div><b>{Math.round(b.fill)}%</b></div></td><td>{(!b.online||!b.sensor_ok)?<span className="badge bad"><WifiOff size={13}/> Offline</span>:b.fill>=80?<span className="badge warn"><AlertTriangle size={13}/> Collection</span>:<span className="badge good"><Wifi size={13}/> Online</span>}</td><td><button className="small" onClick={()=>markCollected(b.bin_id)}><Trash2 size={13}/> Collected</button></td></tr>)}
        </tbody></table></div>
      </div>
      <div className="panel"><div className="panel-head"><div><h2>Voice assistant</h2><p>Ask a question about your fleet</p></div><MessageCircle/></div>
        <div className="answer">{answer}</div><form id="askform" onSubmit={ask}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Which bins are above 80%?"/><button type="button" className="mic" onClick={voice}><Mic size={17}/></button><button disabled={busy}>{busy?'...':'Ask'}</button></form>
        <div className="suggestions" onClick={e=>{if(e.target.dataset.q){setQuestion(e.target.dataset.q)}}}><button data-q="Which bins are more than 80% full?">Bins over 80%</button><button data-q="Are any sensors offline?">Offline sensors</button><button data-q="Give me a fleet status update">Fleet summary</button></div>
      </div>
      <div className="panel wide"><div className="panel-head"><div><h2>Recent alerts</h2><p>Threshold and device events</p></div></div>
        {alerts.length===0?<p className="empty">No alerts recorded yet. Alerts are created after two consecutive readings at or above 80%.</p>:
        <div className="alerts">{alerts.slice(0,8).map(a=><div className="alert" key={a.id}><span className={`dot ${a.severity}`}/><div><b>{a.bin_id} · {a.location}</b><p>{a.message}</p><small>{a.severity.toUpperCase()} · {new Date(a.created_at).toLocaleString()}</small></div><span className="state">{a.state}</span></div>)}</div>}
      </div>
    </section>
    <footer>Demo dataset supplied for development · Configure the upstream REST API and notification credentials before production use.</footer>
  </main>
}
createRoot(document.getElementById('root')).render(<App/>);
