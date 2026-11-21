
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
// Local development: data.json stays beside server.js. Render: set DATA_DIR=/var/data
// and attach a Persistent Disk mounted at /var/data.
const DATA_DIR = path.resolve(process.env.DATA_DIR || __dirname);
fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, "data.json");
// One-time migration for an older deployment that stored data.json beside server.js.
const LEGACY_DATA_FILE = path.join(__dirname, "data.json");
if (DATA_FILE !== LEGACY_DATA_FILE && !fs.existsSync(DATA_FILE) && fs.existsSync(LEGACY_DATA_FILE)) {
  fs.copyFileSync(LEGACY_DATA_FILE, DATA_FILE);
  console.log(`Migrated existing data.json to ${DATA_FILE}`);
}
const customerSessions = new Map();
const adminSessions = new Set();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "8057";
const RETAIL_PASSWORD = process.env.RETAIL_PASSWORD || "2626";

app.use(express.json({limit:"10mb"}));
app.use(express.static(path.join(__dirname, "public")));
app.post("/api/admin/login",(req,res)=>{
  if(String(req.body.password||"")!==ADMIN_PASSWORD) return res.status(401).json({error:"Incorrect admin password."});
  const token=crypto.randomBytes(32).toString("hex"); adminSessions.add(token); res.json({token});
});
app.post("/api/retail/login",(req,res)=>{
  if(String(req.body.password||"")!==RETAIL_PASSWORD) return res.status(401).json({error:"Incorrect retail billing password."});
  const token=crypto.randomBytes(32).toString("hex"); adminSessions.add(token); res.json({token});
});
app.post("/api/admin/logout",(req,res)=>{adminSessions.delete(String(req.headers["x-admin-token"]||""));res.json({ok:true});});
app.use((req,res,next)=>{
  const p=req.path;
  const protectedRoute = p.startsWith("/api/admin/") ||
    ["POST /api/products","POST /api/customers","GET /api/invoices","PUT /api/settings"].includes(`${req.method} ${p}`) ||
    ((req.method==="PUT" || req.method==="DELETE") && (p.startsWith("/api/products/") || p.startsWith("/api/customers/"))) ||
    ((req.method==="PUT" || req.method==="DELETE") && p.startsWith("/api/invoices/")) ||
    (req.method==="GET" && p==="/api/deleted-invoices") ||
    (req.method==="DELETE" && p.startsWith("/api/deleted-invoices/"));
  if(protectedRoute){const token=String(req.headers["x-admin-token"]||"");if(!adminSessions.has(token))return res.status(401).json({error:"Admin login required."});}
  if(req.method==="POST" && p==="/api/invoices" && req.body.adminBilling===true){const token=String(req.headers["x-admin-token"]||"");if(!adminSessions.has(token))return res.status(401).json({error:"Admin login required for Admin Billing."});}
  next();
});

function readData(){
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    d.products ||= [];
    d.customers ||= [];
    d.invoices ||= [];
    d.deletedInvoices ||= [];
    d.settings ||= {lowStockThreshold:5};
    d.settings.lowStockThreshold = Number(d.settings.lowStockThreshold ?? 5);
    return d;
  } catch {
    return {products:[], customers:[], invoices:[], deletedInvoices:[], settings:{lowStockThreshold:5}};
  }
}
function writeData(d){
  // Atomic replace prevents a partial JSON file if the process stops during a write.
  const tempFile = DATA_FILE + ".tmp";
  fs.writeFileSync(tempFile, JSON.stringify(d, null, 2), "utf8");
  fs.renameSync(tempFile, DATA_FILE);
}
function id(prefix){
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,7);
}
function num(v){ const n=Number(v); return Number.isFinite(n) ? n : 0; }
function round(v){ return Math.round((num(v)+Number.EPSILON)*100)/100; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function addDaysISO(dateStr, days){ const d=new Date(String(dateStr||todayISO())+"T00:00:00"); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }

function normalizeProduct(p){
  const out = {
    id:p.id || id("P"),
    name:String(p.name||"").trim(),
    hsn:String(p.hsn||"").trim(),
    batchNo:String(p.batchNo||"").trim(),
    expiryDate:String(p.expiryDate||""),
    manufacturingDate:String(p.manufacturingDate||""),
    mrp:round(p.mrp),
    rate:round(p.rate),
    purchaseRate:round(p.purchaseRate),
    category:String(p.category||"").trim(),
    company:String(p.company||"").trim(),
    tax:round(p.tax),
    stock:num(p.stock),
    unit:String(p.unit||"piece"),
    image:String(p.image||"").trim(),
  };
  if (!out.name) throw new Error("Product name is required.");
  if (out.manufacturingDate && out.expiryDate && out.manufacturingDate > out.expiryDate)
    throw new Error("Manufacturing date must be before expiry date.");
  return out;
}

function snapshotItems(data, items, allowOverrides=false){
  if (!Array.isArray(items) || !items.length) throw new Error("Add at least one product.");
  return items.map(x=>{
    const p = data.products.find(q=>q.id===x.productId);
    if (!p) throw new Error("Product not found: " + (x.productId||""));
    const qty = Math.max(0.001, Math.round(num(x.qty)*1000)/1000);
    return {
      productId:p.id, name:p.name, hsn:p.hsn, batchNo:p.batchNo, purchaseRate:num(p.purchaseRate),
      expiryDate:p.expiryDate, manufacturingDate:p.manufacturingDate, image:p.image, unit:p.unit,
      mrp:allowOverrides && Object.prototype.hasOwnProperty.call(x,"mrp") ? Math.max(0,num(x.mrp)) : num(p.mrp),
      rate:allowOverrides && Object.prototype.hasOwnProperty.call(x,"rate") ? Math.max(0,num(x.rate)) : num(p.rate),
      tax:x.free===true ? 0 : (allowOverrides && Object.prototype.hasOwnProperty.call(x,"tax") ? Math.max(0,num(x.tax)) : num(p.tax)), qty,
      discount:round(Math.max(0,num(x.discount))), amount:round(qty*(allowOverrides && Object.prototype.hasOwnProperty.call(x,"rate") ? Math.max(0,num(x.rate)) : num(p.rate)))
    };
  });
}

function totals(items, discount, delivery){
  const subtotal = round(items.reduce((s,i)=>s+num(i.amount),0));
  const disc = round(Math.max(0, num(discount)));
  const taxable = round(Math.max(0, subtotal-disc));
  const gst = round(items.reduce((s,i)=>s + (num(i.amount) * num(i.tax)/100),0));
  const del = round(Math.max(0,num(delivery)));
  return {
    subtotal, discount:disc, taxable, gst, delivery:del,
    grandTotal:round(taxable+gst+del),
    totalMrp:round(items.reduce((s,i)=>s + num(i.qty)*num(i.mrp),0))
  };
}

function validateCustomer(body){
  const name=String(body.customerName||body.name||"").trim();
  const address=String(body.address||"").trim();
  const mobile=String(body.mobile||"").trim();
  if(!name || !address || !mobile) throw new Error("Customer Name, Address and Mobile Number are required.");
  if(!/^\d{10}$/.test(mobile)) throw new Error("Mobile Number must contain exactly 10 digits.");
  return {name,address,mobile,gstin:String(body.gstin||"").trim()};
}

function applyStock(data, items, direction){
  for(const i of items){
    const p=data.products.find(q=>q.id===i.productId);
    if(p) p.stock = num(p.stock) + direction * num(i.qty);
  }
}

// Customer-facing product API deliberately omits purchaseRate.
app.get("/api/products",(req,res)=>res.json(readData().products.map(({purchaseRate,...p})=>p)));
// Admin-only UI endpoint includes purchaseRate. This local app has no authentication; do not expose it to the public internet.
app.get("/api/admin/products",(req,res)=>res.json(readData().products));
app.post("/api/products",(req,res)=>{
  try{
    const d=readData();
    const p=normalizeProduct(req.body);
    p.id=id("P");
    d.products.push(p); writeData(d); res.json(p);
  }catch(e){res.status(400).json({error:e.message});}
});
app.put("/api/products/:id",(req,res)=>{
  try{
    const d=readData(), idx=d.products.findIndex(p=>p.id===req.params.id);
    if(idx<0) return res.status(404).json({error:"Product not found."});
    const p=normalizeProduct({...d.products[idx],...req.body,id:req.params.id});
    d.products[idx]=p; writeData(d); res.json(p);
  }catch(e){res.status(400).json({error:e.message});}
});
app.delete("/api/products/:id",(req,res)=>{
  const d=readData();
  d.products=d.products.filter(p=>p.id!==req.params.id);
  writeData(d); res.json({ok:true});
});


function passwordHash(password, salt){ return crypto.scryptSync(String(password), salt, 64).toString("hex"); }
function safeCustomer(c){ return {id:c.id,name:c.name,address:c.address,mobile:c.mobile,gstin:c.gstin||""}; }
app.post("/api/auth/register",(req,res)=>{
  try{
    const d=readData(), c=validateCustomer({customerName:req.body.name,address:req.body.address,mobile:req.body.mobile,gstin:req.body.gstin}), password=String(req.body.password||"");
    if(password.length<6) throw new Error("Password must be at least 6 characters.");
    let user=d.customers.find(x=>x.mobile===c.mobile);
    if(user && user.passwordHash) throw new Error("This mobile number is already registered. Please log in.");
    if(user && String(user.name||"").trim().toLowerCase()!==c.name.toLowerCase()) throw new Error("This mobile number belongs to an existing customer record. Enter the same customer name or ask admin to verify it.");
    const salt=crypto.randomBytes(16).toString("hex");
    if(user) Object.assign(user,c,{passwordSalt:salt,passwordHash:passwordHash(password,salt)});
    else { user={id:id("C"),...c,passwordSalt:salt,passwordHash:passwordHash(password,salt)}; d.customers.push(user); }
    writeData(d);
    const token=crypto.randomBytes(32).toString("hex"); customerSessions.set(token,user.id);
    res.json({token,customer:safeCustomer(user)});
  }catch(e){res.status(400).json({error:e.message});}
});
app.post("/api/auth/login",(req,res)=>{
  const d=readData(), mobile=String(req.body.mobile||"").trim(), password=String(req.body.password||"");
  const user=d.customers.find(x=>x.mobile===mobile && x.passwordHash && x.passwordSalt);
  if(!user || passwordHash(password,user.passwordSalt)!==user.passwordHash) return res.status(401).json({error:"Invalid mobile number or password. If this is an older customer record, register with this mobile first after admin updates it."});
  const token=crypto.randomBytes(32).toString("hex"); customerSessions.set(token,user.id);
  res.json({token,customer:safeCustomer(user)});
});
app.get("/api/auth/me",(req,res)=>{
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  const userId=customerSessions.get(token), user=readData().customers.find(x=>x.id===userId);
  if(!user) return res.status(401).json({error:"Please log in."});
  res.json({customer:safeCustomer(user)});
});
app.post("/api/auth/logout",(req,res)=>{const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");customerSessions.delete(token);res.json({ok:true});});
app.get("/api/customer/invoices",(req,res)=>{
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  const userId=customerSessions.get(token); if(!userId) return res.status(401).json({error:"Please log in."});
  const d=readData(), user=d.customers.find(x=>x.id===userId); if(!user) return res.status(401).json({error:"Please log in."});
  res.json(d.invoices.filter(inv=>inv.customer && inv.customer.mobile===user.mobile));
});
app.get("/api/invoices/lookup/:invoiceNo",(req,res)=>{
  const inv=readData().invoices.find(x=>String(x.invoiceNo||"").toLowerCase()===String(req.params.invoiceNo||"").toLowerCase());
  if(!inv) return res.status(404).json({error:"Invoice not found."});
  res.json({invoiceNo:inv.invoiceNo,invoiceDate:inv.invoiceDate,dueDate:inv.dueDate,customer:inv.customer,adminBilling:!!inv.adminBilling});
});

app.get("/api/customers",(req,res)=>res.json(readData().customers.map(c=>({...safeCustomer(c),hasLogin:!!c.passwordHash}))));
app.post("/api/admin/customers/:id/reset-password",(req,res)=>{
  const password=String(req.body.password||"");if(password.length<6)return res.status(400).json({error:"Password must be at least 6 characters."});
  const d=readData(),c=d.customers.find(x=>x.id===req.params.id);if(!c)return res.status(404).json({error:"Customer not found."});
  const salt=crypto.randomBytes(16).toString("hex");c.passwordSalt=salt;c.passwordHash=passwordHash(password,salt);writeData(d);res.json({ok:true});
});
app.post("/api/customers",(req,res)=>{
  try{
    const d=readData(), c=validateCustomer(req.body);
    const found=d.customers.find(x=>x.id===req.body.id || (x.mobile===c.mobile && c.mobile));
    if(found) Object.assign(found,c);
    else { c.id=id("C"); d.customers.push(c); }
    writeData(d); res.json(found||c);
  }catch(e){res.status(400).json({error:e.message});}
});
app.put("/api/customers/:id",(req,res)=>{
  try{
    const d=readData(), c=validateCustomer(req.body), x=d.customers.find(q=>q.id===req.params.id);
    if(!x) return res.status(404).json({error:"Customer not found."});
    Object.assign(x,c); writeData(d); res.json(x);
  }catch(e){res.status(400).json({error:e.message});}
});
app.delete("/api/customers/:id",(req,res)=>{
  const d=readData(); d.customers=d.customers.filter(c=>c.id!==req.params.id); writeData(d); res.json({ok:true});
});

app.get("/api/invoices",(req,res)=>res.json(readData().invoices));
app.post("/api/invoices",(req,res)=>{
  try{
    const d=readData();
    const c=validateCustomer(req.body);
    const isAdminBilling=req.body.adminBilling===true;
    const items=snapshotItems(d,req.body.items,isAdminBilling);
    const t=totals(items,req.body.discount,req.body.delivery);
    const inv={
      id:id("I"),
      invoiceNo:String(req.body.invoiceNo||("INV-"+String(d.invoices.length+1).padStart(5,"0"))),
      invoiceDate:String(req.body.invoiceDate||todayISO()),
      dueDate:String(req.body.dueDate||addDaysISO(req.body.invoiceDate||todayISO(),1)),
      previousPending:round(req.body.previousPending||0),
      customer:c, items, ...t, adminBilling:isAdminBilling, retailBilling:req.body.retailBilling===true, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
    };
    // Orders are allowed to exceed stock; negative stock is intentional.
    applyStock(d,items,-1);
    const existing=d.customers.find(x=>x.mobile===c.mobile || x.name.toLowerCase()===c.name.toLowerCase());
    if(existing) Object.assign(existing,c);
    else d.customers.push({id:id("C"),...c});
    d.invoices.push(inv); writeData(d); res.json(inv);
  }catch(e){res.status(400).json({error:e.message});}
});

app.put("/api/invoices/:id",(req,res)=>{
  try{
    const d=readData();
    const inv=d.invoices.find(x=>x.id===req.params.id);
    if(!inv) return res.status(404).json({error:"Invoice not found."});
    const c=validateCustomer(req.body);
    const newItems=snapshotItems(d,req.body.items,req.body.adminEdit===true);
    // Transaction-like edit: work on a deep clone and commit only after all validation succeeds.
    const work=JSON.parse(JSON.stringify(d));
    const old=work.invoices.find(x=>x.id===inv.id);
    applyStock(work,old.items,+1);       // restore old sold quantity
    const t=totals(newItems,req.body.discount,req.body.delivery);
    applyStock(work,newItems,-1);        // deduct new quantity; can go negative
    old.invoiceNo=String(req.body.invoiceNo||old.invoiceNo);
    old.invoiceDate=String(req.body.invoiceDate||old.invoiceDate);
    old.dueDate=String(req.body.dueDate||addDaysISO(old.invoiceDate,1));
    old.previousPending=round(req.body.previousPending||0);
    old.customer=c; old.items=newItems; Object.assign(old,t); old.updatedAt=new Date().toISOString();
    const existing=work.customers.find(x=>x.mobile===c.mobile || x.name.toLowerCase()===c.name.toLowerCase());
    if(existing) Object.assign(existing,c); else work.customers.push({id:id("C"),...c});
    writeData(work); res.json(old);
  }catch(e){res.status(400).json({error:e.message});}
});

app.get("/api/deleted-invoices",(req,res)=>res.json(readData().deletedInvoices||[]));
app.delete("/api/invoices/:id",(req,res)=>{
  const d=readData(), index=d.invoices.findIndex(x=>x.id===req.params.id);
  if(index<0)return res.status(404).json({error:"Invoice not found."});
  const [inv]=d.invoices.splice(index,1); applyStock(d,inv.items,+1);
  inv.deletedAt=new Date().toISOString();d.deletedInvoices ||= [];d.deletedInvoices.push(inv);
  writeData(d); res.json({ok:true,archived:true});
});
app.delete("/api/deleted-invoices/:id",(req,res)=>{
  const d=readData(),index=(d.deletedInvoices||[]).findIndex(x=>x.id===req.params.id);
  if(index<0)return res.status(404).json({error:"Deleted invoice not found."});
  d.deletedInvoices.splice(index,1);writeData(d);res.json({ok:true,permanentlyDeleted:true});
});

// Admin-only full backup and restore. Export includes customer password hashes; keep files private.
app.get("/api/admin/data/export",(req,res)=>{
  const d=readData();
  res.setHeader("Content-Disposition", `attachment; filename=shree-agency-backup-${new Date().toISOString().slice(0,10)}.json`);
  res.json({backupVersion:1,exportedAt:new Date().toISOString(),data:d});
});
app.post("/api/admin/data/restore",(req,res)=>{
  try{
    const incoming=req.body && (req.body.data || req.body);
    if(!incoming || !Array.isArray(incoming.products) || !Array.isArray(incoming.customers) || !Array.isArray(incoming.invoices))
      return res.status(400).json({error:"Invalid backup file. Products, customers and invoices arrays are required."});
    const restored={
      products:incoming.products,
      customers:incoming.customers,
      invoices:incoming.invoices,
      deletedInvoices:Array.isArray(incoming.deletedInvoices)?incoming.deletedInvoices:[],
      settings:incoming.settings && typeof incoming.settings==="object" ? incoming.settings : {lowStockThreshold:5}
    };
    restored.settings.lowStockThreshold=Math.max(0,num(restored.settings.lowStockThreshold??5));
    writeData(restored);
    res.json({ok:true,products:restored.products.length,customers:restored.customers.length,invoices:restored.invoices.length});
  }catch(e){res.status(400).json({error:"Backup restore failed: "+e.message});}
});

app.get("/api/settings",(req,res)=>res.json(readData().settings));
app.put("/api/settings",(req,res)=>{
  const d=readData();
  d.settings={...d.settings,...req.body};
  d.settings.lowStockThreshold=Math.max(0,num(d.settings.lowStockThreshold??5));
  ["agencyName","agencyAddress","agencyMobile","agencyEmail","agencyGSTIN","terms","authorizedSignature"].forEach(k=>{if(d.settings[k]!==undefined)d.settings[k]=String(d.settings[k]);});
  writeData(d); res.json(d.settings);
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Shivmalhar Agency Billing running at http://localhost:${PORT}`));
