plugin.Name = "MetnoWeather";
plugin.OnChangeRequest = onChangeRequest;
plugin.OnConnect = onConnect;
plugin.OnDisconnect = onDisconnect;
plugin.OnPoll = onPoll;
plugin.OnSynchronizeDevices = onSynchronizeDevices;
plugin.PollingInterval = 900000; //every 15min
plugin.DefaultSettings = { "Latitude": "0.0", "Longitude": "0.0","Altitude": "0"};

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
}

function onDisconnect() {
}

function onPoll() {
    //calculate midnight time stamps in local time
    var m = new Date(Date.now());
    var t = new Date(m.getFullYear(), m.getMonth(), m.getDate(), 0, 0, 0);

    for (i=0; i < 9; i++) {
        datestarts[i] = Date.parse(t); //the first timestamp is last midnight
        t.setDate(t.getDate() + 1);
    }

    //read weather data from met.no API
    response = http.get("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=" + plugin.Settings["Latitude"] + "&lon=" + plugin.Settings["Longitude"] +"&altitude=" + plugin.Settings["Altitude"],{headers: {'User-Agent': "HomeRemote_MetnoWeatherPlugin"}});
    
    var sums = {
              air_pressure_at_sea_level_sum: 0,
              air_temperature_sum: 0,
              cloud_area_fraction_sum: 0,
              relative_humidity_sum: 0,
              wind_from_direction_sum: 0,
              wind_speed_sum: 0
    };
    var datacount;
    
    //check which datapoints belong to each time window. met.no has more points for first days then less   
    for (i=0; i < 8; i++) {

        sums.air_pressure_at_sea_level_sum = 0;
        sums.air_temperature_sum = 0;
        sums.cloud_area_fraction_sum = 0;
        sums.relative_humidity_sum = 0;
        sums.wind_from_direction_sum = 0;
        sums.wind_speed_sum = 0;
        datacount = 0;

        for (j in response.data.properties.timeseries) {
           dd = Date.parse(response.data.properties.timeseries[j].time);
            if((dd>=datestarts[i]) && (dd<datestarts[i+1])) {
                sums.air_pressure_at_sea_level_sum += response.data.properties.timeseries[j].data.instant.details.air_pressure_at_sea_level;
                sums.air_temperature_sum += response.data.properties.timeseries[j].data.instant.details.air_temperature;
                sums.cloud_area_fraction_sum += response.data.properties.timeseries[j].data.instant.details.cloud_area_fraction;
                sums.relative_humidity_sum += response.data.properties.timeseries[j].data.instant.details.relative_humidity;
                sums.wind_from_direction_sum += response.data.properties.timeseries[j].data.instant.details.wind_from_direction;
                sums.wind_speed_sum += response.data.properties.timeseries[j].data.instant.details.wind_speed;
               datacount++;
            }
        }
        
        //take average as daily value
        if(datacount > 0) {
           weatherdata.push({
               air_pressure_at_sea_level:Math.round(sums.air_pressure_at_sea_level_sum/datacount),
               air_temperature:Math.round(sums.air_temperature_sum/datacount),
               cloud_area_fraction:Math.round(sums.cloud_area_fraction_sum/datacount),
               relative_humidity:Math.round(sums.relative_humidity_sum/datacount),
               wind_from_direction:Math.round(sums.wind_from_direction_sum/datacount),
               wind_speed:Math.round(((sums.wind_speed_sum/datacount) * 10)) / 10
           });
        }
        else {
           weatherdata.push(0);
        }
     } 
     
    var device = plugin.Devices[1];
    device.temperature1 =  weatherdata[1].air_temperature;
    device.temperature2 =  weatherdata[2].air_temperature;
    device.temperature3 =  weatherdata[3].air_temperature;
    device.temperature4 =  weatherdata[4].air_temperature;
    device.temperature5 =  weatherdata[5].air_temperature;
    device.temperature6 =  weatherdata[6].air_temperature;
    device.temperature7 =  weatherdata[7].air_temperature;
    
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    device.weekday1 =  days[new Date(datestarts[1]).getDay()];
    device.weekday2 =  days[new Date(datestarts[2]).getDay()];
    device.weekday3 =  days[new Date(datestarts[3]).getDay()];
    device.weekday4 =  days[new Date(datestarts[4]).getDay()];
    device.weekday5 =  days[new Date(datestarts[5]).getDay()];
    device.weekday6 =  days[new Date(datestarts[6]).getDay()];
    device.weekday7 =  days[new Date(datestarts[7]).getDay()];
}

function onSynchronizeDevices() {
    var metno1 = new Device();
    metno1.Id = "1";
    metno1.DisplayName = "Metno 1";
    metno1.Capabilities = [];
    metno1.Attributes = [
    "temperature1","temperature2","temperature3","temperature4","temperature5","temperature6","temperature7",
    "weekday1","weekday2","weekday3","weekday4","weekday5","weekday6","weekday7"
    ];
    //metno1.Attributes = ["weatherdata"];
    //metno1.weatherdata = [{id:"0",air_pressure_at_sea_level: "0",air_temperature: "0",cloud_area_fraction: "0",relative_humidity: "0",wind_from_direction: "0",wind_speed: "0"},
    //{id:"1",air_pressure_at_sea_level: "0",air_temperature: "0",cloud_area_fraction: "0",relative_humidity: "0",wind_from_direction: "0",wind_speed: "0"}];
    
    plugin.Devices[metno1.Id] = metno1;
}
