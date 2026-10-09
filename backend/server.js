require('dotenv').config();
const express=require('express'),mysql=require('mysql2/promise'),bcrypt=require('bcryptjs'),
jwt=require('jsonwebtoken'),crypto=require('crypto'),path=require('path');
const app=express();app.use(express.json());
app.use(express.static(path.join(__dirname,'../frontend')));
const db=mysql.createPool({host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',
 password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'medibook',dateStrings:true});
const S=process.env.JWT_SECRET||'dev_secret';
const rzp=process.env.RAZORPAY_KEY_ID?new(require('razorpay'))({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET}):null;
const wrap=f=>(q,s,n)=>f(q,s,n).catch(e=>{console.error(e);
 s.status(e.code==='ER_DUP_ENTRY'?409:500).json({error:e.code==='ER_DUP_ENTRY'?'Email already registered':'Server error'})});
const auth=(...roles)=>(q,s,n)=>{try{q.user=jwt.verify((q.headers.authorization||'').slice(7),S);
 if(roles.length&&!roles.includes(q.user.role))throw 0;n()}catch{s.status(401).json({error:'Unauthorized'})}};

// ---- Auth ----
app.post('/api/register',wrap(async(q,s)=>{
 const{name,email,password,role,specialization,fee}=q.body;
 if(!name||!email||!password||!['patient','doctor'].includes(role))return s.status(400).json({error:'Fill all required fields'});
 const[r]=await db.query('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)',[name,email,await bcrypt.hash(password,10),role]);
 if(role==='doctor')await db.query('INSERT INTO doctors(user_id,specialization,fee) VALUES(?,?,?)',[r.insertId,specialization||'General',fee||500]);
 s.json({message:role==='doctor'?'Registered. An admin must approve you before you can log in.':'Registered. You can log in now.'});
}));
app.post('/api/login',wrap(async(q,s)=>{
 const[[u]]=await db.query('SELECT u.*,d.status ds FROM users u LEFT JOIN doctors d ON d.user_id=u.id WHERE email=?',[q.body.email]);
 if(!u||!await bcrypt.compare(q.body.password||'',u.password))return s.status(401).json({error:'Wrong email or password'});
 if(u.role==='doctor'&&u.ds!=='approved')return s.status(403).json({error:'Your doctor account is '+u.ds});
 s.json({token:jwt.sign({id:u.id,role:u.role,name:u.name},S,{expiresIn:'1d'}),user:{name:u.name,role:u.role}});
}));

// ---- Doctors (public) ----
app.get('/api/doctors',wrap(async(q,s)=>{
 const[r]=await db.query("SELECT u.id,u.name,d.specialization,d.fee FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.status='approved'");s.json(r)}));

// ---- Appointments ----
app.post('/api/appointments',auth('patient'),wrap(async(q,s)=>{
 const{doctor_id,appt_date,appt_time,reason}=q.body;
 if(!doctor_id||!appt_date||!appt_time)return s.status(400).json({error:'Pick a doctor, date and time'});
 const[[d]]=await db.query("SELECT fee FROM doctors WHERE user_id=? AND status='approved'",[doctor_id]);
 if(!d)return s.status(404).json({error:'Doctor not found'});
 const[[t]]=await db.query("SELECT id FROM appointments WHERE doctor_id=? AND appt_date=? AND appt_time=? AND status<>'cancelled'",[doctor_id,appt_date,appt_time]);
 if(t)return s.status(409).json({error:'That slot is already booked'});
 const[r]=await db.query('INSERT INTO appointments(patient_id,doctor_id,appt_date,appt_time,reason,amount) VALUES(?,?,?,?,?,?)',
  [q.user.id,doctor_id,appt_date,appt_time,reason||'',d.fee]);
 if(!rzp)return s.json({id:r.insertId,demo:true});
 const o=await rzp.orders.create({amount:d.fee*100,currency:'INR',receipt:'apt'+r.insertId});
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
 const[r]=await db.query(`SELECT a.*,p.name patient,d.name doctor FROM appointments a
  JOIN users p ON p.id=a.patient_id JOIN users d ON d.id=a.doctor_id WHERE ${w} ORDER BY a.appt_date DESC,a.appt_time`,
  [q.user.role==='admin'?1:q.user.id]);s.json(r)}));
app.patch('/api/appointments/:id',auth('patient','doctor'),wrap(async(q,s)=>{
 const dr=q.user.role==='doctor',st=q.body.status;
 if(!(dr?['completed','cancelled']:['cancelled']).includes(st))return s.status(400).json({error:'Not allowed'});
 await db.query(`UPDATE appointments SET status=? WHERE id=? AND ${dr?'doctor_id':'patient_id'}=?`,[st,q.params.id,q.user.id]);
 s.json({ok:true})}));

// ---- Admin ----
app.get('/api/admin/doctors',auth('admin'),wrap(async(q,s)=>{
 const[r]=await db.query('SELECT u.id,u.name,u.email,d.specialization,d.fee,d.status FROM doctors d JOIN users u ON u.id=d.user_id');s.json(r)}));
app.patch('/api/admin/doctors/:id',auth('admin'),wrap(async(q,s)=>{
 if(!['approved','rejected'].includes(q.body.status))return s.status(400).json({error:'Bad status'});
 await db.query('UPDATE doctors SET status=? WHERE user_id=?',[q.body.status,q.params.id]);s.json({ok:true})}));

// ---- Start (seeds the admin on first run) ----
(async()=>{
 const[[a]]=await db.query("SELECT id FROM users WHERE role='admin'");
 if(!a)await db.query("INSERT INTO users(name,email,password,role) VALUES('Admin','admin@care.com',?,'admin')",[await bcrypt.hash('admin123',10)]);
 const P=process.env.PORT||5001;
 app.listen(P,()=>console.log(`MediBook running → http://localhost:${P}  (payments: ${rzp?'Razorpay':'DEMO mode'})`));
})().catch(e=>{console.error('Startup failed — check MySQL & .env:',e.message);process.exit(1)});
