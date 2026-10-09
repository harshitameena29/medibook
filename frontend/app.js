const $=id=>document.getElementById(id);
const A=location.protocol.startsWith('http')?'/api':'http://localhost:5000/api';
async function api(p,m='GET',b){
 const r=await fetch(A+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.token},body:b&&JSON.stringify(b)});
 const d=await r.json();if(!r.ok)throw new Error(d.error||'Something went wrong');return d}
