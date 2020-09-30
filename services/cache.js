const mongoose = require("mongoose");
const redis = require("redis");
const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);
const util = require("util");

client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || "");
    console.log("picking from cache");
    return this;
};
//TODO: "this" is a reference to query>.prototype

mongoose.Query.prototype.exec = async function () {
    if (!this.useCache) {
        console.log("not picking from cache");
        return exec.apply(this, arguments);
    }

    console.log("running a query");
    //TODO:to safely copy objects
    const key = JSON.stringify(
        Object.assign({}, this.getQuery(), {
            collection: this.mongooseCollection.name,
        })
    );
    console.log("we have key");
    // check if any cached data in redis related to key
    const cachedValues = await client.get(this.hashKey, key);
    console.log("got cached value", cachedValues);
    //if yes, return
    // if (cachedValues) {
    //     console.log("cache exists", cachedValues);
    //     const doc = JSON.parse(cachedValues);
    //     return Array.isArray(doc)
    //         ? doc.map((d) => new this.model(d))
    //         : new this.model(doc);
    // }
    // if no, respond to request
    // and cache data in store
    console.log("key :-----------------------------------", key);
    const result = await exec.apply(this, arguments);
    client.hset(this.hashKey, key, JSON.stringify(result), "EX", 10);
    return result;
};

module.exports = {
    clearHash(hashKey) {
        client.del(JSON.stringify(hashKey));
    },
};
