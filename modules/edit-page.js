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
        this.textarea = editor_body.add("textarea","spellcheck:false;");
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