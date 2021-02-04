plugin.Name = "MetnoWeather";
plugin.OnChangeRequest = onChangeRequest;
plugin.OnConnect = onConnect;
plugin.OnDisconnect = onDisconnect;
plugin.OnPoll = onPoll;
plugin.OnSynchronizeDevices = onSynchronizeDevices;
plugin.PollingInterval = -1;


function sum(a,b) {
   return (a+b);
}

var http = new HTTPClient();
var response;
var obj;
var weatherdata = [];
var weatherdaydata = {
  temperature:0, 
  humidity:0, 
  windspeed:0,
  description:""
};
var datestarts = [];
var wdate;

function onChangeRequest(device, attribute, value) {
 
}

function onConnect() {
    //calculate midnight time stamps in local time
    var m = new Date(Date.now());
    var t = new Date(m.getFullYear(), m.getMonth(), m.getDate(), 0, 0, 0);

    for (i=0; i < 9; i++) {
        datestarts[i] = Date.parse(t); //the first timestamp is last midnight
        t.setDate(t.getDate() + 1);
    }

    //read weather data from met.no API
    response = http.get("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=60.24780&lon=24.76150&altitude=35",{headers: {'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}});
    
   // console.log(response.data.properties.timeseries[0].time);
    //console.log(response.data.properties.timeseries[0].data.instant.details.air_temperature);
    //console.log(response.data.properties.timeseries[1].time);
    //console.log(response.data.properties.timeseries[1].data.instant.details.air_temperature);
    
    
    var tempsum;
    var tempcount;
    
    //check which datapoints belong to each time window. met.no has more points for first days then less   
    for (i=0; i < 8; i++) {
        console.log(i + "  " + datestarts[i]);
        
        tempsum = 0;
        tempcount = 0;

        for (j in response.data.properties.timeseries) {
           dd = Date.parse(response.data.properties.timeseries[j].time);
            if((dd>=datestarts[i]) && (dd<datestarts[i+1])) {
                tempsum = tempsum + response.data.properties.timeseries[j].data.instant.details.air_temperature;
                tempcount++;
            }
        }
        
        
        
        //take average as daily temperature
        if(tempcount > 0) {
           //weatherdata[i].temperature = Math.round(tempsum/tempcount);
           weatherdata.push({temp:Math.round(tempsum/tempcount),ff:i});
        }
        else {
           //weatherdata[i].temperature = "";
           weatherdata.push(0);
        }
        //console.log("t: " + weatherdaydata.temperature);
        //weatherdaydata.humidity = response.data.properties.timeseries[j].data.instant.details.relative_humidity;
        //weatherdaydata.windspeed = response.data.properties.timeseries[j].data.instant.details.wind_speed;
        //weatherdaydata.description = response.data.properties.timeseries[j].data.next_12_hours.summary.symbol_code;
        //weatherdata.push(uu); 

        //console.log("count: " + tempcount);
     } 
     
     for(i in weatherdata) {
         console.log("ka: " + i + " " + JSON.stringify(weatherdata[i]));
      }
      
}

function onDisconnect() {
}

function onPoll() {
}

function onSynchronizeDevices() {
    var metno1 = new Device();
    metno1.Id = "1";
    metno1.DisplayName = "Metno 1";
    metno1.Capabilities = ["TemperatureMeasurement"];
    metno1.Attributes = ["Temperature"];
    plugin.Devices[metno1.Id] = metno1;
}
