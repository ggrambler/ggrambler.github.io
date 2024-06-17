
let min = 0;
let max = 100;

const minn = document.getElementById("submin");
const maxx = document.getElementById("submax");
const gene = document.getElementById("gen");


minn.onclick = function()
{
    min = Number(document.getElementById("min").value);
    if(min>=max) window.alert("Min more than max!! Reconfig MAX!");
    console.log("MINN",min,typeof(min));
}
maxx.onclick = function()
{
    max = Number(document.getElementById("max").value);
    if(max<=min) window.alert("Max less than min!! Reconfig MIN!");
    console.log("MINN",max,typeof(max));
}
gene.onclick = function()
{   
    if(min>=max) {
        document.getElementById("l1").textContent = `Value NaN`;
        window.alert("Wrong Min or Max values!!!");
    }
    else{
    let rann = Math.round((Math.random()*(max-min))+min);
    document.getElementById("l1").textContent = `RN: ${rann}`;
    console.log(rann);
    }
}