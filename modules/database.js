// In the following line, you should include the prefixes of implementations you want to test.
window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
// DON'T use "var indexedDB = ..." if you're not in a function.
// Moreover, you may need references to some window.IDB* objects:
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
// (Mozilla has never prefixed these objects, so we don't need window.mozIDB*)

const IDBExplorer = (new function() {
    this.list = async function() {
        console.log([...await indexedDB.databases()].map(o => `name: ${o.name}, version: ${o.version}`).join("\n"));
    };
    this.delete = async function(name) {
        let req = indexedDB.deleteDatabase(name);
        console.log(`Deleting database ${name}`);
        req.onerror = function(event) {
            console.log(`Error deleting database ${name}.`);
        };
        req.onsuccess = function(event) {
            console.log(`Database ${name} deleted successfully`);
        };
    }
}());


class Data {
    constructor() {}
    async initialize() {
        // Let us open version 4 of our database
        let DBOpenRequest = indexedDB.open("essays", 1);

        let db = await new Promise((res, rej) => {

            DBOpenRequest.addEventListener('upgradeneeded', event => {
                const db = event.target.result;
                console.log(`Upgrading to version ${db.version}`);

                // Create an objectStore for this database
                const metaStore = db.createObjectStore("essay-metadata", {
                    keyPath: "id",
                    autoIncrement: true
                });

                metaStore.createIndex("tags", "tags", {
                    multiEntry: true
                });
                metaStore.createIndex("title", "title", {
                    unique: false
                });
                metaStore.createIndex("created", "timestamps.created", {
                    unique: false
                });
                metaStore.createIndex("modified", "timestamps.modified", {
                    unique: false
                });
                metaStore.createIndex("opened", "timestamps.opened", {
                    unique: false
                });

                const bodyStore = db.createObjectStore("essay-body", {
                    keyPath: "id"
                });
            });

            // these two event handlers act on the database being opened successfully, or not
            DBOpenRequest.onerror = function(event) {
                console.error("Error loading database.");
                rej();
            };

            DBOpenRequest.onsuccess = function(event) {
                console.info("Database initialized.");
                // store the result of opening the database in the db variable. This is used a lot later on, for opening transactions and suchlike.
                res(DBOpenRequest.result);
            };
        });
        this.db = db;
        console.log(db);
    }
    order_vals = {
        "modify-new": ["modified", "prev"],
        "modify-old": ["modified", "next"],
        "opened-new": ["opened", "prev"],
        "opened-old": ["opened", "next"],
        "create-new": ["created", "prev"],
        "create-old": ["created", "next"],
        "alph-a-z": ["title", "next"],
        "alph-z-a": ["title", "prev"]
    };
    async search(params) {
        let that = this;
        console.log(`search param: ${JSON.stringify(params)}`);
        let {
            search_str,
            order
        } = params;

        let {
            db
        } = this;

        search_str = search_str.toLowerCase();

        const transaction = db.transaction(["essay-metadata"], "readonly");
        const metaStore = transaction.objectStore("essay-metadata");
        //wait for the iteration to be over
        let results = [];
        await new Promise((res, rej) => {
            let [index_str, direction] = that.order_vals[order];
            console.log(index_str, direction);
            metaStore.index(index_str).openCursor(null, direction).onsuccess = function(e) {
                let cursor = e.target.result;
                if (cursor) {
                    let val = cursor.value;
                    if (val.title.toLowerCase().match(search_str)) {
                        results.push(val);
                    }
                    cursor.continue();
                } else {
                    res();
                    console.log("Entries all displayed.");
                }
            };
        });
        await Pause(100);
        console.log(results);
        return results;


        //dummy return value
        /*return makearr(1512).map(_ => {
            return {
                title: `${Math.random()}`.slice(0, 10),
                body: makearr(500).map(_ => "qwertyuiopasdfghjklzxcvbnm       .," [Math.random() * 35 | 0]).join("")
            }
        });*/
    }
    async createNewEntry() {
        const {
            db
        } = this;
        let i = 1;
        //getting the available names
        while (true) {
            const transaction = db.transaction(["essay-metadata"], "readonly");
            const metaStore = transaction.objectStore("essay-metadata");
            let cnt = await new Promise((res, rej) => {
                metaStore.index("title").count(`untitled ${i}`).onsuccess = function(e) {
                    res(e.target.result);
                };
            });
            if (cnt === 0) {
                break;
            }
            i++;
            //auto-commits, so no need to .commit();, but just in case
            transaction.commit();
        }
        let title = `untitled ${i}`;
        console.log(title);
        let tsnow = new Date(Date.now());

        let meta = {
            title,
            body: "",
            timestamps: {
                created: tsnow,
                modified: tsnow,
                opened: tsnow,
            },
            tags: []
        };

        const transaction = db.transaction(["essay-metadata","essay-body"], "readwrite");
        const metastore = transaction.objectStore("essay-metadata");
        const id = await new Promise((res, rej) => {
            //IDBRequest
            metastore.add(meta).onsuccess = function(e) {
                //results in the generated key (id)
                res(e.target.result);
            };
        });
        
        
        let body = {
            id,
            body:""
        };
        const bodystore = transaction.objectStore("essay-body");
        await new Promise((res, rej) => {
            //IDBRequest
            bodystore.add(body).onsuccess = function(e) {
                //results in the generated key (id)
                res(e.target.result);
            };
        });
        return id;
    }
    async getEntry(id) {
        const {db} = this;
        //returns data and metadata
        const transaction = db.transaction(["essay-metadata", "essay-body"], "readonly");
        let [metadata,body] = await Promise.all([
            new Promise((res, rej) => {
                transaction.objectStore("essay-metadata")
                .get(id).onsuccess = function(e) {
                    res(e.target.result);
                };
            }),
            new Promise((res, rej) => {
                transaction.objectStore("essay-body")
                .get(id).onsuccess = function(e) {
                    res(e.target.result);
                };
            }),
        ]);
        return [metadata,body];
    }
    async saveEntryBody(id, body) {
        const {db} = this;
        const transaction = db.transaction(["essay-body"], "readwrite");
        const bodystore = transaction.objectStore("essay-body");
        await new Promise((res, rej) => {
            //IDBRequest
            bodystore.put(body).onsuccess = function(e) {
                //results in the generated key (id)
                res(e.target.result);
            };
        });
    }
    async saveEntryMetadata(id, meta) {
        const {db} = this;
        const transaction = db.transaction(["essay-metadata"], "readwrite");
        const metastore = transaction.objectStore("essay-metadata");
        await new Promise((res, rej) => {
            //IDBRequest
            metastore.put(meta).onsuccess = function(e) {
                //results in the generated key (id)
                res(e.target.result);
            };
        });
    }
    async deleteRecord(id){
        const {db} = this;
        //returns data and metadata
        const transaction = db.transaction(["essay-metadata", "essay-body"], "readwrite");
        await Promise.all([
            new Promise((res, rej) => {
                transaction.objectStore("essay-metadata")
                .delete(id).onsuccess = function(e) {
                    res(e.target.result);
                };
            }),
            new Promise((res, rej) => {
                transaction.objectStore("essay-body")
                .delete(id).onsuccess = function(e) {
                    res(e.target.result);
                };
            }),
        ]);
        console.log("successfully deleted id "+id);
        return id;
    }
};