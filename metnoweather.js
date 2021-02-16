//MetnoWeather Plugin for HomeRemote
//Seven days weather forecast using met.no API
//Weather Data from MET Norway
//Developed by Vpow 2021

plugin.Name = "MetnoWeather";
plugin.OnChangeRequest = onChangeRequest;
plugin.OnConnect = onConnect;
plugin.OnDisconnect = onDisconnect;
plugin.OnPoll = onPoll;
plugin.OnSynchronizeDevices = onSynchronizeDevices;
plugin.PollingInterval = 900000; //every 15min
plugin.DefaultSettings = { "Latitude": "0.0", "Longitude": "0.0","Altitude": "0"};

//info for user agent
var VERSION = "v1.1";
var UALINK = "github.com/Vpowgh/MetnoWeather";

//internal copy of settings
var int_settings = {
    latitide: 0,
    longitude: 0,
    altitude: 0
};

var http = new HTTPClient();


function onChangeRequest(device, attribute, value) {
}

function onConnect() {
    var lat, lon, alt;
    
    //met.no TOS: max. 4 decimals for coordinates
    lat = Math.round(plugin.Settings["Latitude"] * 10000) / 10000;
    lon = Math.round(plugin.Settings["Longitude"] * 10000) / 10000;
    alt = Math.round(plugin.Settings["Altitude"] * 10000) / 10000;
    
    //sanity check for coordinates
    if(lat > 90.0) {
        lat = 90.0;
    }
    else if(lat < -90.0) {
        lat = -90.0;
    }

    if(lon > 180.0) {
        lon = 180.0;
    }
    else if(lon < -180.0) {
        lon = -180.0;
    }

    if(alt > 50000.0) {
        alt = 50000.0;
    }
    else if(alt < 0.0) {
        alt = 0.0;
    }
    
    int_settings.latitude = lat;
    int_settings.longitude = lon;
    int_settings.altitude = alt;
}

function onDisconnect() {
}

function onPoll() {

    //read weather data from met.no API
    //met.no TOS: must send in user agent application name, version, developer info
    var response = http.get("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=" + int_settings.latitude + "&lon=" + int_settings.longitude +"&altitude=" + int_settings.altitude,{headers: {'User-Agent': "HomeRemote_MetnoWeatherPlugin "+VERSION+" "+UALINK}, timeout: 10000});
    if(response.status != 200) {
        return;
    }

    var weatherdata = [];
    var datestarts = [];

    //calculate midnight time stamps in local time
    var m = new Date(Date.now());
    var t = new Date(m.getFullYear(), m.getMonth(), m.getDate(), 0, 0, 0);
    //use this if want to show other timezone, add offset relative to local timezone
    //var t = new Date(m.getFullYear(), m.getMonth(), m.getDate(), m.getHours()-11, 0, 0);

    for (i=0; i < 9; i++) {
        datestarts[i] = Date.parse(t); //the first timestamp is last midnight
        t.setDate(t.getDate() + 1);
    }

    var sums = {
        air_pressure_at_sea_level_sum: 0,
        air_temperature_sum: 0,
        cloud_area_fraction_sum: 0,
        relative_humidity_sum: 0,
        wind_from_direction_sum: 0,
        wind_speed_sum: 0
    };
    var datacount;
    var jstart = 0;

    var nowindex = 0;

    //check which datapoints belong to each time window. met.no has more points for first days then less
    for(i=0; i < 8; i++) {

        sums.air_pressure_at_sea_level_sum = 0;
        sums.air_temperature_sum = 0;
        sums.cloud_area_fraction_sum = 0;
        sums.relative_humidity_sum = 0;
        sums.wind_from_direction_sum = 0;
        sums.wind_speed_sum = 0;
        datacount = 0;

        var noontime = datestarts[i] + (datestarts[i+1] - datestarts[i])/2;
        var noonindex = 0;
        var noondiff = 86400000; //24h in ms
        
        var nowdiff = 86400000;
        var datenow = Date.parse(m);

        for(j=jstart; j < Object.keys(response.data.properties.timeseries).length; j++) {
            dd = Date.parse(response.data.properties.timeseries[j].time);
            
            //check first values which point is closest to now
            if(j<4) {
                var ndiff = Math.abs(dd-datenow);
                if(ndiff < nowdiff) {
                    nowdiff = ndiff;
                    nowindex = j;
                }
            }

            if(dd>datestarts[i+1]) {
                jstart = j;
                break;
            }
            else if(dd>=datestarts[i]) {
                sums.air_pressure_at_sea_level_sum += response.data.properties.timeseries[j].data.instant.details.air_pressure_at_sea_level;
                sums.air_temperature_sum += response.data.properties.timeseries[j].data.instant.details.air_temperature;
                sums.cloud_area_fraction_sum += response.data.properties.timeseries[j].data.instant.details.cloud_area_fraction;
                sums.relative_humidity_sum += response.data.properties.timeseries[j].data.instant.details.relative_humidity;
                sums.wind_from_direction_sum += response.data.properties.timeseries[j].data.instant.details.wind_from_direction;
                sums.wind_speed_sum += response.data.properties.timeseries[j].data.instant.details.wind_speed;
                datacount++;
            }

            //find closest to noon datapoint and use symbol from that
            var ndiff = Math.abs(dd-noontime);
            
            if(ndiff  < noondiff) {
                noondiff = ndiff;
                noonindex = j;
            }
        }

        //take averages as daily values
        if(datacount > 0) {
           //datapoints might have any combination of available symbols
           var ssymbol;
           if(response.data.properties.timeseries[noonindex].data.hasOwnProperty('next_6_hours')) {
               ssymbol = response.data.properties.timeseries[noonindex].data.next_6_hours.summary.symbol_code
           }
           else if(response.data.properties.timeseries[noonindex].data.hasOwnProperty('next_12_hours')) {
               ssymbol = response.data.properties.timeseries[noonindex].data.next_12_hours.summary.symbol_code
           }
           else if(response.data.properties.timeseries[noonindex].data.hasOwnProperty('next_1_hours')) {
               ssymbol = response.data.properties.timeseries[noonindex].data.next_1_hours.summary.symbol_code
           }
           else {
               ssymbol = "fair_day"; //give fair day if nothing else found!
           }
           
           weatherdata.push({
               air_pressure_at_sea_level:Math.round(sums.air_pressure_at_sea_level_sum/datacount),
               air_temperature:Math.round(sums.air_temperature_sum/datacount),
               cloud_area_fraction:Math.round(sums.cloud_area_fraction_sum/datacount),
               relative_humidity:Math.round(sums.relative_humidity_sum/datacount),
               wind_from_direction:Math.round(sums.wind_from_direction_sum/datacount),
               wind_speed:Math.round(((sums.wind_speed_sum/datacount) * 10)) / 10,
               symbol:ssymbol
           });
        }
        else {
           weatherdata.push(0);
        }
    }

    var device = plugin.Devices[1];

    //update forecast values for next 7 days
    device.temperature1 = weatherdata[1].air_temperature;
    device.temperature2 = weatherdata[2].air_temperature;
    device.temperature3 = weatherdata[3].air_temperature;
    device.temperature4 = weatherdata[4].air_temperature;
    device.temperature5 = weatherdata[5].air_temperature;
    device.temperature6 = weatherdata[6].air_temperature;
    device.temperature7 = weatherdata[7].air_temperature;

    device.symbol1 = weatherdata[1].symbol + ".png";
    device.symbol2 = weatherdata[2].symbol + ".png";
    device.symbol3 = weatherdata[3].symbol + ".png";
    device.symbol4 = weatherdata[4].symbol + ".png";
    device.symbol5 = weatherdata[5].symbol + ".png";
    device.symbol6 = weatherdata[6].symbol + ".png";
    device.symbol7 = weatherdata[7].symbol + ".png";
    
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    device.weekday1 = days[new Date(datestarts[1]).getDay()];
    device.weekday2 = days[new Date(datestarts[2]).getDay()];
    device.weekday3 = days[new Date(datestarts[3]).getDay()];
    device.weekday4 = days[new Date(datestarts[4]).getDay()];
    device.weekday5 = days[new Date(datestarts[5]).getDay()];
    device.weekday6 = days[new Date(datestarts[6]).getDay()];
    device.weekday7 = days[new Date(datestarts[7]).getDay()];

    //update now values
    device.weekday_now =            days[m.getDay()];
    device.airpressure_now =        response.data.properties.timeseries[nowindex].data.instant.details.air_pressure_at_sea_level;
    device.temperature_now =        response.data.properties.timeseries[nowindex].data.instant.details.air_temperature;
    device.cloudareafraction_now =  response.data.properties.timeseries[nowindex].data.instant.details.cloud_area_fraction;
    device.humidity_now =           response.data.properties.timeseries[nowindex].data.instant.details.relative_humidity;
    device.winddirection_now =      response.data.properties.timeseries[nowindex].data.instant.details.wind_from_direction;
    device.windspeed_now =          response.data.properties.timeseries[nowindex].data.instant.details.wind_speed;
    
    var ssymbol;
    if(response.data.properties.timeseries[nowindex].data.hasOwnProperty('next_1_hours')) {
       ssymbol = response.data.properties.timeseries[nowindex].data.next_1_hours.summary.symbol_code
    }
    else if(response.data.properties.timeseries[nowindex].data.hasOwnProperty('next_6_hours')) {
       ssymbol = response.data.properties.timeseries[nowindex].data.next_6_hours.summary.symbol_code
    }
    else if(response.data.properties.timeseries[nowindex].data.hasOwnProperty('next_12_hours')) {
       ssymbol = response.data.properties.timeseries[nowindex].data.next_12_hours.summary.symbol_code
    }
    else {
       ssymbol = "fair_day"; //give fair day if nothing else found!
    }
    device.symbol_now = ssymbol + ".png";
}

function onSynchronizeDevices() {
    var metno1 = new Device();
    metno1.Id = "1";
    metno1.DisplayName = "Metno 1";
    metno1.Capabilities = [];
    metno1.Attributes = [
    "temperature_now", "weekday_now", "symbol_now", "airpressure_now", "cloudareafraction_now", "humidity_now", "winddirection_now", "windspeed_now",
    "temperature1","temperature2","temperature3","temperature4","temperature5","temperature6","temperature7",
    "weekday1","weekday2","weekday3","weekday4","weekday5","weekday6","weekday7",
    "symbol1","symbol2","symbol3","symbol4","symbol5","symbol6","symbol7"
    ];
    
    plugin.Devices[metno1.Id] = metno1;
}
