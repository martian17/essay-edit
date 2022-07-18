let makearr = function(n) {
    let arr = [];
    for (let i = 0; i < n; i++) {
        arr.push(i);
    }
    return arr;
};

let objEqual = function(o1,o2){
    for(let key in o1){
        if(!(key in o2))return false;
        if(o2[key] !== o1[key])return false;
    }
    for(let key in o2){
        if(!(key in o1))return false;
        if(o2[key] !== o1[key])return false;
    }
    return true;
};