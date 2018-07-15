
window.addEventListener("load", Ready); 

function Ready(){ 

    if(window.File && window.FileReader){ //These are the relevant HTML5 objects that we are going to use
	
        document.getElementById('UploadButton').addEventListener('click', StartUpload);
		
        document.getElementById('FileBox').addEventListener('change', FileChosen);

    }
    else
    {
        document.getElementById('UploadArea').innerHTML = "Your Browser Doesn't Support The File API Please Update Your Browser";
    }
}



var SelectedFile;
function FileChosen(evnt) {
    SelectedFile = evnt.target.files[0];
    document.getElementById('NameBox').value = SelectedFile.name;
}



var socket = io.connect('http://localhost:8080');
var FReader;
var Name;
function StartUpload(){
    if(document.getElementById('FileBox').value != "")
    {
        FReader = new FileReader();
        Name = document.getElementById('NameBox').value;
        var Content = "<span id='NameArea'>Uploading " + SelectedFile.name + " as " + Name + "</span>";
        Content += '<div id="ProgressContainer"><div id="ProgressBar"></div></div><span id="percent">0%</span>';
        Content += "<span id='Uploaded'> - <span id='MB'>0</span>/" + Math.round(SelectedFile.size / 1048576) + "MB</span>";
        document.getElementById('UploadArea').innerHTML = Content;
        FReader.onload = function(evnt){
            socket.emit('Upload', { 'Name' : Name, Data : evnt.target.result });
        }
        socket.emit('Start', { 'Name' : Name, 'Size' : SelectedFile.size });
    }
    else
    {
        alert("Please Select A File");
    }
}



socket.on('Start', function (data) { //data contains the variables that we passed through in the html file
        var Name = data['Name'];
        Files[Name] = {  //Create a new Entry in The Files Variable
            FileSize : data['Size'],
            Data     : "",
            Downloaded : 0
        }
        var Place = 0;
        try{
            var Stat = fs.statSync('Temp/' +  Name);
            if(Stat.isFile())
            {
                Files[Name]['Downloaded'] = Stat.size;
                Place = Stat.size / 524288;
            }
        }
        catch(er){} //It's a New File
        fs.open("Temp/" + Name, "a", 0755, function(err, fd){
            if(err)
            {
                console.log(err);
            }
            else
            {
                Files[Name]['Handler'] = fd; //We store the file handler so we can write to it later
                socket.emit('MoreData', { 'Place' : Place, Percent : 0 });
            }
        });
});

socket.on('Upload', function (data){
        var Name = data['Name'];
        Files[Name]['Downloaded'] += data['Data'].length;
        Files[Name]['Data'] += data['Data'];
        if(Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
        {
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
                //Get Thumbnail Here
            });
        }
        else if(Files[Name]['Data'].length > 10485760){ //If the Data Buffer reaches 10MB
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
                Files[Name]['Data'] = ""; //Reset The Buffer
                var Place = Files[Name]['Downloaded'] / 524288;
                var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
                socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
            });
        }
        else
        {
            var Place = Files[Name]['Downloaded'] / 524288;
            var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
            socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
        }
    });
	
	
socket.on('MoreData', function (data){
    UpdateBar(data['Percent']);
    var Place = data['Place'] * 524288; //The Next Blocks Starting Position
    var NewFile; //The Variable that will hold the new Block of Data
    if(SelectedFile.webkitSlice) 
        NewFile = SelectedFile.webkitSlice(Place, Place + Math.min(524288, (SelectedFile.size-Place)));
    else
        NewFile = SelectedFile.mozSlice(Place, Place + Math.min(524288, (SelectedFile.size-Place)));
    FReader.readAsBinaryString(NewFile);
});
 
function UpdateBar(percent){
    document.getElementById('ProgressBar').style.width = percent + '%';
    document.getElementById('percent').innerHTML = (Math.round(percent*100)/100) + '%';
    var MBDone = Math.round(((percent/100.0) * SelectedFile.size) / 1048576);
    document.getElementById('MB').innerHTML = MBDone;
}

var inp = fs.createReadStream("Temp/" + Name);
var out = fs.createWriteStream("Video/" + Name);
util.pump(inp, out, function(){
    fs.unlink("Temp/" + Name, function () { //This Deletes The Temporary File
        //Moving File Completed
    });
});

exec("ffmpeg -i Video/" + Name  + " -ss 01:30 -r 1 -an -vframes 1 -f mjpeg Video/" + Name  + ".jpg", function(err){
    socket.emit('Done', {'Image' : 'Video/' + Name + '.jpg'});
});

var Path = "http://localhost/";
 
socket.on('Done', function (data){
    var Content = "Video Successfully Uploaded !!"
    Content += "<img id='Thumb' src='" + Path + data['Image'] + "' alt='" + Name + "'><br>";
    Content += "<button  type='button' name='Upload' value='' id='Restart' class='Button'>Upload Another</button>";
    document.getElementById('UploadArea').innerHTML = Content;
    document.getElementById('Restart').addEventListener('click', Refresh);
});
function Refresh(){
    location.reload(true);
}