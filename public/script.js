function test1(){

fetch('/api/test')
.then(res => res.json())
.then(data => {
document.getElementById("result").innerText = data.message
})

}