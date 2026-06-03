require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const Shop = require('../src/models/shop.model');

async function inspect() {
    try {
        console.log("Connecting to database...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB!");

        const admins = await User.find({ role: 'admin' });
        console.log(`\nFound ${admins.length} admin user(s):`);
        for (const admin of admins) {
            console.log(`- ID: ${admin._id}, Name: ${admin.name}, Email: ${admin.email}`);
            
            const shops = await Shop.find({ owner: admin._id });
            console.log(`  Shops owned by this admin (${shops.length}):`);
            for (const shop of shops) {
                console.log(`    * Shop ID: ${shop._id}`);
                console.log(`      Name: ${shop.name}`);
                console.log(`      Description: ${shop.description}`);
                console.log(`      Phone: ${shop.phone}`);
                console.log(`      Email: ${shop.email}`);
                console.log(`      Address: ${JSON.stringify(shop.address, null, 2)}`);
                console.log(`      Status: ${shop.status}`);
            }
        }

        // Also let's check all shops in general to see if there's any shop with a specific address
        const allShops = await Shop.find({}).populate('owner', 'name email role');
        console.log(`\nAll Shops in Database (${allShops.length}):`);
        for (const s of allShops) {
            console.log(`- Shop ID: ${s._id}, Name: ${s.name}, Owner Role: ${s.owner ? s.owner.role : 'none'} (${s.owner ? s.owner.email : 'N/A'})`);
            console.log(`  Address: ${JSON.stringify(s.address)}`);
        }

    } catch (error) {
        console.error("Error inspecting database:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB.");
    }
}

inspect();
