const $=id=>document.getElementById(id);
const A=location.protocol.startsWith('http')?'/api':'http://localhost:5000/api';
async function api(p,m='GET',b){
 const r=await fetch(A+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.token},body:b&&JSON.stringify(b)});
 const d=await r.json();if(!r.ok)throw new Error(d.error||'Something went wrong');return d}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const WEEK=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const clinicForm=(p={},x='c_')=>`
 <input id="${x}spec" placeholder="Specialization (e.g. Dermatologist)" value="${esc(p.specialization)}">
 <input id="${x}qual" placeholder="Qualification (e.g. MBBS, MD)" value="${esc(p.qualification)}">
 <div class="row2"><input id="${x}exp" type="number" min="0" max="70" placeholder="Experience (years)" value="${p.experience||''}"><input id="${x}fee" type="number" min="1" placeholder="Consultation fee (₹)" value="${p.fee||''}"></div>
 <input id="${x}clinic" placeholder="Clinic / hospital name" value="${esc(p.clinic_name)}">
 <input id="${x}addr" placeholder="Clinic address (street, area)" value="${esc(p.clinic_address)}">
 <div class="row2"><input id="${x}city" placeholder="City" value="${esc(p.city)}"><input id="${x}phone" type="tel" placeholder="Contact number" value="${esc(p.phone)}"></div>
 <div class="row2"><label class="lbl">Clinic opens<input id="${x}open" type="time" value="${p.open_time||'10:00'}"></label><label class="lbl">Clinic closes<input id="${x}close" type="time" value="${p.close_time||'17:00'}"></label></div>
 <label class="lbl">Appointment slot length<select id="${x}slot">${[10,15,20,30,45,60].map(m=>`<option value="${m}"${(p.slot_mins||30)==m?' selected':''}>${m} minutes</option>`).join('')}</select></label>
 <div class="lbl">Working days</div><div class="days" id="${x}days">${WEEK.map(d=>`<label><input type="checkbox" value="${d}"${(p.work_days||'Mon,Tue,Wed,Thu,Fri,Sat').split(',').includes(d)?' checked':''}>${d}</label>`).join('')}</div>
 <textarea id="${x}bio" maxlength="500" placeholder="Short bio (optional)">${esc(p.bio)}</textarea>`;
const readClinic=(x='c_')=>({specialization:$(x+'spec').value,qualification:$(x+'qual').value,experience:+$(x+'exp').value||0,fee:+$(x+'fee').value,
 clinic_name:$(x+'clinic').value,clinic_address:$(x+'addr').value,city:$(x+'city').value,phone:$(x+'phone').value,open_time:$(x+'open').value,close_time:$(x+'close').value,
 slot_mins:+$(x+'slot').value,work_days:[...document.querySelectorAll('#'+x+'days input:checked')].map(i=>i.value),bio:$(x+'bio').value});
