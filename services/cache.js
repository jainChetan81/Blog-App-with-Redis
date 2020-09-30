const mongoose = require("mongoose");

const redis = require("redis");
const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);
const util = require("util");

client.get = util.promisify(client.get);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = () => {
    this.useCache = true;
};

mongoose.Query.prototype.exec = async function () {
    if (!this.useCache) return await exec.apply(this, arguments);
    
    console.log("running a query");
    //TODO:to safely copy objects
    const key = JSON.stringify(
        Object.assign({}, this.getQuery(), {
            collection: this.mongooseCollection.name,
        })
    );
    // check if any cached data in redis related to key
    const cachedValues = await client.get(key);
    client.on("error", function (error) {
        console.error(error);
    });
    //if yes, return
    if (cachedValues) {
        const doc = JSON.parse(cachedValues);
        return Array.isArray(doc)
            ? doc.map((d) => new this.model(d))
            : new this.model(doc);
    }

    // if no, respond to request
    // and cache data in store

    console.log("key :", key);
    const result = await exec.apply(this, arguments);
    client.set(JSON.stringify(result));
    console.log("result : ", result);
    return result;
};

// client.set(req.user.id, JSON.stringify(blogs));
// console.log("no redis here");
