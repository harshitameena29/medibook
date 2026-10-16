require('dotenv').config();
const express=require('express'),mysql=require('mysql2/promise'),bcrypt=require('bcryptjs'),
jwt=require('jsonwebtoken'),crypto=require('crypto'),path=require('path');
const app=express();app.use(express.json());
app.use(express.static(path.join(__dirname,'../frontend'),{setHeaders:r=>r.setHeader('Cache-Control','no-cache')}));
const db=mysql.createPool({host:process.env.DB_HOST||'localhost',port:+process.env.DB_PORT||3306,user:process.env.DB_USER||'root',
 password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'medibook',dateStrings:true,
 ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:false}:undefined}); // DB_SSL=true for hosted MySQL (Aiven, TiDB, etc.)
const S=process.env.JWT_SECRET||'dev_secret';
const rzp=process.env.RAZORPAY_KEY_ID?new(require('razorpay'))({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET}):null;
const wrap=f=>(q,s,n)=>f(q,s,n).catch(e=>{console.error(e);
 s.status(e.code==='ER_DUP_ENTRY'?409:500).json({error:e.code==='ER_DUP_ENTRY'?'Email already registered':'Server error'})});
const auth=(...roles)=>(q,s,n)=>{try{q.user=jwt.verify((q.headers.authorization||'').slice(7),S);
 if(roles.length&&!roles.includes(q.user.role))throw 0;n()}catch{s.status(401).json({error:'Unauthorized'})}};

// ---- helpers: clinic validation, time maths ----
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],hhmm=/^([01]\d|2[0-3]):[0-5]\d$/,pad=n=>String(n).padStart(2,'0');
const phoneOk=p=>/^\+?[\d\s-]{10,15}$/.test(p||''),toMin=t=>+t.slice(0,2)*60+ +t.slice(3),fromMin=m=>pad(Math.floor(m/60))+':'+pad(m%60);
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())},nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};
const dayOf=date=>DAYS[new Date(date+'T00:00:00Z').getUTCDay()];
function parseClinic(b){
 const phone=(b.phone||'').trim(),addr=(b.clinic_address||'').trim(),city=(b.city||'').trim(),ot=b.open_time||'10:00',ct=b.close_time||'17:00',slot=+b.slot_mins||30;
 const list=Array.isArray(b.work_days)?b.work_days:String(b.work_days||'').split(','),days=DAYS.filter(d=>list.includes(d));
 if(!phoneOk(phone))return{error:'Enter a valid contact number (10-15 digits)'};
 if(!addr||!city)return{error:'Clinic address and city are required'};
 if(!hhmm.test(ot)||!hhmm.test(ct)||toMin(ot)>=toMin(ct))return{error:'Closing time must be after opening time'};
 if(!days.length)return{error:'Select at least one working day'};
 if(![10,15,20,30,45,60].includes(slot))return{error:'Invalid slot length'};
 if(!(+b.fee>0))return{error:'Enter a consultation fee'};
 return{v:{phone,specialization:(b.specialization||'General').trim().slice(0,100),fee:Math.round(+b.fee),qualification:(b.qualification||'').trim().slice(0,100),
  experience:Math.max(0,Math.min(70,+b.experience||0)),clinic_name:(b.clinic_name||'').trim().slice(0,120),clinic_address:addr.slice(0,255),city:city.slice(0,60),
  open_time:ot,close_time:ct,work_days:days.join(','),slot_mins:slot,bio:(b.bio||'').trim().slice(0,500)}}}
const DOC_COLS='qualification,experience,clinic_name,clinic_address,city,open_time,close_time,work_days,slot_mins,bio';
const DEF_DAYS='Mon,Tue,Wed,Thu,Fri,Sat';
// Free slots for one doctor on one date (used by the booking screen AND the AI assistant, so they can never disagree)
function genSlots(d,date,taken){
 if(date<todayStr()||!(d.work_days||DEF_DAYS).split(',').includes(dayOf(date)))return[];
 const sl=d.slot_mins||30,end=toMin(d.close_time||'17:00'),out=[];
 for(let m=toMin(d.open_time||'10:00');m+sl<=end;m+=sl){const t=fromMin(m);if(!taken.has(t)&&!(date===todayStr()&&m<=nowMin()))out.push(t)}
 return out}
const assistant=require('./assistant')({db,H:{genSlots,dayOf,todayStr}});
// tiny per-user rate limit so the AI endpoint can't be hammered (15 messages / minute)
const hits=new Map();
const aiLimit=(q,s,n)=>{const now=Date.now(),a=(hits.get(q.user.id)||[]).filter(t=>now-t<60000);
 if(a.length>=15)return s.status(429).json({error:'Slow down a little. Try again in a minute.'});a.push(now);hits.set(q.user.id,a);n()};

// ---- Auth ----
app.post('/api/register',wrap(async(q,s)=>{
 const{name,email,password,role}=q.body;
 if(!name||!email||!password||!['patient','doctor'].includes(role))return s.status(400).json({error:'Fill all required fields'});
 let c=null;
 if(role==='doctor'){c=parseClinic(q.body);if(c.error)return s.status(400).json({error:c.error})}
 else if(q.body.phone&&!phoneOk(q.body.phone))return s.status(400).json({error:'Enter a valid phone number'});
 const phone=role==='doctor'?c.v.phone:(q.body.phone||'').trim()||null;
 const[r]=await db.query('INSERT INTO users(name,email,password,role,phone) VALUES(?,?,?,?,?)',[name,email,await bcrypt.hash(password,10),role,phone]);
 if(role==='doctor'){const v=c.v;await db.query(`INSERT INTO doctors(user_id,specialization,fee,${DOC_COLS}) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [r.insertId,v.specialization,v.fee,v.qualification,v.experience,v.clinic_name,v.clinic_address,v.city,v.open_time,v.close_time,v.work_days,v.slot_mins,v.bio])}
 s.json({message:role==='doctor'?'Registered. An admin must approve you before you can log in.':'Registered. You can log in now.'});
}));
app.post('/api/login',wrap(async(q,s)=>{
 const[[u]]=await db.query('SELECT u.*,d.status ds FROM users u LEFT JOIN doctors d ON d.user_id=u.id WHERE email=?',[q.body.email]);
 if(!u||!await bcrypt.compare(q.body.password||'',u.password))return s.status(401).json({error:'Wrong email or password'});
 if(u.role==='doctor'&&u.ds!=='approved')return s.status(403).json({error:'Your doctor account is '+u.ds});
 s.json({token:jwt.sign({id:u.id,role:u.role,name:u.name},S,{expiresIn:'1d'}),user:{name:u.name,role:u.role}});
}));

// ---- Doctors ----
app.get('/api/doctors',auth(),wrap(async(q,s)=>{
 const[r]=await db.query(`SELECT u.id,u.name,u.phone,d.specialization,d.fee,${DOC_COLS.split(',').map(c=>'d.'+c).join(',')} FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.status='approved' ORDER BY u.name`);s.json(r)}));
app.get('/api/doctors/:id/slots',auth('patient'),wrap(async(q,s)=>{
 const date=q.query.date;if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return s.status(400).json({error:'Pick a date'});
 const[[d]]=await db.query("SELECT open_time,close_time,work_days,slot_mins FROM doctors WHERE user_id=? AND status='approved'",[q.params.id]);
 if(!d)return s.status(404).json({error:'Doctor not found'});
 const day=dayOf(date);
 if(date<todayStr()||!(d.work_days||DEF_DAYS).split(',').includes(day))return s.json({slots:[],closed:date>=todayStr(),day});
 const[b]=await db.query("SELECT appt_time FROM appointments WHERE doctor_id=? AND appt_date=? AND status<>'cancelled'",[q.params.id,date]);
 s.json({slots:genSlots(d,date,new Set(b.map(x=>x.appt_time))),day})}));
app.get('/api/doctor/profile',auth('doctor'),wrap(async(q,s)=>{
 const[[r]]=await db.query(`SELECT u.name,u.phone,d.specialization,d.fee,d.status,${DOC_COLS.split(',').map(c=>'d.'+c).join(',')} FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.user_id=?`,[q.user.id]);s.json(r)}));
app.put('/api/doctor/profile',auth('doctor'),wrap(async(q,s)=>{
 const c=parseClinic(q.body);if(c.error)return s.status(400).json({error:c.error});const v=c.v,nm=(q.body.name||'').trim();
 if(!nm)return s.status(400).json({error:'Name is required'});
 await db.query('UPDATE users SET name=?,phone=? WHERE id=?',[nm,v.phone,q.user.id]);
 await db.query(`UPDATE doctors SET specialization=?,fee=?,${DOC_COLS.split(',').map(c=>c+'=?').join(',')} WHERE user_id=?`,
  [v.specialization,v.fee,v.qualification,v.experience,v.clinic_name,v.clinic_address,v.city,v.open_time,v.close_time,v.work_days,v.slot_mins,v.bio,q.user.id]);
 s.json({ok:true})}));

// ---- Appointments ----
app.post('/api/appointments',auth('patient'),wrap(async(q,s)=>{
 const{doctor_id,appt_date,appt_time,reason}=q.body;
 if(!doctor_id||!appt_date||!appt_time)return s.status(400).json({error:'Pick a doctor, date and time'});
 const[[d]]=await db.query("SELECT fee,open_time,close_time,work_days,slot_mins FROM doctors WHERE user_id=? AND status='approved'",[doctor_id]);
 if(!d)return s.status(404).json({error:'Doctor not found'});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(appt_date)||!hhmm.test(appt_time))return s.status(400).json({error:'Invalid date or time'});
 if(appt_date<todayStr()||(appt_date===todayStr()&&toMin(appt_time)<=nowMin()))return s.status(400).json({error:'Pick a time in the future'});
 const ot=d.open_time||'10:00',ct=d.close_time||'17:00',sl=d.slot_mins||30,off=toMin(appt_time)-toMin(ot);
 if(!(d.work_days||'Mon,Tue,Wed,Thu,Fri,Sat').split(',').includes(dayOf(appt_date)))return s.status(400).json({error:'Doctor is not available on that day'});
 if(off<0||toMin(appt_time)+sl>toMin(ct)||off%sl)return s.status(400).json({error:"Pick a time from the doctor's available slots"});
 const[[t]]=await db.query("SELECT id FROM appointments WHERE doctor_id=? AND appt_date=? AND appt_time=? AND status<>'cancelled'",[doctor_id,appt_date,appt_time]);
 if(t)return s.status(409).json({error:'That slot is already booked'});
 const[r]=await db.query('INSERT INTO appointments(patient_id,doctor_id,appt_date,appt_time,reason,amount) VALUES(?,?,?,?,?,?)',
  [q.user.id,doctor_id,appt_date,appt_time,reason||'',d.fee]);
 if(!rzp)return s.json({id:r.insertId,demo:true});
 let o;
 try{o=await rzp.orders.create({amount:d.fee*100,currency:'INR',receipt:'apt'+r.insertId})}
 catch(e){ // gateway rejected the order: remove the unpaid row so it doesn't sit in 'pending' and block the slot
  await db.query('DELETE FROM appointments WHERE id=? AND paid=0',[r.insertId]);
  const why=(e&&e.error&&e.error.description)||(e&&e.message)||'could not create order';
  console.error('Razorpay order failed:',e&&e.statusCode,e&&(e.error||e.message));
  return s.status(502).json({error:'Payment gateway error: '+why+'. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env'})}
 await db.query('UPDATE appointments SET order_id=? WHERE id=?',[o.id,r.insertId]);
 s.json({id:r.insertId,order:o,key:process.env.RAZORPAY_KEY_ID});
}));
app.post('/api/appointments/:id/pay',auth('patient'),wrap(async(q,s)=>{
 const[[a]]=await db.query('SELECT * FROM appointments WHERE id=? AND patient_id=?',[q.params.id,q.user.id]);
 if(!a)return s.status(404).json({error:'Not found'});
 const pid=q.body.razorpay_payment_id;
 if(rzp){const h=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(a.order_id+'|'+pid).digest('hex');
  if(h!==q.body.razorpay_signature)return s.status(400).json({error:'Payment verification failed'});}
 await db.query("UPDATE appointments SET paid=1,payment_id=?,status='confirmed' WHERE id=?",[pid||'demo',a.id]);
 s.json({ok:true});
}));
app.get('/api/appointments',auth(),wrap(async(q,s)=>{
 const w={patient:'a.patient_id=?',doctor:'a.doctor_id=?',admin:'1=?'}[q.user.role];
 const[r]=await db.query(`SELECT a.*,p.name patient,p.phone patient_phone,d.name doctor,d.phone doctor_phone,dd.clinic_name,dd.clinic_address,dd.city
  FROM appointments a JOIN users p ON p.id=a.patient_id JOIN users d ON d.id=a.doctor_id LEFT JOIN doctors dd ON dd.user_id=a.doctor_id
  WHERE ${w} ORDER BY a.appt_date DESC,a.appt_time`,[q.user.role==='admin'?1:q.user.id]);s.json(r)}));
app.patch('/api/appointments/:id',auth('patient','doctor'),wrap(async(q,s)=>{
 const dr=q.user.role==='doctor',st=q.body.status;
 if(!(dr?['completed','cancelled']:['cancelled']).includes(st))return s.status(400).json({error:'Not allowed'});
 await db.query(`UPDATE appointments SET status=? WHERE id=? AND ${dr?'doctor_id':'patient_id'}=?`,[st,q.params.id,q.user.id]);
 s.json({ok:true})}));

// ---- AI assistant: message -> criteria (Claude) -> validate -> MySQL -> doctors + slots ----
// Booking is NOT done here. The patient picks a slot and goes through POST /api/appointments + /pay as usual.
app.post('/api/assistant/chat',auth('patient'),aiLimit,wrap(async(q,s)=>{
 const msg=typeof q.body.message==='string'?q.body.message.trim():'';
 if(!msg)return s.status(400).json({error:'Type a message first'});
 if(msg.length>500)return s.status(400).json({error:'Please keep your message under 500 characters'});
 s.json(await assistant.chat(msg,q.body.context,q.user))}));

// ---- Stats (role-aware, powers the dashboards) ----
app.get('/api/stats',auth(),wrap(async(q,s)=>{
 const col={patient:'patient_id',doctor:'doctor_id',admin:null}[q.user.role],w=col?col+'=?':'1=?',p=[col?q.user.id:1];
 const paid="CASE WHEN paid=1 AND status<>'cancelled' THEN amount END";
 const[[t]]=await db.query(`SELECT COUNT(*) total,COALESCE(SUM(status='pending'),0) pending,COALESCE(SUM(status='confirmed'),0) confirmed,
  COALESCE(SUM(status='completed'),0) completed,COALESCE(SUM(status='cancelled'),0) cancelled,
  COALESCE(SUM(appt_date=CURDATE() AND status IN('pending','confirmed')),0) today,
  COALESCE(SUM(appt_date>=CURDATE() AND status IN('pending','confirmed')),0) upcoming,
  COALESCE(SUM(${paid}),0) revenue,COUNT(DISTINCT patient_id) patients FROM appointments WHERE ${w}`,p);
 const[days]=await db.query(`SELECT appt_date d,COUNT(*) n,COALESCE(SUM(${paid}),0) rev FROM appointments
  WHERE ${w} AND appt_date BETWEEN DATE_SUB(CURDATE(),INTERVAL 6 DAY) AND CURDATE() GROUP BY appt_date`,p);
 const out={totals:Object.fromEntries(Object.entries(t).map(([k,v])=>[k,Number(v)])),days:days.map(r=>({d:r.d,n:+r.n,rev:+r.rev}))};
 if(q.user.role==='admin'){
  const[[u]]=await db.query(`SELECT (SELECT COUNT(*) FROM users WHERE role='patient') patients,
   (SELECT COUNT(*) FROM doctors WHERE status='approved') approved,(SELECT COUNT(*) FROM doctors WHERE status='pending') pending`);
  const[top]=await db.query(`SELECT d.name,COUNT(*) n,COALESCE(SUM(CASE WHEN a.paid=1 AND a.status<>'cancelled' THEN a.amount END),0) rev
   FROM appointments a JOIN users d ON d.id=a.doctor_id GROUP BY d.id ORDER BY rev DESC,n DESC LIMIT 5`);
  out.admin={patients:+u.patients,approved:+u.approved,pendingDoctors:+u.pending};out.top=top.map(r=>({name:r.name,n:+r.n,rev:+r.rev}));
 }
 s.json(out)}));

// ---- Admin ----
app.get('/api/admin/doctors',auth('admin'),wrap(async(q,s)=>{
 const[r]=await db.query('SELECT u.id,u.name,u.email,u.phone,d.specialization,d.fee,d.status,d.clinic_name,d.clinic_address,d.city,d.open_time,d.close_time,d.work_days FROM doctors d JOIN users u ON u.id=d.user_id');s.json(r)}));
app.patch('/api/admin/doctors/:id',auth('admin'),wrap(async(q,s)=>{
 if(!['approved','rejected'].includes(q.body.status))return s.status(400).json({error:'Bad status'});
 await db.query('UPDATE doctors SET status=? WHERE user_id=?',[q.body.status,q.params.id]);s.json({ok:true})}));

// ---- Start (seeds the admin on first run) ----
(async()=>{
 const add={users:{phone:'VARCHAR(15)'},doctors:{qualification:'VARCHAR(100)',experience:'INT DEFAULT 0',clinic_name:'VARCHAR(120)',clinic_address:'VARCHAR(255)',city:'VARCHAR(60)',
  open_time:"VARCHAR(5) DEFAULT '10:00'",close_time:"VARCHAR(5) DEFAULT '17:00'",work_days:"VARCHAR(40) DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat'",slot_mins:'INT DEFAULT 30',bio:'VARCHAR(500)'}};
 for(const[t,cols]of Object.entries(add)){const[ex]=await db.query('SELECT COLUMN_NAME c FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?',[t]);
  const have=new Set(ex.map(x=>x.c||x.COLUMN_NAME));for(const[c,def]of Object.entries(cols))if(!have.has(c)){await db.query(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`);console.log('DB upgraded: added',t+'.'+c)}}
 const[[a]]=await db.query("SELECT id FROM users WHERE role='admin'");
 if(!a)await db.query("INSERT INTO users(name,email,password,role) VALUES('Admin','admin@care.com',?,'admin')",[await bcrypt.hash('admin123',10)]);
 const P=process.env.PORT||5000;
 app.listen(P,()=>console.log(`MediBook running → http://localhost:${P}  (payments: ${rzp?'Razorpay':'DEMO mode'}, assistant: ${process.env.ANTHROPIC_API_KEY?'Claude '+(process.env.AI_MODEL||'claude-haiku-5-5'):'built-in parser — set ANTHROPIC_API_KEY to enable Claude'})`));
})().catch(e=>{console.error('Startup failed — check MySQL & .env:',e.message);process.exit(1)});
