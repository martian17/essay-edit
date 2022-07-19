class EvtELEM extends ELEM{
    constructor(){
        super(...arguments);
        let bus = new Events();
        this.on = bus.on.bind(this);
        this.emit = bus.emit.bind(this);
    }
};


let Style = "";