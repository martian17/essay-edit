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





class EvtELEM extends ELEM{
    constructor(){
        super(...arguments);
        let bus = new Events();
        this.on = bus.on.bind(this);
        this.emit = bus.emit.bind(this);
    }
}





let Style = "";

Style += /*css*/ `
body{
    font-family:Arial;
}
.searchbar{
    width:100%;
    text-align:center;
    padding: 10px;
    background-color:#aaa;
    border-bottom:solid #888 3px;
    display:flex;
    box-sizing:border-box;
    justify-content: center;
}
.searchbar>*{
    height:40px;
    line-height:40px;
    box-sizing:border-box;
    vertical-align:middle;
    display:inline-block;
    border-radius:5px;
    padding: 0px 10px;
    box-sizing:border-box;
}
.searchbar .bar{
    margin-right:5px;
    font-size:1.1em;
    flex-grow:1;
    max-width:500px;
}
.searchbar .btn, .searchbar select{
    border:solid 1px #444;
    text-align:center;
    background-color:#eee;
    /*transition:background-color 0.5s;*/
}
.searchbar .btn:hover{
    background-color:#ddd;
}


.searchbar select{
    margin-left: 5px;
    font-size:1em;
}
.searchbar select:hover{
    background-color: #ddd;
}


.searchbar .newbtn{
    border: solid 1px #444;
    text-align: center;
    color: #000;
    background-color: #6eff6e;
    margin-left:5px;
}

.searchbar .newbtn:hover{
    background-color:#8f8;
}

`;


class Select extends ELEM {
    constructor(options) {
        super("select");
        for (let i = 0; i < options.length; i++) {
            let [val, label] = options[i];
            this.add("option", `value:${val}`, label);
        }
    }
    get value() {
        return this.e.options[this.e.selectedIndex].value;
    }
};


class SearchBar extends EvtELEM {
    constructor(data) {
        super("div", "class:searchbar");
        let that = this;
        this.data = data;

        let input = this.add("input", "type:text;class:bar;");
        this.input = input;
        let btn = this.add("div", "class:btn", "Search");
        btn.on("click", () => that.handleInput());
        input.on("keydown", e => {
            if (e.key === "Enter") {
                that.handleInput();
            }
        });

        //search order
        this.select = this.add(new Select(`
            modify-new; Date modified: newest first
            modify-old; Date modified: oldest first
            opened-new; Date opened: newest first
            opened-old; Date opened: oldest first
            create-new; Date created: newest first
            create-old; Date created: oldest first
            alph-a-z; Alphabetical: A-Z
            alph-z-a; Alphabetical: Z-A
        `.split("\n").map(v => v.trim())
            .filter(v => v !== "").map(l => {
                let r = l.split(";");
                return [r[0].trim(), r[1].trim()];
            })));
        this.select.on("input", () => {
            that.handleInput();
        });

        let createNew = this.add("div", "class:newbtn", "+new");

        createNew.on("click", () => {
            that.emit("create-new");
        });
    }
    params = {};
    handleInput() {
        let params = this.getParams();
        //if (params.search_str === "")return;
        if (objEqual(this.params, params)) {
            return;
        }
        this.params = params;
        this.emit("search", params);
    }
    getParams() {
        return {
            search_str: this.input.e.value,
            order: this.select.value
        }
    }
};



Style += /*css*/ `
.page-select{
    text-align:center;
    display:none;
}

.page-select>*{
    display:inline-block;
}

.page-select .btn{
    padding:0.2em;
    background-color:#eee;
    border-radius:1px;
    margin:2px;
    border:solid 1px #aaa;
}
.page-select .btn:hover{
    background-color:#ddd;
}

.page-select .number{
    display:inline-block;
    padding:0.2em;
    text-decoration:none;
    user-select: none;
}

.page-select div.number{
    text-decoration:underline;
    color:#444;
    cursor:default;
}

.page-select a.number{
    color:#0094ff;
}

.page-select a.number:hover{
    color:#005da1;
    cursor:pointer;
}
`;


class PageSelect extends ELEM {
    limit = 10; //aesthetic limit: 10 pages at a time
    btn = class extends ELEM {
        constructor(label, cb) {
            super("div", "class:btn", label);
            this.on("click", () => this.active && cb());
        }
        isActive = true;
        set active(val) {
            if (val === this.isActive) return;
            this.isActive = val;
            if (val) {
                this.classList.remove("inactive");
            } else {
                this.classList.add("inactive");
            }
        }
        get active() {
            return this.isActive;
        }
    };
    constructor(wrapper) {
        super("div", "class:page-select");
        let that = this;
        this.wrapper = wrapper;
        //adding control boxes
        this.add(new this.btn("<<", () => wrapper.emit("<<")));
        this.add(new this.btn("<", () => wrapper.emit("<")));
        this.numbers = this.add("div");
        this.add(new this.btn(">", () => wrapper.emit(">")));
        this.add(new this.btn(">>", () => wrapper.emit(">>")));
        //wrapper will be deleted at teh same time as this calss
        //thus garbage collection not needed even being an external callback
        wrapper.on("setPage", this.setPage.bind(this));
        wrapper.on("stateChange", (state) => {
            if (state === "results") {
                this.e.style.display = "block";
            } else {
                this.e.style.display = "none";
            }
        });
    }
    setPage(n) {
        //render everything
        let {
            numbers,
            wrapper,
            limit
        } = this;
        numbers.children.foreach(c => c.remove());
        let len = Math.ceil(wrapper.data.length / wrapper.max);
        let r = Math.floor(limit / 2);
        //1 until len+1, centered around n
        let min;
        if (n + (limit - r) > len) {
            min = len - limit + 1;
        } else {
            min = n - r;
        }
        if (min < 1) {
            min = 1;
        }
        for (let i = min; i < min + limit && i <= len; i++) {
            if (i === n) {
                //no link, its own page
                numbers.add("div", "class:number", i);
            } else {
                let nn = numbers.add("a", "class:number", i);
                nn.on("click", function() {
                    wrapper.emit("setPage", this.i);
                }.bind({
                    i
                }));
            }
        }
    }
};


Style += /*css*/ `
.boxes>.container{
    display: grid;
    grid-gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}
.boxes .box{
    margin:10px;
    background-color:#eee;
    border-radius:5px;
    padding:10px;
    min-height:200px;
}

.boxes .box:hover{
    background-color:#ddd;
    cursor:pointer;
}

.boxes .no-result-msg,
.boxes .searching-msg{
    display:none;
    text-align:center;
    font-size:5em;
    color:#aaa;
    padding:20px 0px;
}

`;

class ResultBoxes extends EvtELEM {
    constructor(app) {
        super("div", "class:boxes");
        let that = this;
        this.app = app;

        //messages
        let no_r_msg = this.add("div", "class:no-result-msg", "No result found");
        let searching_msg = this.add("div", "class:searching-msg", "Searching...");

        this.add(new PageSelect(this));
        this.boxes = this.add("div", "class:container");
        this.add(new PageSelect(this));
        this.on("setPage", this.setPage);

        //display states
        this.on("stateChange", (state) => {
            no_r_msg.e.style.display =
                state === "no-results" ? "block" : "none";
            searching_msg.e.style.display =
                state === "searching" ? "block" : "none";
            this.boxes.e.style.display =
                state === "results" ? "grid" : "none";
        });

    }
    page = 1; //1st page
    max = 50;
    data = [];
    update(data) {
        this.data = data;
        this.page = 1;
        this.emit("setPage", 1);
    }
    setPage(n) {
        let {app} = this;
        //remove all the children
        this.boxes.children.foreach(c => c.remove());
        //slice the section
        let begin = (n - 1) * this.max;
        let end = begin + this.max;
        let section = this.data.slice(begin, end);
        for (let i = 0; i < section.length; i++) {
            let data = section[i];
            let box = this.boxes.add("div", "class:box");
            box.add("h2", 0, data.title);
            box.add("p", 0, data.body);
            box.on("click",()=>app.openEditor(data.id));
        }
    }
    state_val = "initializing";
    get state() {
        return this.state_val;
    }
    set state(val) {
        this.state_val = val;
        this.emit("stateChange", val);
    }
};



class SearchWidget extends ELEM {
    constructor(database, app) {
        super("div");
        let bar = this.add(new SearchBar());
        let rbox = this.add(new ResultBoxes(app));
        //setup the initial state
        //simulate input
        (async function() {
            bar.handleInput();
            let data = await database.search(bar.params);
            if (data.length === 0) {
                rbox.state = "no-results";
            } else {
                rbox.state = "results";
                rbox.update(data);
            }
        }());
        bar.on("search", async () => {
            rbox.state = "searching";
            let data = await database.search(bar.params);
            if (data.length === 0) {
                rbox.state = "no-results";
            } else {
                rbox.state = "results";
                rbox.update(data);
            }
        });
        bar.on("create-new", async () => {
            console.log("creating a new entry");
            let id = await database.createNewEntry();
            console.log(id);
            app.openEditor(id);
        });
    }
    destroy(){
        //remove events etc
        this.remove();
    }
};



Style += `
.editor{
    width:100%;
    height:100%;
}

.editor .searchbar{
    justify-content: left;
}

.editor .searchbar>*{
    display:inline-block;
}

.editor .searchbar>.title,
.editor .searchbar>.delete-btn,
.editor .searchbar>.save-btn{
    border:solid 1px #444;
    text-align:center;
    background-color:#eee;
}

.editor .searchbar>.delete-btn{
    margin-right:5px;
    background-color:#ff896e;
    color:#000;
}

.editor .searchbar>.save-btn{
    background-color:#6eff6e;
    color:#000;
}

.editor textarea{
    width:100%;
    height:calc(100vh - 63px);
}

`;

class Editor extends ELEM {
    Title = class extends EvtELEM{
        constructor(name){
            super("div","class:title;contenteditable:true;",name);
            let that = this;
            super.on("keydown",e=>{
                if(e.key !== "Enter")return;
                e.preventDefault();
                that.e.blur();
            });
            super.on("focusout",e=>{
                that.emit("enter");
            });
        }
        get value(){
            return this.e.textContent;
        }
    }
    constructor(database, app, id) {
        super("div","class:editor");
        this.database = database;
        this.app = app;
        this.id = id;
        this.initialize();
    }
    foreignListeners = [];
    async initialize(){
        let {database, app, id} = this;
        let that = this;
        let [metadata,body] = await database.getEntry(id);
        console.log(metadata,body);
        this.metadata = metadata;
        this.body = body;
        let head = this.add("div","class:searchbar;");
        this.title = head.add(new this.Title(metadata.title));
        this.title.on("enter",async ()=>{
            console.log("entered");
            that.save();
        });
        head.add("div",0,0,"flex-grow:1;");
        head.add("div","class:delete-btn","Delete Document").on("click",()=>{
            database.deleteRecord(id);
            //could await, but don't because it's safe anyway bc it's transaction
            app.openHome();
        });
        head.add("div","class:save-btn","Save and exit").on("click",()=>{
            that.save();
            app.openHome();
        });
        
        let editor_body = this.add("div","class:body;");
        this.textarea = editor_body.add("textarea");
        this.textarea.e.value = body.body;
        
        this.foreignListeners.push(app.on("save",async ()=>{
            that.save();
        }));
    }
    async save(){
        let {database, app, id, body, metadata,textarea,title} = this;
        console.log("saving");
        body.body = textarea.e.value;
        metadata.title = title.value;
        metadata.body = body.body.slice(0,200);
        await database.saveEntryMetadata(id,metadata);
        await database.saveEntryBody(id,body);
        console.log("saved");
    }
    async destroy(){
        this.foreignListeners.map(l=>l.remove());
        this.remove();
    }
};


class EssayEditApp extends EvtELEM {
    active = null;
    constructor(parent) {
        super(parent);
        let that = this;
        //registering all the shortcuts
        window.addEventListener("keydown",(e)=>{
            
            if(!(e.shiftKey || e.ctrlKey || e.metaKey))return;
            if(e.key === "s"){
                e.preventDefault();
                that.emit("save");
            }
        });
        
        
        
        this.add("style", 0, Style);
        this.initialize();
        
    }
    async initialize() {
        let database = new Data();
        await database.initialize();
        this.database = database;
        this.openHome();
    }
    openEditor(id) {
        if (this.active)this.active.destroy();
        this.active = this.add(new Editor(this.database, this, id));
    }
    openHome() {
        if (this.active) this.active.destroy();
        this.active = this.add(new SearchWidget(this.database, this));
    }
};


let main = async function() {
    //return;
    let editorApp = new EssayEditApp(document.body);
};

main();