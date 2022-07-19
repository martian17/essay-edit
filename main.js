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