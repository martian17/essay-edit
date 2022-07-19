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