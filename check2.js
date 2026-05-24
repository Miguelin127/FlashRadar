const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function run() {
  const stores = {};
  let last = null;
  let total = 0;
  
  while (true) {
    let q = db.collection('deals_live').orderBy('__name__').limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    snap.docs.forEach(d => {
      const s = d.data().storeKey || d.data().store || 'unknown';
      stores[s] = (stores[s] || 0) + 1;
    });
    total += snap.size;
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }
  
  console.log('Full store breakdown:', JSON.stringify(stores, null, 2));
  console.log('Total docs:', total);
  process.exit(0);
}
run().catch(console.error);
