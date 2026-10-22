const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017', {
    directConnection: true,
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const admin = client.db('admin');

    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      console.log('Replica set already initialized. Status:', status.set, '-', status.myState);
    } catch (e) {
      if (e.codeName === 'NotYetInitialized' || e.code === 94) {
        console.log('Initializing replica set...');
        const result = await admin.command({
          replSetInitiate: {
            _id: 'rs0',
            members: [{ _id: 0, host: 'localhost:27017' }],
          },
        });
        console.log('Result:', result.ok === 1 ? 'SUCCESS' : result);
      } else {
        throw e;
      }
    }

    // Wait for primary election
    console.log('Waiting for primary election...');
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const ismaster = await admin.command({ isMaster: 1 });
        if (ismaster.ismaster) {
          console.log('✅ Replica set is ready - PRIMARY elected!');
          break;
        }
        process.stdout.write('.');
      } catch {}
    }
  } finally {
    await client.close();
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
